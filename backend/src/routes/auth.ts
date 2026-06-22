import type { FastifyInstance, FastifyReply } from 'fastify';

import { AUTH } from '../config/constants.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import {
  buildAuthUrl,
  exchangeCodeForIdToken,
  generatePkce,
  randomToken,
  verifyIdToken,
} from '../integrations/googleOidc.js';
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from '../lib/session.js';
import { getImplanterForEmail, getRole } from '../lib/roles.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { completeLogin } from '../services/authService.js';

function txCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: AUTH.OAUTH_TX_TTL_SECONDS,
  };
}

function clearTxCookies(reply: FastifyReply): void {
  for (const name of [AUTH.STATE_COOKIE, AUTH.NONCE_COOKIE, AUTH.VERIFIER_COOKIE]) {
    reply.clearCookie(name, { path: '/' });
  }
}

function loginErrorRedirect(reply: FastifyReply, code: string): FastifyReply {
  const url = new URL(AUTH.FRONTEND_LOGIN_PATH, env.FRONTEND_ORIGIN);
  url.searchParams.set('error', code);
  return reply.redirect(url.toString());
}

interface CallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Início do login: gera state/nonce/PKCE, guarda em cookies de transação e
  // redireciona ao Google.
  app.get('/auth/google/login', async (_req, reply) => {
    const state = randomToken();
    const nonce = randomToken();
    const { verifier, challenge } = generatePkce();

    const opts = txCookieOptions();
    reply.setCookie(AUTH.STATE_COOKIE, state, opts);
    reply.setCookie(AUTH.NONCE_COOKIE, nonce, opts);
    reply.setCookie(AUTH.VERIFIER_COOKIE, verifier, opts);

    return reply.redirect(buildAuthUrl({ state, nonce, codeChallenge: challenge }));
  });

  // Callback do Google: valida state, troca o code, verifica o ID token e aplica
  // as regras de acesso. Falhas redirecionam ao front com ?error=<código>.
  app.get('/auth/google/callback', async (req, reply) => {
    const { code, state, error } = req.query as CallbackQuery;
    const cookieState = req.cookies[AUTH.STATE_COOKIE];
    const nonce = req.cookies[AUTH.NONCE_COOKIE];
    const verifier = req.cookies[AUTH.VERIFIER_COOKIE];

    try {
      if (error) {
        throw new AppError({ code: 'AUTH_PROVIDER_ERROR', statusCode: 401, publicMessage: 'Falha na autenticação.' });
      }
      // Cenário 7.1.10: state/nonce ausente ou divergente → abortar o login.
      if (!code || !state || !cookieState || !nonce || !verifier || state !== cookieState) {
        throw new AppError({ code: 'AUTH_STATE_MISMATCH', statusCode: 400, publicMessage: 'Falha na autenticação.' });
      }

      const idToken = await exchangeCodeForIdToken(code, verifier);
      const claims = await verifyIdToken(idToken, nonce);
      const user = await completeLogin(claims);

      const sessionToken = await createSessionToken(user);
      clearTxCookies(reply);
      setSessionCookie(reply, sessionToken);
      return reply.redirect(env.FRONTEND_ORIGIN);
    } catch (err) {
      clearTxCookies(reply);
      req.log.warn({ err }, 'login failed');
      const codeOut = err instanceof AppError ? err.code : 'AUTH_FAILED';
      return loginErrorRedirect(reply, codeOut);
    }
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (req) => {
    const email = req.user!.email;
    return {
      email,
      name: req.user!.name,
      role: getRole(email),
      implanter: getImplanterForEmail(email),
    };
  });

  // Token CSRF (double-submit): o front busca aqui e reenvia em X-CSRF-Token.
  app.get('/auth/csrf', async (_req, reply) => {
    return { csrfToken: await reply.generateCsrf() };
  });

  // Logout altera estado → exige sessão válida e token CSRF.
  app.post('/auth/logout', { preHandler: [requireAuth, app.csrfProtection] }, async (_req, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
