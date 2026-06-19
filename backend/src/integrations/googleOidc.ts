import { createHash, randomBytes } from 'node:crypto';

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { AUTH, GOOGLE } from '../config/constants.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

// Validação tardia: o app sobe sem credenciais do Google (ex.: /health), mas as
// rotas de login falham com erro claro até GOOGLE_* estarem configuradas.
export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new AppError({
      code: 'AUTH_NOT_CONFIGURED',
      statusCode: 503,
      publicMessage: 'Login indisponível no momento.',
      message: 'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI ausentes.',
    });
  }
  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: GOOGLE_REDIRECT_URI,
  };
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function buildAuthUrl(params: {
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const cfg = getGoogleOAuthConfig();
  const url = new URL(GOOGLE.AUTH_ENDPOINT);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', AUTH.SCOPES.join(' '));
  url.searchParams.set('state', params.state);
  url.searchParams.set('nonce', params.nonce);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // `hd` é apenas uma dica de UX para o seletor de contas; a validação real do
  // domínio acontece no ID token verificado (nunca confiar no cliente).
  url.searchParams.set('hd', env.ALLOWED_DOMAIN);
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('access_type', 'online');
  return url.toString();
}

const JWKS = createRemoteJWKSet(new URL(GOOGLE.JWKS_URI));

export interface GoogleIdClaims {
  email: string;
  emailVerified: boolean;
  hd?: string;
  name: string;
}

export async function exchangeCodeForIdToken(code: string, codeVerifier: string): Promise<string> {
  const cfg = getGoogleOAuthConfig();
  const res = await fetch(GOOGLE.TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    throw new AppError({
      code: 'AUTH_TOKEN_EXCHANGE_FAILED',
      statusCode: 401,
      publicMessage: 'Falha na autenticação.',
      message: `token endpoint respondeu ${res.status}`,
    });
  }

  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) {
    throw new AppError({
      code: 'AUTH_NO_ID_TOKEN',
      statusCode: 401,
      publicMessage: 'Falha na autenticação.',
    });
  }
  return json.id_token;
}

export async function verifyIdToken(idToken: string, expectedNonce: string): Promise<GoogleIdClaims> {
  const cfg = getGoogleOAuthConfig();
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, JWKS, {
      issuer: [...GOOGLE.ISSUERS],
      audience: cfg.clientId,
    }));
  } catch (err) {
    // Assinatura inválida, token adulterado/expirado, iss/aud divergentes.
    throw new AppError({
      code: 'AUTH_INVALID_TOKEN',
      statusCode: 401,
      publicMessage: 'Falha na autenticação.',
      message: 'falha na verificação do ID token',
      cause: err,
    });
  }

  if (payload.nonce !== expectedNonce) {
    throw new AppError({
      code: 'AUTH_NONCE_MISMATCH',
      statusCode: 401,
      publicMessage: 'Falha na autenticação.',
    });
  }

  return {
    email: typeof payload.email === 'string' ? payload.email : '',
    emailVerified: payload.email_verified === true,
    hd: typeof payload.hd === 'string' ? payload.hd : undefined,
    name: typeof payload.name === 'string' ? payload.name : '',
  };
}
