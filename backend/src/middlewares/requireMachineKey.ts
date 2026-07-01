import { timingSafeEqual } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Autenticação máquina-a-máquina (n8n → API) por chave no header X-Api-Key.
// Não usa sessão/cookie (por isso não há CSRF). Comparação em tempo constante.
export async function requireMachineKey(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const provided = req.headers['x-api-key'];
  const expected = env.INTEGRACAO_API_KEY;
  if (!expected || typeof provided !== 'string' || !safeEqual(provided, expected)) {
    throw new AppError({ code: 'UNAUTHORIZED', statusCode: 401, publicMessage: 'Não autorizado.' });
  }
}
