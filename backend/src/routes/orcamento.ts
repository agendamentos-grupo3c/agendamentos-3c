import type { FastifyInstance } from 'fastify';

import { AppError } from '../errors/AppError.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { orcamentoSubmitSchema } from '../schemas/orcamento.js';
import { enviarOrcamento } from '../services/orcamentoService.js';

export async function orcamentoRoutes(app: FastifyInstance): Promise<void> {
  // Envia o orçamento de integração ao n8n (ClickSign + boleto). Limite agressivo
  // e idempotência por header, repassada ao n8n para deduplicar retries.
  app.post(
    '/orcamento',
    {
      preHandler: [requireAuth, app.csrfProtection],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req) => {
      const idempotencyKey = req.headers['idempotency-key'];
      if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
        throw new AppError({
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          statusCode: 400,
          publicMessage: 'Requisição inválida.',
        });
      }

      const parsed = orcamentoSubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError({ code: 'BAD_REQUEST', statusCode: 400, publicMessage: 'Dados inválidos.' });
      }

      const result = await enviarOrcamento({
        actorEmail: req.user!.email,
        actorName: req.user!.name,
        idempotencyKey,
        form: parsed.data,
      });

      return result;
    },
  );
}
