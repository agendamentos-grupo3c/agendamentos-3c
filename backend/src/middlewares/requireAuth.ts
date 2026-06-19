import type { FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '../errors/AppError.js';
import { readSessionCookie, verifySessionToken } from '../lib/session.js';

function unauthenticated(): AppError {
  return new AppError({
    code: 'UNAUTHENTICATED',
    statusCode: 401,
    publicMessage: 'Sessão inválida ou expirada.',
  });
}

// Toda rota protegida revalida a sessão no servidor (cenários 7.1: 5 e 6).
// O front-end não é fonte de verdade de autorização.
export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = readSessionCookie(req);
  if (!token) {
    throw unauthenticated();
  }
  try {
    req.user = await verifySessionToken(token);
  } catch {
    throw unauthenticated();
  }
}
