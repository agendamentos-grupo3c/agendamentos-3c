import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { AppError } from '../errors/AppError.js';
import { getCollaboratorForEmail, getRole } from '../lib/roles.js';
import { decodeSlotToken } from '../lib/slotToken.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireIntegrator } from '../middlewares/requireIntegrator.js';
import { type Card, listByCollaborator, listBySeller } from '../repositories/cardRepository.js';
import { budgetSchema } from '../schemas/outcome.js';
import {
  markAttended,
  markNoShow,
  rescheduleCard,
  sendBudget,
  type OutcomeResult,
} from '../services/outcomeService.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const rescheduleSchema = z.object({ slotToken: z.string().min(1) });

// Menor dado possível ao front — sem chaves internas/IDs de integração.
function toPublicCard(card: Card) {
  return {
    id: card.id,
    companyName: card.companyName,
    clientName: card.clientName,
    status: card.status,
    assignedTo: card.assignedTo,
    scheduledAt: card.scheduledAt,
    meetingUrl: card.meetingUrl,
    requiredIntegration: card.requiredIntegration,
    budget: card.budget,
    productionDeadline: card.productionDeadline,
  };
}

function parseId(params: unknown): string {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    throw new AppError({ code: 'CARD_NOT_FOUND', statusCode: 404, publicMessage: 'Card não encontrado.' });
  }
  return parsed.data.id;
}

function outcomeResponse(result: OutcomeResult) {
  return { card: toPublicCard(result.card), pending: result.pending };
}

export async function cardRoutes(app: FastifyInstance): Promise<void> {
  // Vendedor vê os próprios agendamentos (leitura); integrador vê os da sua coluna.
  app.get('/cards', { preHandler: requireAuth }, async (req) => {
    const email = req.user!.email;
    const cards =
      getRole(email) === 'integrator'
        ? await listByCollaborator(getCollaboratorForEmail(email)!)
        : await listBySeller(email);
    return cards.map(toPublicCard);
  });

  // Desfechos: somente integradores (requireIntegrator após requireAuth).
  app.post(
    '/cards/:id/attended',
    { preHandler: [requireAuth, app.csrfProtection, requireIntegrator] },
    async (req) => outcomeResponse(await markAttended(parseId(req.params), req.user!.email)),
  );

  app.post(
    '/cards/:id/no-show',
    { preHandler: [requireAuth, app.csrfProtection, requireIntegrator] },
    async (req) => outcomeResponse(await markNoShow(parseId(req.params), req.user!.email)),
  );

  app.post(
    '/cards/:id/budget',
    { preHandler: [requireAuth, app.csrfProtection, requireIntegrator] },
    async (req) => {
    const id = parseId(req.params);
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError({ code: 'BAD_REQUEST', statusCode: 400, publicMessage: 'Dados inválidos.' });
    }
    return outcomeResponse(await sendBudget(id, req.user!.email, parsed.data));
  });

  // Reagendamento de um card em no-show: ação do vendedor (não do integrador);
  // a posse do card é validada no service. Sem requireIntegrator aqui.
  app.post(
    '/cards/:id/reschedule',
    { preHandler: [requireAuth, app.csrfProtection] },
    async (req) => {
      const id = parseId(req.params);
      const parsed = rescheduleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError({ code: 'BAD_REQUEST', statusCode: 400, publicMessage: 'Dados inválidos.' });
      }
      const slot = decodeSlotToken(parsed.data.slotToken);
      if (!slot) {
        throw new AppError({
          code: 'INVALID_SLOT',
          statusCode: 400,
          publicMessage: 'Horário inválido. Recarregue a agenda e tente novamente.',
        });
      }
      return outcomeResponse(await rescheduleCard(id, req.user!.email, slot));
    },
  );
}
