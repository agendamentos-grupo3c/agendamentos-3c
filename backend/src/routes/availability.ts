import type { FastifyInstance } from 'fastify';

import { requireAuth } from '../middlewares/requireAuth.js';
import { getAvailability } from '../services/availabilityService.js';

export async function availabilityRoutes(app: FastifyInstance): Promise<void> {
  app.get('/availability', { preHandler: requireAuth }, async () => getAvailability(new Date()));
}
