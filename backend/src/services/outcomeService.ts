import { CLICKUP, CLICKUP_CANCELED_STATUS, CLICKUP_STATUS, SCHEDULING } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import {
  addTaskComment,
  changeTaskAssignee,
  setBudgetField,
  updateTaskStatus,
} from '../integrations/clickup.js';
import {
  createEvent,
  deleteEvent,
  getBusyIntervals,
  getCalendarConfig,
} from '../integrations/googleCalendar.js';
import { canTransition } from '../lib/cardStateMachine.js';
import { logger } from '../lib/logger.js';
import { getCollaboratorForEmail } from '../lib/roles.js';
import type { SlotPayload } from '../lib/slotToken.js';
import { insertAuditLog } from '../repositories/auditRepository.js';
import {
  type Card,
  deleteCard,
  findById,
  rescheduleCardRow,
  saveBudgetAndSend,
  transitionStatus,
  UNIQUE_CONSTRAINTS,
  uniqueViolationConstraint,
} from '../repositories/cardRepository.js';
import type { BudgetInput } from '../schemas/outcome.js';

type OutcomeChannel = 'clickup';

export interface OutcomeResult {
  card: Card;
  pending: OutcomeChannel[];
}

function cardNotFound(): AppError {
  return new AppError({ code: 'CARD_NOT_FOUND', statusCode: 404, publicMessage: 'Card não encontrado.' });
}

function invalidTransition(): AppError {
  return new AppError({
    code: 'INVALID_TRANSITION',
    statusCode: 409,
    publicMessage: 'Transição de status inválida.',
  });
}

// Reflete a mudança de status no ClickUp (o n8n reage e dispara Slack/WhatsApp).
// Best-effort: falha não desfaz a transição já persistida; vira pendência.
async function syncClickupStatus(card: Card): Promise<OutcomeChannel[]> {
  const status = CLICKUP_STATUS[card.status];
  if (!card.clickupTaskId || !status) return [];
  try {
    await updateTaskStatus(card.clickupTaskId, status);
    return [];
  } catch (err) {
    logger.warn({ err, cardId: card.id }, 'clickup outcome pending');
    return ['clickup'];
  }
}

export async function markAttended(cardId: string, actorEmail: string): Promise<OutcomeResult> {
  const card = await findById(cardId);
  if (!card) throw cardNotFound();
  if (!canTransition(card.status, 'compareceu')) throw invalidTransition();

  const updated = await transitionStatus(cardId, card.status, 'compareceu');
  if (!updated) throw invalidTransition();

  await insertAuditLog({
    actorEmail,
    action: 'card.attended',
    cardId,
    fromStatus: card.status,
    toStatus: 'compareceu',
  });

  // "compareceu" é estado interno: sem reflexo no ClickUp.
  return { card: updated, pending: [] };
}

export async function markNoShow(cardId: string, actorEmail: string): Promise<OutcomeResult> {
  const card = await findById(cardId);
  if (!card) throw cardNotFound();
  if (!canTransition(card.status, 'no_show')) throw invalidTransition();

  const updated = await transitionStatus(cardId, card.status, 'no_show');
  if (!updated) throw invalidTransition();

  await insertAuditLog({
    actorEmail,
    action: 'card.no_show',
    cardId,
    fromStatus: card.status,
    toStatus: 'no_show',
  });

  return { card: updated, pending: await syncClickupStatus(updated) };
}

export async function sendBudget(
  cardId: string,
  actorEmail: string,
  fields: BudgetInput,
): Promise<OutcomeResult> {
  const card = await findById(cardId);
  if (!card) throw cardNotFound();
  if (!canTransition(card.status, 'orcamento_enviado')) throw invalidTransition();

  const updated = await saveBudgetAndSend(cardId, fields);
  if (!updated) throw invalidTransition();

  await insertAuditLog({
    actorEmail,
    action: 'card.budget_sent',
    cardId,
    fromStatus: card.status,
    toStatus: 'orcamento_enviado',
  });

  // Atualiza status + valor monetário no ClickUp (n8n dispara o aviso).
  const pending: OutcomeChannel[] = [];
  if (updated.clickupTaskId) {
    try {
      await updateTaskStatus(updated.clickupTaskId, CLICKUP_STATUS.orcamento_enviado!);
      await setBudgetField(updated.clickupTaskId, fields.budget);
    } catch (err) {
      logger.warn({ err, cardId: updated.id }, 'clickup budget outcome pending');
      pending.push('clickup');
    }
  }

  return { card: updated, pending };
}

