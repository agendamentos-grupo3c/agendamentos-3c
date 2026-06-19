import { describe, expect, it } from 'vitest';

import { isValidBrPhone, onlyDigits, toE164 } from '../src/lib/phone';

describe('isValidBrPhone', () => {
  it('aceita celular válido (11 dígitos, começa com 9)', () => {
    expect(isValidBrPhone('42 99999-8888')).toBe(true);
    expect(isValidBrPhone('(42) 99999-8888')).toBe(true);
    expect(isValidBrPhone('42999998888')).toBe(true);
  });

  it('aceita fixo válido (10 dígitos)', () => {
    expect(isValidBrPhone('42 3333-4444')).toBe(true);
  });

  it('rejeita comprimento inválido', () => {
    expect(isValidBrPhone('123')).toBe(false);
    expect(isValidBrPhone('429999988887777')).toBe(false);
  });

  it('rejeita DDD inválido', () => {
    expect(isValidBrPhone('09 99999-8888')).toBe(false);
  });

  it('rejeita celular que não começa com 9', () => {
    expect(isValidBrPhone('42 89999-8888')).toBe(false);
  });
});

describe('toE164', () => {
  it('normaliza para +55 + dígitos', () => {
    expect(toE164('42 99999-8888')).toBe('+5542999998888');
    expect(toE164('(42) 3333-4444')).toBe('+554233334444');
  });

  it('lança erro para telefone inválido', () => {
    expect(() => toE164('123')).toThrow();
  });
});

describe('onlyDigits', () => {
  it('remove tudo que não é dígito', () => {
    expect(onlyDigits('+55 (42) 99999-8888')).toBe('5542999998888');
  });
});
