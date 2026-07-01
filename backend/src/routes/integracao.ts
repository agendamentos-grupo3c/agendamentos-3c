import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { AppError } from '../errors/AppError.js';
import { requireMachineKey } from '../middlewares/requireMachineKey.js';
import { atribuirIntegracao } from '../services/integracaoDistribuicaoService.js';

const atribuirSchema = z.object({
  // Referência única do orçamento PAGO (idempotência: não contabiliza 2x).
  idempotencyKey: z.string().trim().min(1).max(200),
  // Valor líquido pago em reais inteiros (cortesia = 0).
  valor: z.number().int().min(0).max(10_000_000),
  empresa: z.string().trim().max(200).optional(),
  crm: z.string().trim().max(200).optional(),
});

// Chamado pelo n8n no momento do pagamento (máquina-a-máquina, header X-Api-Key).
export async function integracaoRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/integracao/atribuir',
    { preHandler: requireMachineKey, config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req) => {
      const parsed = atribuirSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError({ code: 'BAD_REQUEST', statusCode: 400, publicMessage: 'Dados inválidos.' });
      }
      const r = await atribuirIntegracao({
        idempotencyKey: parsed.data.idempotencyKey,
        valor: parsed.data.valor,
        empresa: parsed.data.empresa ?? null,
        crm: parsed.data.crm ?? null,
      });
      return { integrador: r.integrador, competencia: r.competencia, totais: r.totais, jaAtribuido: r.jaAtribuido };
    },
  );
}
