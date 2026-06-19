import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../config/env.js';
import type { Collaborator } from './schedulingPolicy.js';

// Identificador OPACO de slot (seção 7.3): o front nunca vê e-mails/IDs de
// agenda — só este token assinado, que o backend valida no submit (Passo 8).
export interface SlotPayload {
  collaborator: Collaborator;
  startISO: string;
  endISO: string;
}

function sign(data: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(data).digest('base64url');
}

export function encodeSlotToken(payload: SlotPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function decodeSlotToken(token: string): SlotPayload | null {
  const [data, mac] = token.split('.');
  if (!data || !mac) return null;

  const expected = sign(data);
  const got = Buffer.from(mac);
  const exp = Buffer.from(expected);
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) return null;

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SlotPayload;
  } catch {
    return null;
  }
}
