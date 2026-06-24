import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import csrfProtection from '@fastify/csrf-protection';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { CORS, RATE_LIMIT } from './config/constants.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './errors/errorHandler.js';
import { logger } from './lib/logger.js';
import { agendaRoutes } from './routes/agenda.js';
import { authRoutes } from './routes/auth.js';
import { availabilityRoutes } from './routes/availability.js';
import { cardRoutes } from './routes/cards.js';
import { healthRoutes } from './routes/health.js';
import { implantationRoutes } from './routes/implantation.js';
import { submitRoutes } from './routes/submit.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    // Cast para o tipo base do Fastify: a instância concreta do Pino especializa
    // os genéricos e diverge da assinatura FastifyInstance retornada.
    loggerInstance: logger as FastifyBaseLogger,
    // Atrás do proxy da Render: necessário para IP correto (rate limit) e HTTPS.
    trustProxy: true,
    genReqId: () => randomUUID(),
  });

  // Cabeçalhos de segurança + CSP restritiva. A API serve apenas JSON, então
  // bloqueamos qualquer origem de conteúdo por padrão.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  // CORS travado apenas no domínio do front (sem curinga). credentials=true
  // para permitir o cookie de sessão httpOnly.
  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
    methods: [...CORS.ALLOWED_METHODS],
    allowedHeaders: [...CORS.ALLOWED_HEADERS],
  });

  await app.register(rateLimit, {
    max: RATE_LIMIT.GLOBAL_MAX,
    timeWindow: RATE_LIMIT.GLOBAL_WINDOW,
    // Healthcheck (Render) não conta no rate limit.
    allowList: (req) => req.url === '/health',
    errorResponseBuilder: () => ({
      error: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente em instantes.' },
    }),
  });

  // Cookie assinado (base para a sessão httpOnly e CSRF).
  await app.register(cookie, { secret: env.SESSION_SECRET });

  // CSRF double-submit: segredo em cookie assinado; token reenviado em header.
  // Cookie SameSite=None em produção (cross-domain front/API); Lax em dev.
  await app.register(csrfProtection, {
    cookieOpts: {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: (env.isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
      signed: true,
    },
    getToken: (req) => req.headers['x-csrf-token'] as string | undefined,
  });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(availabilityRoutes);
  await app.register(submitRoutes);
  await app.register(cardRoutes);
  await app.register(implantationRoutes);
  await app.register(agendaRoutes);

  return app;
}
