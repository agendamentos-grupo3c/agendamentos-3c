import { SCHEDULING, STATUS_LABELS } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import { updateTaskStatus } from '../integrations/clickup.js';
import { sendToChannels } from '../integrations/slack.js';
import { canTransition } from '../lib/cardStateMachine.js';
import { logger } from '../lib/logger.js';
import type { Collaborator } from '../lib/schedulingPolicy.js';
import { insertAuditLog } from '../repositories/auditRepository.js';
import {
  type Card,
  findById,
  saveBudgetAndSend,
  transitionStatus,
} from '../repositories/cardRepository.js';
import type { BudgetInput } from '../schemas/outcome.js';

type OutcomeChannel = 'slack' | 'clickup';

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

// Reflete a mudança de status no Slack e no ClickUp (seção 7.7). Best-effort:
// falha de notificação não desfaz a transição já persistida; vira pendência.
async function syncOutcome(card: Card, slackText: string): Promise<OutcomeChannel[]> {
  const pending: OutcomeChannel[] = [];

  try {
    await sendToChannels(slackText);
  } catch (err) {
    logger.warn({ err, cardId: card.id }, 'slack outcome pending');
    pending.push('slack');
  }

  if (card.clickupTaskId) {
    try {
      await updateTaskStatus(card.clickupTaskId, STATUS_LABELS[card.status]);
    } catch (err) {
      logger.warn({ err, cardId: card.id }, 'clickup outcome pending');
      pending.push('clickup');
    }
  }

  return pending;
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

  // "compareceu" é estado interno: sem Slack/ClickUp (seção 7.7 sincroniza
  // kickoff, no-show e orçamento enviado).
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

  const text = [
    `*No-show* — status: ${STATUS_LABELS.no_show}`,
    `*Empresa:* ${updated.companyName}`,
    `*Cliente:* ${updated.clientName}`,
    `*Responsável:* ${collaboratorLabel(updated.assignedTo)}`,
    `*Quando:* ${whenLabel(updated)}`,
    `*Vendedor:* ${updated.sellerEmail}`,
  ].join('\n');

  return { card: updated, pending: await syncOutcome(updated, text) };
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

  const text = [
    `*Orçamento enviado* — status: ${STATUS_LABELS.orcamento_enviado}`,
    `*Empresa:* ${updated.companyName}`,
    `*Cliente:* ${updated.clientName}`,
    `*Integração:* ${updated.requiredIntegration ?? ''}`,
    `*Orçamento:* ${updated.budget ?? ''}`,
    `*Prazo de produção:* ${updated.productionDeadline ?? ''}`,
    `*Responsável:* ${collaboratorLabel(updated.assignedTo)}`,
    `*Vendedor:* ${updated.sellerEmail}`,
  ].join('\n');

  return { card: updated, pending: await syncOutcome(updated, text) };
}
