import { describe, expect, it } from 'vitest';

import { computeOrcamento, resolveDesconto, type OrcamentoEscopo } from '../src/lib/orcamentoPolicy';

const base = (over: Partial<OrcamentoEscopo> = {}): OrcamentoEscopo => ({
  pilares: { mailing: false, qualif: false, screenpop: false, click2call: false },
  funis: 1,
  qualifs: 1,
  sdrs: 1,
  campos: 0,
  url: false,
  ...over,
});

describe('computeOrcamento', () => {
  it('escopo vazio = só a base (R$ 500)', () => {
    expect(computeOrcamento(base()).total).toBe(500);
  });

  it('soma pilares pagos e ignora o gratuito (screen pop)', () => {
    const r = computeOrcamento(base({ pilares: { mailing: true, qualif: true, screenpop: true, click2call: true } }));
    // 500 + 350 + 350 + 0 + 300
    expect(r.total).toBe(1500);
  });

  it('aplica tiers de qualificações/SDRs e extras', () => {
    const r = computeOrcamento(
      base({
        pilares: { mailing: true, qualif: true, screenpop: false, click2call: true },
        funis: 2, // +100
        qualifs: 7, // tier 6–15 → +200
        sdrs: 16, // tier 16+ → +350
        campos: 3, // +75
        url: true, // +100
      }),
    );
    // 500 + (350+350+300) + 100 + 200 + 350 + 75 + 100
    expect(r.total).toBe(2325);
  });

  it('funil incluso não cobra (1 funil = 0 extra)', () => {
    expect(computeOrcamento(base({ funis: 1 })).total).toBe(500);
  });
});

describe('resolveDesconto (teto 20% OU cortesia total)', () => {
  it('sem desconto → total = subtotal', () => {
    const r = resolveDesconto(1200, undefined);
    expect(r).toMatchObject({ aplicado: 0, total: 1200, excedente: false, isFull: false });
  });

  it('percentual no teto (20%) é aceito', () => {
    const r = resolveDesconto(1200, { tipo: 'percentual', valor: 20 });
    expect(r).toMatchObject({ aplicado: 240, total: 960, excedente: false });
  });

  it('percentual acima do teto (e < 100%) é excedente', () => {
    expect(resolveDesconto(1200, { tipo: 'percentual', valor: 25 }).excedente).toBe(true);
    expect(resolveDesconto(1200, { tipo: 'valor', valor: 300 }).excedente).toBe(true);
  });

  it('cortesia total (valor cheio ou 100%) é aceita e zera o total', () => {
    const rs = resolveDesconto(1200, { tipo: 'valor', valor: 1200 });
    expect(rs).toMatchObject({ aplicado: 1200, total: 0, isFull: true, excedente: false });
    const pct = resolveDesconto(1200, { tipo: 'percentual', valor: 100 });
    expect(pct).toMatchObject({ total: 0, isFull: true, excedente: false });
  });

  it('valor dentro do teto é aceito', () => {
    expect(resolveDesconto(1200, { tipo: 'valor', valor: 240 }).excedente).toBe(false);
  });
});
