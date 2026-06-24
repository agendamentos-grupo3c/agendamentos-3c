import { HUBSPOT, IMPLANTATION_SLOTS, SEGMENT_IMPLANTERS, type Segment } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import {
  addGuestToTraining,
  createEvent,
  getImplanterCalendarId,
} from '../integrations/googleCalendar.js';
import {
  createMeeting,
  findOwnerIdByEmail,
  findWelcomeDeal,
  moveDealToStage,
  setMeetingType,
} from '../integrations/hubspot.js';
import { spDateString } from '../lib/implantationPolicy.js';
import { logger } from '../lib/logger.js';
import { toE164 } from '../lib/phone.js';
import type { ImplantationSlotPayload } from '../lib/slotToken.js';
import { isSubjectActive } from '../repositories/agendaRepository.js';
import { insertAuditLog } from '../repositories/auditRepository.js';
import {
  type Implantation,
  UNIQUE_CONSTRAINTS,
  findByIdempotencyKey,
  insertWithCapacity,
  setEvent,
  setHubspotMeetingId,
  uniqueViolationConstraint,
} from '../repositories/implantationRepository.js';

export type ImplantationDispatch = 'calendar' | 'hubspot';

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
      // Modelo de slot: o 1º agendamento do horário CRIA o evento; os demais do
      // mesmo horário entram como convidados no MESMO evento (coletiva = até 8).
      // addGuestToTraining acha o evento já criado por um agendamento anterior;
      // se não existir, este é o primeiro e criamos o evento.
      let result = await addGuestToTraining(
        calendarId,
        new Date(booking.scheduledStart),
        booking.clientEmail,
      );
      if (!result) {
        const coletiva = booking.slotKind !== 'individual';
        result = await createEvent({
          calendarId,
          summary: coletiva
            ? 'Treinamento de implantação (coletiva)'
            : `Implantação — ${booking.companyName}`,
          description: coletiva
            ? 'Sessão coletiva de implantação do Grupo 3C.'
            : `Cliente: ${booking.clientName} — ${booking.companyName}`,
          start: new Date(booking.scheduledStart),
          end: new Date(booking.scheduledEnd),
          attendeeEmail: booking.clientEmail,
        });
      }
      const updated = await setEvent(booking.id, result.eventId, result.meetUrl ?? null);
      booking.googleEventId = updated.googleEventId;
      booking.meetingUrl = updated.meetingUrl;
    } catch (err) {
      logger.warn({ err, implantationId: booking.id }, 'implantation calendar dispatch pending');
      pending.push('calendar');
    }
  }

  // Registro da reunião no HubSpot (objeto Appointment): acha o deal pelo ID 3C
  // na etapa "Boas Vindas", cria o appointment com o vendedor como organizador
  // (se for owner) e associa ao deal + contato. Best-effort → pendência.
  if (!booking.hubspotMeetingId) {
    try {
      const deal = await findWelcomeDeal(booking.clientId ?? '');
      if (!deal) {
        logger.warn({ implantationId: booking.id }, 'hubspot welcome deal not found for client');
        pending.push('hubspot');
      } else {
        const ownerId = await findOwnerIdByEmail(booking.sellerEmail);
        const { meetingId } = await createMeeting({
          title: `Implantação — ${booking.companyName}`,
          startISO: booking.scheduledStart,
          endISO: booking.scheduledEnd,
          ownerId,
          dealId: deal.dealId,
          contactId: deal.contactId,
          companyId: deal.companyId,
        });
        const updated = await setHubspotMeetingId(booking.id, meetingId);
        booking.hubspotMeetingId = updated.hubspotMeetingId;

        // Tipo da reunião (ex.: "Implantação Coletiva" para coletivas).
        const meetingType = HUBSPOT.MEETING_TYPE_BY_SLOT[booking.slotKind];
        if (meetingType) await setMeetingType(meetingId, meetingType);

        // Move o lead para a etapa Implantação do mesmo funil (o n8n vai reagir
        // a essa transição para enviar o e-mail de boas-vindas ao cliente).
        const implStage = HUBSPOT.WELCOME_TO_IMPLANTATION_STAGE[deal.welcomeStageId];
        if (implStage) await moveDealToStage(deal.dealId, implStage);
      }
    } catch (err) {
      logger.warn({ err, implantationId: booking.id }, 'implantation hubspot dispatch pending');
      pending.push('hubspot');
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

  // Agenda do implantador pausada entre ver e enviar → recusa.
  if (!(await isSubjectActive(slot.implanter))) {
    throw new AppError({
      code: 'IMPLANTER_UNAVAILABLE',
      statusCode: 409,
      publicMessage: 'A agenda desse implantador está indisponível no momento. Escolha outro horário.',
    });
  }

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
