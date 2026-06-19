import { env } from '../config/env.js';

// Allowlist server-side de e-mails autorizados (defesa além do domínio `hd`:
// resolve offboarding e contas que deveriam ser revogadas). Case-insensitive.
const allowlist = new Set(
  (env.ALLOWLIST_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isEmailAllowed(email: string): boolean {
  return allowlist.has(email.toLowerCase());
}

export function allowlistConfigured(): boolean {
  return allowlist.size > 0;
}
