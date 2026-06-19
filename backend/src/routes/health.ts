import type { FastifyInstance } from 'fastify';

// Healthcheck público — sem dados sensíveis, usado por Render/monitoração.
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({ status: 'ok' }));
}
