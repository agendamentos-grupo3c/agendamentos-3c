import { IMPLANTATION_SLOTS, SEGMENT_IMPLANTERS, type Segment } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import { addGuestToTraining, getImplanterCalendarId } from '../integrations/googleCalendar.js';
import { spDateString } from '../lib/implantationPolicy.js';
import { logger } from '../lib/logger.js';
import { toE164 } from '../lib/phone.js';
import type { ImplantationSlotPayload } from '../lib/slotToken.js';
import { insertAuditLog } from '../repositories/auditRepository.js';
import {
  type Implantation,
  UNIQUE_CONSTRAINTS,
  findByIdempotencyKey,
  insertWithCapacity,
  setEvent,
  uniqueViolationConstraint,
} from '../repositories/implantationRepository.js';

export type ImplantationDispatch = 'calendar';

export interface BookImplantationInput {
  sellerEmail: string;
  sellerName: string;
  idempotencyKey: string;
  form: {
    companyName: string;
    clientName: string;
    clientEmail: string;
    phone: string;
    clientId: string;
    segment: Segment;
  };
  slot: ImplantationSlotPayload;
}

export interface BookImplantationResult {
  booking: Implantation;
  pending: ImplantationDispatch[];
}

function slotFull(): AppError {
  return new AppError({
    code: 'SLOT_FULL',
    statusCode: 409,
    publicMessage: 'Esse horário acabou de lotar. Escolha outro.',
  });
}

function invalidSlot(): AppError {
  return new AppError({
    code: 'INVALID_SLOT',
    statusCode: 400,
    publicMessage: 'Horário inválido. Recarregue a agenda e tente novamente.',
  });
}

// Despacho best-effort: adiciona o cliente ao evento de treinamento. Falha vira
// pendência para reprocessar (replay idempotente) — a reserva (vaga) já está
// garantida no banco.
// Nota: a notificação ao cliente (WhatsApp/e-mail) NÃO usa mais o n8n na
// implantação — passará a ser feita pelas automações do HubSpot (Fase A). Até lá
// o convite do treinamento ainda sai pelo Google.
async function runDispatches(booking: Implantation): Promise<ImplantationDispatch[]> {
  const pending: ImplantationDispatch[] = [];

  if (!booking.googleEventId) {
    try {
      const calendarId = getImplanterCalendarId(booking.implanter);
      const result = await addGuestToTraining(
        calendarId,
        new Date(booking.scheduledStart),
        booking.clientEmail,
      );
      if (result) {
        const updated = await setEvent(booking.id, result.eventId, result.meetUrl ?? null);
        booking.googleEventId = updated.googleEventId;
        booking.meetingUrl = updated.meetingUrl;
      } else {
        logger.warn({ implantationId: booking.id }, 'training event not found for slot');
        pending.push('calendar');
      }
    } catch (err) {
      logger.warn({ err, implantationId: booking.id }, 'implantation calendar dispatch pending');
      pending.push('calendar');
    }
  }

  return pending;
}

export async function bookImplantation(input: BookImplantationInput): Promise<BookImplantationResult> {
  // Replay idempotente: mesma chave não recria; só reprocessa o pendente.
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return { booking: existing, pending: await runDispatches(existing) };
  }

  const { segment } = input.form;
  const { slot } = input;

  // O implantador do token tem que atender o segmento, e o slot precisa existir.
  if (!SEGMENT_IMPLANTERS[segment].includes(slot.implanter)) throw invalidSlot();
  const template = IMPLANTATION_SLOTS.find((t) => t.kind === slot.kind);
  if (!template) throw invalidSlot();
  if (template.onlyImplanter && template.onlyImplanter !== slot.implanter) throw invalidSlot();

  let booking: Implantation | null;
  try {
    booking = await insertWithCapacity(
      {
        companyName: input.form.companyName,
        clientName: input.form.clientName,
        clientEmail: input.form.clientEmail,
        clientPhoneE164: toE164(input.form.phone),
        clientId: input.form.clientId,
        segment,
        implanter: slot.implanter,
        slotDate: spDateString(new Date(slot.startISO)),
        slotKind: slot.kind,
        scheduledStart: slot.startISO,
        scheduledEnd: slot.endISO,
        sellerEmail: input.sellerEmail,
        sellerName: input.sellerName,
        idempotencyKey: input.idempotencyKey,
      },
      template.capacity,
    );
  } catch (err) {
    if (uniqueViolationConstraint(err) === UNIQUE_CONSTRAINTS.IDEMPOTENCY) {
      const dup = await findByIdempotencyKey(input.idempotencyKey);
      if (dup) return { booking: dup, pending: await runDispatches(dup) };
    }
    throw err;
  }
  if (!booking) throw slotFull();

  await insertAuditLog({
    actorEmail: input.sellerEmail,
    action: 'implantation.created',
    metadata: {
      implantationId: booking.id,
      implanter: booking.implanter,
      slotKind: booking.slotKind,
      slotDate: booking.slotDate,
    },
  });

  return { booking, pending: await runDispatches(booking) };
}