// Exclusão de um agendamento pelo integrador dono da coluna. O lead vai para a
// etapa "cancelado" no ClickUp (registro preservado lá) e o card é removido da
// nossa base, liberando o slot e cancelando o convite do cliente.
export async function deleteCardAsIntegrator(cardId: string, actorEmail: string): Promise<void> {
  const card = await findById(cardId);
  if (!card) throw cardNotFound();

  // Autorização horizontal: cada integrador só age na própria coluna.
  if (getCollaboratorForEmail(actorEmail) !== card.assignedTo) {
    throw new AppError({
      code: 'FORBIDDEN',
      statusCode: 403,
      publicMessage: 'Você só pode excluir agendamentos da sua coluna.',
    });
  }

  // ClickUp → "cancelado" PRIMEIRO: se falhar, abortamos sem excluir nada, para
  // o integrador poder tentar de novo (nada fica em estado inconsistente).
  if (card.clickupTaskId) {
    await updateTaskStatus(card.clickupTaskId, CLICKUP_CANCELED_STATUS);
  }

  // Remove o evento do calendário (cancela o convite do cliente). Best-effort.
  if (card.googleEventId) {
    const cfg = getCalendarConfig();
    const calendarId = card.assignedTo === 'alana' ? cfg.alanaId : cfg.guilhermeId;
    try {
      await deleteEvent(calendarId, card.googleEventId);
    } catch (err) {
      logger.warn({ err, cardId }, 'delete card calendar event pending');
    }
  }

  // Auditoria antes do delete: o card_id é anulado (ON DELETE SET NULL), então
  // guardamos os dados identificadores no metadata.
  await insertAuditLog({
    actorEmail,
    action: 'card.deleted',
    cardId,
    fromStatus: card.status,
    metadata: {
      companyName: card.companyName,
      clientName: card.clientName,
      scheduledAt: card.scheduledAt,
      assignedTo: card.assignedTo,
    },
  });

  await deleteCard(cardId);
}

const whenFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SCHEDULING.TIMEZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

const COLLABORATOR_LABELS: Record<Card['assignedTo'], string> = {
  alana: 'Alana Gaspar',
  guilherme: 'Guilherme Ribeiro',
};

function slotTaken(): AppError {
  return new AppError({
    code: 'SLOT_TAKEN',
    statusCode: 409,
    publicMessage: 'Esse horário acabou de ser ocupado. Escolha outro horário.',
  });
}

