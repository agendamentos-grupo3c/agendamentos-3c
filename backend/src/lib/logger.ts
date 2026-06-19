import { pino } from 'pino';

import { env } from '../config/env.js';

// Campos que NUNCA podem aparecer nos logs (PII de cliente, credenciais, tokens).
// Defesa em profundidade: além de não logarmos payloads, redigimos por padrão.
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'req.headers["idempotency-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.apiKey',
  '*.authorization',
  '*.phone',
  '*.telefone',
  '*.email',
];

export const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  base: undefined,
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  transport: env.isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } },
});
