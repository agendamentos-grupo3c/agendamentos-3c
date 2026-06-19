import { env } from '../config/env.js';
import type { Collaborator } from './schedulingPolicy.js';

export type Role = 'integrator' | 'seller';

// Integradores = donos das agendas (CALENDAR_*_ID são os e-mails deles).
// Mapa e-mail (lower-case) → coluna, montado a partir do env.
function buildMap(): Map<string, Collaborator> {
  const map = new Map<string, Collaborator>();
  if (env.CALENDAR_ALANA_ID) map.set(env.CALENDAR_ALANA_ID.toLowerCase(), 'alana');
  if (env.CALENDAR_GUILHERME_ID) map.set(env.CALENDAR_GUILHERME_ID.toLowerCase(), 'guilherme');
  return map;
}

const integratorMap = buildMap();

export function getCollaboratorForEmail(email: string): Collaborator | null {
  return integratorMap.get(email.toLowerCase()) ?? null;
}

export function getRole(email: string): Role {
  return integratorMap.has(email.toLowerCase()) ? 'integrator' : 'seller';
}
