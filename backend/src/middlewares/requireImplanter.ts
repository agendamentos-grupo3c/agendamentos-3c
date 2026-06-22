import type { FastifyReply, FastifyRequest } from 'fastify';

import { AppError } from '../errors/AppError.js';
import { isImplanter } from '../lib/roles.js';

// Deve rodar APÓS requireAuth. Bloqueia quem não é implantador nas ações de
// desfecho da implantação (a verificação do dono específico é feita no service).
export async function requireImplanter(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!req.user || !isImplanter(req.user.email)) {
    throw new AppError({
      code: 'FORBIDDEN',
      statusCode: 403,
      publicMessage: 'Ação permitida apenas ao time de Implantação.',
    });
  }
}
