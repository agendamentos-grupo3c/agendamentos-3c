import { describe, expect, it } from 'vitest';

import { computeOrcamento, type OrcamentoEscopo } from '../src/lib/orcamentoPolicy';

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
