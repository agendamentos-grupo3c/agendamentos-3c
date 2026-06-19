import { CLICKUP_STATUS } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import { setBudgetField, updateTaskStatus } from '../integrations/clickup.js';
import { canTransition } from '../lib/cardStateMachine.js';
import { logger } from '../lib/logger.js';
import { insertAuditLog } from '../repositories/auditRepository.js';
import {
  type Card,
  findById,
  saveBudgetAndSend,
  transitionStatus,
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
