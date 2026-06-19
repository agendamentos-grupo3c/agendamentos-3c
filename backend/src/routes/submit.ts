import type { FastifyInstance } from 'fastify';

import { AppError } from '../errors/AppError.js';
import { decodeSlotToken } from '../lib/slotToken.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { submitSchema } from '../schemas/clientForm.js';
import { submitKickoff } from '../services/submitService.js';

export async function submitRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/submit',
    {
      preHandler: [requireAuth, app.csrfProtection],
      // Limite mais agressivo no submit (cenário 7.1.9).
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      // Idempotência (cenário 7.1.8): exige a Idempotency-Key.
      const idempotencyKey = req.headers['idempotency-key'];
      if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
        throw new AppError({
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          statusCode: 400,
          publicMessage: 'Requisição inválida.',
        });
      }

      const parsed = submitSchema.safeParse(req.body);
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

      const result = await submitKickoff({
        sellerEmail: req.user!.email,
        idempotencyKey,
        form: {
          companyName: parsed.data.companyName,
          clientName: parsed.data.clientName,
          integrationSummary: parsed.data.integrationSummary,
          crmName: parsed.data.crmName,
          clientEmail: parsed.data.clientEmail,
          phone: parsed.data.phone,
          demandType: parsed.data.demandType,
        },
        slot,
      });

      // Menor dado possível ao front.
      return reply.status(201).send({
        card: {
          id: result.card.id,
          status: result.card.status,
          scheduledAt: result.card.scheduledAt,
          meetingUrl: result.card.meetingUrl,
        },
        pending: result.pending,
      });
    },
  );
}
