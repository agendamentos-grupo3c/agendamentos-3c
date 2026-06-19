import type { DemandType } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import { createKickoffTask } from '../integrations/clickup.js';
import { createEvent, getBusyIntervals, getCalendarConfig } from '../integrations/googleCalendar.js';
import { logger } from '../lib/logger.js';
import { toE164 } from '../lib/phone.js';
import type { SlotPayload } from '../lib/slotToken.js';
import { insertAuditLog } from '../repositories/auditRepository.js';
import {
  type Card,
  type DispatchChannel,
  UNIQUE_CONSTRAINTS,
  deleteCard,
  findByIdempotencyKey,
  insertCard,
  markDispatched,
  setClickupTaskId,
  setEvent,
  uniqueViolationConstraint,
} from '../repositories/cardRepository.js';

export interface SubmitKickoffInput {
  sellerEmail: string;
  idempotencyKey: string;
  form: {
    companyName: string;
    clientName: string;
    integrationSummary: string;
    crmName: string;
    clientEmail: string;
    phone: string;
    demandType: DemandType;
  };
  slot: SlotPayload;
}

function slotTaken(): AppError {
  return new AppError({
    code: 'SLOT_TAKEN',
    statusCode: 409,
    publicMessage: 'Esse horário acabou de ser ocupado. Escolha outro horário.',
  });
}

// Notificação delegada ao n8n: nosso app só cria a task no ClickUp (com os
// custom fields); o fluxo n8n da 3C reage e dispara Slack/WhatsApp.
// Best-effort: se falhar, fica pendente para reprocessamento (replay idempotente).
async function runDispatches(card: Card): Promise<DispatchChannel[]> {
  const pending: DispatchChannel[] = [];

  if (!card.clickupSyncedAt) {
    try {
      const { taskId } = await createKickoffTask({
        companyName: card.companyName,
        clientName: card.clientName,
        phoneE164: card.clientPhoneE164,
        description: card.integrationSummary,
        requesterEmail: card.sellerEmail,
        demandType: card.demandType ?? 'integracao',
      });
      await setClickupTaskId(card.id, taskId);
      await markDispatched(card.id, 'clickup');
    } catch (err) {
      logger.warn({ err, cardId: card.id }, 'clickup dispatch pending');
      pending.push('clickup');
    }
  }

  return pending;
}

export interface SubmitResult {
  card: Card;
  pending: DispatchChannel[];
}

export async function submitKickoff(input: SubmitKickoffInput): Promise<SubmitResult> {
  // Replay idempotente: mesma Idempotency-Key não recria nada; apenas reprocessa
  // o que ainda estiver pendente.
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return { card: existing, pending: await runDispatches(existing) };
  }

  const cfg = getCalendarConfig();
  const calendarId = input.slot.collaborator === 'alana' ? cfg.alanaId : cfg.guilhermeId;
  const start = new Date(input.slot.startISO);
  const end = new Date(input.slot.endISO);

  // Proteção contra corrida com mudanças externas na agenda (cenário 7.1.12).
  const busy = await getBusyIntervals(calendarId, start, end);
  const conflict = busy.some(
    (b) => start.getTime() < new Date(b.end).getTime() && new Date(b.start).getTime() < end.getTime(),
  );
  if (conflict) throw slotTaken();

  // Reserva: o índice único (assigned_to, scheduled_at) trava corrida entre dois
  // vendedores; o índice de idempotency_key trava submit duplicado.
  let card: Card;
  try {
    card = await insertCard({
      companyName: input.form.companyName,
      clientName: input.form.clientName,
      integrationSummary: input.form.integrationSummary,
      crmName: input.form.crmName,
      clientEmail: input.form.clientEmail,
      clientPhoneE164: toE164(input.form.phone),
      sellerEmail: input.sellerEmail,
      assignedTo: input.slot.collaborator,
      scheduledAt: input.slot.startISO,
      demandType: input.form.demandType,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (err) {
    const constraint = uniqueViolationConstraint(err);
    if (constraint === UNIQUE_CONSTRAINTS.IDEMPOTENCY) {
      const dup = await findByIdempotencyKey(input.idempotencyKey);
      if (dup) return { card: dup, pending: await runDispatches(dup) };
    }
    if (constraint === UNIQUE_CONSTRAINTS.SLOT) throw slotTaken();
    throw err;
  }

  // Evento é crítico: se falhar, libera o slot (apaga o card) e aborta.
  try {
    const event = await createEvent({
      calendarId,
      summary: `Kickoff integração — ${card.companyName}`,
      description: `Cliente: ${card.clientName}\nCRM: ${card.crmName}\nResumo: ${card.integrationSummary}\nVendedor: ${card.sellerEmail}`,
      start,
      end,
      attendeeEmail: card.clientEmail,
    });
    card = await setEvent(card.id, event);
  } catch (err) {
    await deleteCard(card.id);
    if (err instanceof AppError) throw err;
    throw new AppError({
      code: 'SUBMIT_EVENT_FAILED',
      statusCode: 502,
      publicMessage: 'Não foi possível criar o evento na agenda. Tente novamente.',
      cause: err,
    });
  }

  await insertAuditLog({
    actorEmail: input.sellerEmail,
    action: 'card.created',
    cardId: card.id,
    toStatus: 'kickoff',
  });

  return { card, pending: await runDispatches(card) };
}
