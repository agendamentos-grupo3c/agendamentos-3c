import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import type { GoogleIdClaims } from '../integrations/googleOidc.js';
import { allowlistConfigured, isEmailAllowed } from '../lib/allowlist.js';
import type { SessionUser } from '../lib/session.js';
import { insertAuditLog } from '../repositories/auditRepository.js';

const ACCESS_DENIED = 'Acesso restrito a colaboradores Grupo 3C.';

function denied(code: string, publicMessage = ACCESS_DENIED): AppError {
  return new AppError({ code, statusCode: 403, publicMessage });
}

// Aplica as regras de acesso sobre claims JÁ verificados (assinatura/iss/aud/exp
// validados antes). Cenários 7.1: 1 (domínio), 2 (allowlist), 3 (email_verified).
export async function completeLogin(claims: GoogleIdClaims): Promise<SessionUser> {
  if (!claims.email) {
    throw denied('AUTH_NO_EMAIL');
  }
  if (!claims.emailVerified) {
    throw denied('AUTH_EMAIL_NOT_VERIFIED', 'E-mail Google não verificado.');
  }
  if (claims.hd !== env.ALLOWED_DOMAIN) {
    throw denied('AUTH_DOMAIN_FORBIDDEN');
  }
  // Allowlist é OPCIONAL: por padrão (vazia) qualquer e-mail do domínio acessa.
  // Se ALLOWLIST_EMAILS for preenchida, passa a restringir a esses e-mails.
  if (allowlistConfigured() && !isEmailAllowed(claims.email)) {
    throw denied('AUTH_NOT_ALLOWLISTED');
  }

  const user: SessionUser = { email: claims.email, name: claims.name };
  await insertAuditLog({ actorEmail: user.email, action: 'auth.login' });
  return user;
}
