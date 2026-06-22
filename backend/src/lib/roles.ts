import { env } from '../config/env.js';
import type { Implanter } from '../config/constants.js';
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

// Implantadores = donos das agendas de treinamento (CALENDAR_*_ID = e-mails).
function buildImplanterMap(): Map<string, Implanter> {
  const map = new Map<string, Implanter>();
  if (env.CALENDAR_GABRIELLE_ID) map.set(env.CALENDAR_GABRIELLE_ID.toLowerCase(), 'gabrielle');
  if (env.CALENDAR_BRYAN_ID) map.set(env.CALENDAR_BRYAN_ID.toLowerCase(), 'bryan');
  if (env.CALENDAR_LUAN_ID) map.set(env.CALENDAR_LUAN_ID.toLowerCase(), 'luan');
  if (env.CALENDAR_WAGNER_ID) map.set(env.CALENDAR_WAGNER_ID.toLowerCase(), 'wagner');
  return map;
}

const implanterMap = buildImplanterMap();

export function getImplanterForEmail(email: string): Implanter | null {
  return implanterMap.get(email.toLowerCase()) ?? null;
}

export function isImplanter(email: string): boolean {
  return implanterMap.has(email.toLowerCase());
}
