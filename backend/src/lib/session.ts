import type { FastifyReply, FastifyRequest } from 'fastify';
import { SignJWT, jwtVerify } from 'jose';

import { AUTH } from '../config/constants.js';
import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.SESSION_SECRET);

// Em produção usamos o prefixo __Host- (exige Secure, Path=/, sem Domain) —
// trava o cookie ao host e impede sobrescrita por subdomínios.
const COOKIE = env.isProduction ? `__Host-${AUTH.SESSION_COOKIE}` : AUTH.SESSION_COOKIE;

export interface SessionUser {
  email: string;
  name: string;
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.email)
    .setIssuedAt()
    .setExpirationTime(`${AUTH.SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<SessionUser> {
  const { payload } = await jwtVerify(token, secret);
  return { email: String(payload.sub ?? ''), name: String(payload.name ?? '') };
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    // Produção: front e API em domínios diferentes (Vercel/Render) → o cookie
    // precisa de SameSite=None para ser enviado nas chamadas cross-site.
    // Em dev (same-site localhost) mantemos Lax. CSRF protege as escritas.
    sameSite: (env.isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: AUTH.SESSION_TTL_SECONDS,
  };
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(COOKIE, { path: '/' });
}

export function readSessionCookie(req: FastifyRequest): string | undefined {
  return req.cookies[COOKIE];
}
