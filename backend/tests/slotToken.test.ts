import { describe, expect, it } from 'vitest';

import { decodeSlotToken, encodeSlotToken } from '../src/lib/slotToken';

const payload = {
  collaborator: 'alana' as const,
  startISO: '2026-07-01T12:15:00.000Z',
  endISO: '2026-07-01T12:45:00.000Z',
};

describe('slotToken', () => {
  it('faz round-trip de encode/decode', () => {
    expect(decodeSlotToken(encodeSlotToken(payload))).toEqual(payload);
  });

  it('rejeita token adulterado (assinatura inválida)', () => {
    const token = encodeSlotToken(payload);
    const tampered = `${token.slice(0, -2)}xx`;
    expect(decodeSlotToken(tampered)).toBeNull();
  });

  it('rejeita formato inválido', () => {
    expect(decodeSlotToken('')).toBeNull();
    expect(decodeSlotToken('semponto')).toBeNull();
    expect(decodeSlotToken('a.b.c')).toBeNull();
  });
});
