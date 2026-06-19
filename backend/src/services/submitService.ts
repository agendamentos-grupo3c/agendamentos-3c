import { SCHEDULING, STATUS_LABELS } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import { createTask } from '../integrations/clickup.js';
import { sendWhatsapp } from '../integrations/dizparos.js';
import { createEvent, getBusyIntervals, getCalendarConfig } from '../integrations/googleCalendar.js';
import { sendToChannels } from '../integrations/slack.js';
import { logger } from '../lib/logger.js';
import { toE164 } from '../lib/phone.js';
import type { Collaborator } from '../lib/schedulingPolicy.js';
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

const whenFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SCHEDULING.TIMEZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

function collaboratorLabel(c: Collaborator): string {
  return c === 'alana' ? 'Alana Gaspar' : 'Guilherme Ribeiro';
}

function whenLabel(card: Card): string {
  return card.scheduledAt ? whenFmt.format(new Date(card.scheduledAt)) : '';
}

function slackText(card: Card): string {
  return [
    `*Novo kickoff agendado* — status: ${STATUS_LABELS.kickoff}`,
    `*Empresa:* ${card.companyName}`,
    `*Cliente:* ${card.clientName} (${card.clientEmail})`,
    `*Telefone:* ${card.clientPhoneE164}`,
    `*CRM:* ${card.crmName}`,
    `*Integração:* ${card.integrationSummary}`,
    `*Responsável:* ${collaboratorLabel(card.assignedTo)}`,
    `*Quando:* ${whenLabel(card)}`,
    `*Vendedor:* ${card.sellerEmail}`,
    card.meetingUrl ? `*Meet:* ${card.meetingUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function whatsappMessage(card: Card): string {
  return (
    `Olá! Sua reunião de kickoff de integração com o Grupo 3C foi agendada para ${whenLabel(card)}.` +
    (card.meetingUrl ? ` Link da reunião: ${card.meetingUrl}.` : '') +
    ' O convite também foi enviado ao seu e-mail.'
  );
}

function clickupDescription(card: Card): string {
  return [
    `Cliente: ${card.clientName}`,
    `E-mail: ${card.clientEmail}`,
    `Telefone: ${card.clientPhoneE164}`,
    `CRM: ${card.crmName}`,
    `Integração: ${card.integrationSummary}`,
    `Quando: ${whenLabel(card)}`,
    `Responsável: ${collaboratorLabel(card.assignedTo)}`,
    `Vendedor: ${card.sellerEmail}`,
  ].join('\n');
}

// Disparos best-effort: cada canal é independente; falha não derruba o submit,
// só fica pendente para reprocessamento (cenários 7.1.17/18). Idempotente: só
// dispara o que ainda não foi marcado como concluído.
async function runDispatches(card: Card): Promise<DispatchChannel[]> {
  const pending: DispatchChannel[] = [];

  if (!card.slackNotifiedAt) {
    try {
      await sendToChannels(slackText(card));
      await markDispatched(card.id, 'slack');
    } catch (err) {
      logger.warn({ err, cardId: card.id }, 'slack dispatch pending');
      pending.push('slack');
    }
  }

  if (!card.whatsappSentAt) {
    try {
      await sendWhatsapp(card.clientPhoneE164, whatsappMessage(card));
      await markDispatched(card.id, 'whatsapp');
    } catch (err) {
      logger.warn({ err, cardId: card.id }, 'whatsapp dispatch pending');
      pending.push('whatsapp');
    }
  }

  if (!card.clickupSyncedAt) {
    try {
      const { taskId } = await createTask({
        name: `${card.companyName} — Kickoff`,
        description: clickupDescription(card),
        status: STATUS_LABELS.kickoff,
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
  // disparos que ainda estejam pendentes.
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

  // Evento é crítico: se falhar, libera o slot (apaga o card) e aborta — sem
  // deixar card inconsistente (sem evento).
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
