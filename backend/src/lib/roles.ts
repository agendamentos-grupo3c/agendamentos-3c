import { env } from '../config/env.js';
import type { Implanter } from '../config/constants.js';
import type { Collaborator } from './schedulingPolicy.js';

export type Role = 'integrator' | 'seller';

// Integradores = donos das agendas (CALENDAR_*_ID são os e-mails deles).
// Mapa e-mail (lower-case) → coluna, montado a partir do env.
// Normaliza e-mails de env/sessão para casar sem ruído (espaços, maiúsculas).
const normEmail = (email: string): string => email.trim().toLowerCase();

function buildMap(): Map<string, Collaborator> {
  const map = new Map<string, Collaborator>();
  if (env.CALENDAR_ALANA_ID) map.set(normEmail(env.CALENDAR_ALANA_ID), 'alana');
  if (env.CALENDAR_GUILHERME_ID) map.set(normEmail(env.CALENDAR_GUILHERME_ID), 'guilherme');
  return map;
}

const integratorMap = buildMap();

export function getCollaboratorForEmail(email: string): Collaborator | null {
  return integratorMap.get(normEmail(email)) ?? null;
}

export function getRole(email: string): Role {
  return integratorMap.has(normEmail(email)) ? 'integrator' : 'seller';
}

// Implantadores = donos das agendas de treinamento (CALENDAR_*_ID = e-mails).
function buildImplanterMap(): Map<string, Implanter> {
  const map = new Map<string, Implanter>();
  if (env.CALENDAR_GABRIELLE_ID) map.set(normEmail(env.CALENDAR_GABRIELLE_ID), 'gabrielle');
  if (env.CALENDAR_BRYAN_ID) map.set(normEmail(env.CALENDAR_BRYAN_ID), 'bryan');
  if (env.CALENDAR_WAGNER_ID) map.set(normEmail(env.CALENDAR_WAGNER_ID), 'wagner');
  return map;
}

const implanterMap = buildImplanterMap();

export function getImplanterForEmail(email: string): Implanter | null {
  return implanterMap.get(normEmail(email)) ?? null;
}

export function isImplanter(email: string): boolean {
  return implanterMap.has(normEmail(email));
}