// Reagendamento de um kickoff após no-show (cenário pós-reunião). Ação do
// vendedor dono do card: pode escolher QUALQUER integrador (em kickoff ainda não
// houve contato), mesma tarefa do ClickUp. Cria o novo evento na agenda do
// integrador escolhido (reenvia o convite ao cliente), libera o antigo, atualiza
// o responsável (no banco e no ClickUp) e volta o status para "kickoff" — o fluxo
// n8n reage à transição "no show → kickoff" e notifica o time como reagendamento.
export async function rescheduleCard(
  cardId: string,
  actorEmail: string,
  slot: SlotPayload,
): Promise<OutcomeResult> {
  const card = await findById(cardId);
  if (!card) throw cardNotFound();

  // Só o vendedor dono reagenda o próprio card (autorização horizontal).
  if (card.sellerEmail !== actorEmail) {
    throw new AppError({
      code: 'FORBIDDEN',
      statusCode: 403,
      publicMessage: 'Apenas o vendedor responsável pode reagendar este card.',
    });
  }

  if (!canTransition(card.status, 'kickoff')) throw invalidTransition();

  const cfg = getCalendarConfig();
  const calendarFor = (c: typeof card.assignedTo): string =>
    c === 'alana' ? cfg.alanaId : cfg.guilhermeId;
  const oldCalendarId = calendarFor(card.assignedTo);
  const newCalendarId = calendarFor(slot.collaborator);
  const collaboratorChanged = slot.collaborator !== card.assignedTo;
  const start = new Date(slot.startISO);
  const end = new Date(slot.endISO);

  // Proteção contra corrida com mudanças externas na agenda (cenário 7.1.12).
  const busy = await getBusyIntervals(newCalendarId, start, end);
  const conflict = busy.some(
    (b) => start.getTime() < new Date(b.end).getTime() && new Date(b.start).getTime() < end.getTime(),
  );
  if (conflict) throw slotTaken();

  // Cria o novo evento na agenda do integrador escolhido (reenvia o convite ao
  // cliente). Só depois reservamos o slot no banco — se a reserva falhar
  // (corrida), apagamos o evento recém-criado.
  const event = await createEvent({
    calendarId: newCalendarId,
    summary: `Kickoff integração — ${card.companyName}`,
    description: `Cliente: ${card.clientName}\nCRM: ${card.crmName}\nResumo: ${card.integrationSummary}\nVendedor: ${card.sellerEmail}\n(Reagendamento)`,
    start,
    end,
    attendeeEmail: card.clientEmail,
  });

  let updated: Card | null;
  try {
    updated = await rescheduleCardRow(cardId, card.status, slot.startISO, slot.collaborator, event);
  } catch (err) {
    if (uniqueViolationConstraint(err) === UNIQUE_CONSTRAINTS.SLOT) {
      await deleteEvent(newCalendarId, event.eventId).catch(() => undefined);
      throw slotTaken();
    }
    await deleteEvent(newCalendarId, event.eventId).catch(() => undefined);
    throw err;
  }
  if (!updated) {
    // Outro processo já mudou o status: desfaz o evento órfão.
    await deleteEvent(newCalendarId, event.eventId).catch(() => undefined);
    throw invalidTransition();
  }

  // Libera o evento antigo (no horário do no-show, na agenda do integrador
  // anterior). Best-effort: falha aqui não invalida o reagendamento persistido.
  if (card.googleEventId) {
    try {
      await deleteEvent(oldCalendarId, card.googleEventId);
    } catch (err) {
      logger.warn({ err, cardId }, 'reschedule old event delete pending');
    }
  }

  await insertAuditLog({
    actorEmail,
    action: 'card.rescheduled',
    cardId,
    fromStatus: card.status,
    toStatus: 'kickoff',
    metadata: { from: card.scheduledAt, to: slot.startISO },
  });

  const pending: OutcomeChannel[] = [];

  // ClickUp: volta o status para kickoff (o n8n reage e notifica como
  // reagendamento) e registra o aviso na MESMA tarefa, sem criar tarefa nova.
  // Best-effort → pendência se falhar.
  if (card.clickupTaskId) {
    try {
      await updateTaskStatus(card.clickupTaskId, CLICKUP_STATUS.kickoff!);
      await addTaskComment(
        card.clickupTaskId,
        collaboratorChanged
          ? `Reunião reagendada para ${whenFmt.format(start)} com ${COLLABORATOR_LABELS[slot.collaborator]} (após no-show).`
          : `Reunião reagendada para ${whenFmt.format(start)} (após no-show).`,
      );
      // Troca o responsável no ClickUp quando muda o integrador.
      if (collaboratorChanged) {
        await changeTaskAssignee(
          card.clickupTaskId,
          CLICKUP.INTEGRATOR_USER_ID[slot.collaborator],
          [CLICKUP.INTEGRATOR_USER_ID[card.assignedTo]],
        );
      }
    } catch (err) {
      logger.warn({ err, cardId }, 'clickup reschedule pending');
      pending.push('clickup');
    }
  }

  return { card: updated, pending };
}
