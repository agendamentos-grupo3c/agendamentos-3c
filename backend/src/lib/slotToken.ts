import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Implanter, ImplantationProduct } from '../config/constants.js';
import { env } from '../config/env.js';
import type { Collaborator } from './schedulingPolicy.js';

// Identificador OPACO de slot (seção 7.3): o front nunca vê e-mails/IDs de
// agenda — só este token assinado, que o backend valida no submit.
export interface SlotPayload {
  collaborator: Collaborator;
  startISO: string;
  endISO: string;
}

// Token de slot do fluxo de Implantação. Carrega o produto (define a duração) e
// o horário escolhido (início/fim) da sessão.
export interface ImplantationSlotPayload {
  implanter: Implanter;
  product: ImplantationProduct;
  startISO: string;
  endISO: string;
}

function sign(data: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(data).digest('base64url');
}

function encode<T>(payload: T): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

function decode<T>(token: string): T | null {
  const [data, mac] = token.split('.');
  if (!data || !mac) return null;

  const expected = sign(data);
  const got = Buffer.from(mac);
  const exp = Buffer.from(expected);
  if (got.length !== exp.length || !timingSafeEqual(got, exp)) return null;

  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function encodeSlotToken(payload: SlotPayload): string {
  return encode(payload);
}

export function decodeSlotToken(token: string): SlotPayload | null {
  return decode<SlotPayload>(token);
}

export function encodeImplantationToken(payload: ImplantationSlotPayload): string {
  return encode(payload);
}

export function decodeImplantationToken(token: string): ImplantationSlotPayload | null {
  return decode<ImplantationSlotPayload>(token);
}
