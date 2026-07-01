import { describe, expect, it } from 'vitest';

import { competenciaAtual, escolherIntegrador } from '../src/lib/integracaoDistribuicao';

describe('escolherIntegrador — menor total do mês leva o próximo', () => {
  it('vai para quem está com o menor acumulado', () => {
    // alana 800, guilherme 2500 → alana (está atrás)
    expect(escolherIntegrador({ alana: 800, guilherme: 2500 })).toBe('alana');
    // guilherme atrás
    expect(escolherIntegrador({ alana: 2600, guilherme: 2500 })).toBe('guilherme');
  });

  it('continua indo para quem está muito atrás até ultrapassar', () => {
    // guilherme 2500, alana 0 → alana; e segue em alana enquanto for menor
    expect(escolherIntegrador({ alana: 0, guilherme: 2500 })).toBe('alana');
    expect(escolherIntegrador({ alana: 2400, guilherme: 2500 })).toBe('alana');
    // só passa pro guilherme quando alana ultrapassa
    expect(escolherIntegrador({ alana: 2500, guilherme: 2500 })).toBe('alana'); // empate → alana
    expect(escolherIntegrador({ alana: 2501, guilherme: 2500 })).toBe('guilherme');
  });

  it('empate (início do mês) → alana, determinístico', () => {
    expect(escolherIntegrador({ alana: 0, guilherme: 0 })).toBe('alana');
  });
});

describe('competenciaAtual', () => {
  it('formata YYYY-MM no fuso de São Paulo', () => {
    expect(competenciaAtual(new Date('2026-07-01T12:00:00-03:00'))).toBe('2026-07');
    // 01/01 00:30 -03:00 ainda é janeiro em SP (não vira mês pelo UTC)
    expect(competenciaAtual(new Date('2026-01-01T00:30:00-03:00'))).toBe('2026-01');
  });
});
