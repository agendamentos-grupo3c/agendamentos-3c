import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { AppError } from '../errors/AppError.js';
import { getCollaboratorForEmail, getRole } from '../lib/roles.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireIntegrator } from '../middlewares/requireIntegrator.js';
import { type Card, listByCollaborator, listBySeller } from '../repositories/cardRepository.js';
import { budgetSchema } from '../schemas/outcome.js';
import { markAttended, markNoShow, sendBudget, type OutcomeResult } from '../services/outcomeService.js';

const paramsSchema = z.object({ id: z.string().uuid() });

// Menor dado possível ao front — sem chaves internas/IDs de integração.
function toPublicCard(card: Card) {
  return {
    id: card.id,
    companyName: card.companyName,
    clientName: card.clientName,
    status: card.status,
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
}
