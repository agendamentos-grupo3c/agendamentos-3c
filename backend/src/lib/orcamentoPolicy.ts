// Cálculo do orçamento de integração no SERVIDOR (fonte de verdade do preço).
// O front envia o escopo; o total é sempre recomputado aqui — nunca confiar no
// valor vindo do cliente. Espelha frontend/src/lib/orcamento.ts.

export type PilarKey = 'mailing' | 'qualif' | 'screenpop' | 'click2call';

export interface OrcamentoEscopo {
  pilares: Record<PilarKey, boolean>;
  funis: number;
  qualifs: number;
  sdrs: number;
  campos: number;
  url: boolean;
}

export interface OrcamentoLine {
  label: string;
  val: number;
}

export const ORCAMENTO_WEIGHTS = {
  base: 500,
  pilar: { mailing: 350, qualif: 350, screenpop: 0, click2call: 300 } as Record<PilarKey, number>,
  funilExtra: 100,
  campo: 25,
  url: 100,
  tier1: 200, // 6–15
  tier2: 350, // 16+
} as const;

export const PILAR_NOMES: Record<PilarKey, string> = {
  mailing: 'Subir lista (mailing sync)',
  qualif: 'Qualificação no card',
  screenpop: 'Screen pop (nativo 3C)',
  click2call: 'Click2call (extensão)',
};

export function selectedPilarNames(s: OrcamentoEscopo): string[] {
  return (Object.keys(PILAR_NOMES) as PilarKey[]).filter((k) => s.pilares[k]).map((k) => PILAR_NOMES[k]);
}

function tierAdd(n: number): number {
  if (n >= 16) return ORCAMENTO_WEIGHTS.tier2;
  if (n >= 6) return ORCAMENTO_WEIGHTS.tier1;
  return 0;
}

export function computeOrcamento(s: OrcamentoEscopo): { lines: OrcamentoLine[]; total: number } {
  const W = ORCAMENTO_WEIGHTS;
  const lines: OrcamentoLine[] = [{ label: 'Base do projeto', val: W.base }];
  let total = W.base;

  (Object.keys(W.pilar) as PilarKey[]).forEach((key) => {
    if (s.pilares[key]) {
      lines.push({ label: PILAR_NOMES[key], val: W.pilar[key] });
      total += W.pilar[key];
    }
  });

  const funisExtra = Math.max(0, s.funis - 1);
  if (funisExtra > 0) {
    const v = funisExtra * W.funilExtra;
    lines.push({ label: `${funisExtra} funil(is) extra`, val: v });
    total += v;
  }

  const tq = tierAdd(s.qualifs);
  if (tq > 0) {
    lines.push({ label: 'Qualificações (faixa)', val: tq });
    total += tq;
  }

  const ts = tierAdd(s.sdrs);
  if (ts > 0) {
    lines.push({ label: 'SDRs (faixa)', val: ts });
    total += ts;
  }

  if (s.campos > 0) {
    const v = s.campos * W.campo;
    lines.push({ label: `${s.campos} campo(s) personalizado(s)`, val: v });
    total += v;
  }

  if (s.url) {
    lines.push({ label: 'URL no retorno', val: W.url });
    total += W.url;
  }

  return { lines, total };
}
