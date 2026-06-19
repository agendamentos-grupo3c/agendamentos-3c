import type { FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '../errors/AppError.js';
import { getRole } from '../lib/roles.js';

// Deve rodar APÓS requireAuth (que preenche req.user). Bloqueia vendedores nas
// ações de desfecho — a trava real de autorização (não confiar no front).
export async function requireIntegrator(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!req.user || getRole(req.user.email) !== 'integrator') {
    throw new AppError({
      code: 'FORBIDDEN',
      statusCode: 403,
      publicMessage: 'Ação permitida apenas ao time de integrações.',
    });
  }
}
