import type { FastifyInstance } from 'fastify';

import { AppError } from '../errors/AppError.js';
import { isAdmin } from '../lib/roles.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { listAgendaLog } from '../repositories/agendaRepository.js';
import { getAgendaState, toggleAgenda } from '../services/agendaService.js';

export async function agendaRoutes(app: FastifyInstance): Promise<void> {
  // Estado da própria agenda (para o botão de pausar/reativar).
  app.get('/agenda/status', { preHandler: requireAuth }, async (req) =>
    getAgendaState(req.user!.email),
  );

  // Pausa/reativa a própria agenda.
  app.post(
    '/agenda/toggle',
    { preHandler: [requireAuth, app.csrfProtection] },
    async (req) => toggleAgenda(req.user!.email),
  );

  // Log de pausas/reativações — somente admins.
  app.get('/agenda/log', { preHandler: requireAuth }, async (req) => {
    if (!isAdmin(req.user!.email)) {
      throw new AppError({ code: 'FORBIDDEN', statusCode: 403, publicMessage: 'Acesso restrito.' });
    }
    return listAgendaLog();
  });
}
