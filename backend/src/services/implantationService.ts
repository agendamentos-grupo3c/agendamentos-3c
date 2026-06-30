import {
  HUBSPOT,
  IMPLANTATION_CAPACITY,
  MEETING_TYPE_BY_KIND,
  PRODUCT_LABELS,
  SEGMENT_IMPLANTERS,
  kindForSegment,
  type ImplantationProduct,
  type Segment,
} from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import {
  addGuestToTraining,
  createEvent,
  getBusyIntervals,
  getImplanterCalendarId,
} from '../integrations/googleCalendar.js';
import {
  createMeeting,
  findOwnerIdByEmail,
  findWelcomeDeal,
  moveDealToStage,
  patchMeeting,
} from '../integrations/hubspot.js';
import { notifyImplantationScheduled } from '../integrations/n8n.js';
import { spDateString } from '../lib/implantationPolicy.js';
import { logger } from '../lib/logger.js';
import { toE164 } from '../lib/phone.js';
import type { ImplantationSlotPayload } from '../lib/slotToken.js';
import { isSubjectActive } from '../repositories/agendaRepository.js';
import { insertAuditLog } from '../repositories/auditRepository.js';
import {
  type Implantation,
  UNIQUE_CONSTRAINTS,
  countForSession,
  findByIdempotencyKey,
  insertWithCapacity,
  listBySessionStart,
  markN8nNotified,
  setEvent,
  setHubspotMeetingId,
  uniqueViolationConstraint,
} from '../repositories/implantationRepository.js';

export type ImplantationDispatch = 'calendar' | 'hubspot' | 'n8n';

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
    product: ImplantationProduct;
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
        const coletiva = kindForSegment(booking.segment) === 'coletiva';
        const productLabel = booking.product ? PRODUCT_LABELS[booking.product] : 'Implantação';
        result = await createEvent({
          calendarId,
          // Nome diferencia o produto, para organização da agenda.
          summary: coletiva
            ? `Implantação ${productLabel} (coletiva)`
            : `Implantação ${productLabel} — ${booking.companyName}`,
          description: coletiva
            ? `Sessão coletiva de implantação (${productLabel}) do Grupo 3C.`
            : `Cliente: ${booking.clientName} — ${booking.companyName} (${productLabel})`,
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
        // Responsável = o IMPLANTADOR (a reunião é da agenda dele). O e-mail do
        // implantador é o mesmo do calendário/owner no HubSpot.
        const ownerId = await findOwnerIdByEmail(getImplanterCalendarId(booking.implanter));
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

        // Move o lead para a etapa Implantação do mesmo funil (gatilho do n8n
        // para o e-mail de boas-vindas) — prioritário.
        const implStage = HUBSPOT.WELCOME_TO_IMPLANTATION_STAGE[deal.welcomeStageId];
        if (implStage) await moveDealToStage(deal.dealId, implStage);

        // Tipo da reunião + link do Meet na "localização". Best-effort isolado:
        // não pode bloquear o move de etapa nem o agendamento.
        const props: Record<string, string> = {};
        props.hs_activity_type = MEETING_TYPE_BY_KIND[kindForSegment(booking.segment)];
        if (booking.meetingUrl) props.hs_meeting_location = booking.meetingUrl;
        if (Object.keys(props).length > 0) {
          try {
            await patchMeeting(meetingId, props);
          } catch (err) {
            logger.warn({ err, implantationId: booking.id }, 'hubspot meeting patch pending');
          }
        }
      }
    } catch (err) {
      logger.warn({ err, implantationId: booking.id }, 'implantation hubspot dispatch pending');
      pending.push('hubspot');
    }
  }

  // n8n: avisa o agendamento (WhatsApp de boas-vindas ao cliente + Slack do time).
  // Por último, para já ter o meetingUrl (link do Meet) do passo do calendário.
  if (!booking.n8nNotifiedAt) {
    try {
      const occupied = await countForSession(booking.implanter, booking.scheduledStart);
      const capacity = IMPLANTATION_CAPACITY[kindForSegment(booking.segment)];
      await notifyImplantationScheduled({
        tipo: 'agendada',
        companyName: booking.companyName,
        clientName: booking.clientName,
        clientEmail: booking.clientEmail,
        clientPhoneE164: booking.clientPhoneE164,
        segment: booking.segment,
        implanter: booking.implanter,
        product: booking.product ?? '',
        scheduledStartISO: booking.scheduledStart,
        meetingUrl: booking.meetingUrl,
        sellerEmail: booking.sellerEmail,
        sellerName: booking.sellerName,
        occupied,
        capacity,
      });
      await markN8nNotified(booking.id);
    } catch (err) {
      logger.warn({ err, implantationId: booking.id }, 'implantation n8n dispatch pending');
      pending.push('n8n');
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

  const { segment, product } = input.form;
  const { slot } = input;

  // O implantador do token tem que atender o segmento e o produto do token tem
  // que casar com o do formulário (token é assinado; validamos a coerência).
  if (!SEGMENT_IMPLANTERS[segment].includes(slot.implanter)) throw invalidSlot();
  if (slot.product !== product) throw invalidSlot();

  // Agenda do implantador pausada entre ver e enviar → recusa.
  if (!(await isSubjectActive(slot.implanter))) {
    throw new AppError({
      code: 'IMPLANTER_UNAVAILABLE',
      statusCode: 409,
      publicMessage: 'A agenda desse implantador está indisponível no momento. Escolha outro horário.',
    });
  }

  const capacity = IMPLANTATION_CAPACITY[kindForSegment(segment)];

  // Trava anti-corrida com a agenda real: se NÃO for entrar numa sessão nossa do
  // mesmo produto com vaga, o horário precisa estar livre no Google Calendar do
  // implantador (pega compromissos externos criados entre ver e enviar).
  const sessionRows = await listBySessionStart(slot.implanter, slot.startISO);
  const joinable =
    sessionRows.length > 0 && sessionRows[0]!.product === product && sessionRows.length < capacity;
  if (!joinable) {
    let busyCount: number;
    try {
      const busy = await getBusyIntervals(
        getImplanterCalendarId(slot.implanter),
        new Date(slot.startISO),
        new Date(slot.endISO),
      );
      busyCount = busy.length;
    } catch {
      // freeBusy falhou → fail-closed: não abrir sessão sem confirmar a agenda.
      throw new AppError({
        code: 'IMPLANTER_CALENDAR_UNAVAILABLE',
        statusCode: 503,
        publicMessage: 'Não foi possível confirmar a agenda do implantador agora. Tente novamente.',
      });
    }
    if (busyCount > 0) {
      throw new AppError({
        code: 'IMPLANTER_BUSY',
        statusCode: 409,
        publicMessage: 'Esse horário ficou indisponível na agenda do implantador. Escolha outro.',
      });
    }
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
        product,
        scheduledStart: slot.startISO,
        scheduledEnd: slot.endISO,
        sellerEmail: input.sellerEmail,
        sellerName: input.sellerName,
        idempotencyKey: input.idempotencyKey,
      },
      capacity,
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
      product: booking.product,
      slotDate: booking.slotDate,
    },
  });

  return { booking, pending: await runDispatches(booking) };
}
