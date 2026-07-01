// Modelo de cálculo do orçamento de integração (portado da calculadora avulsa).
// Pesos calibráveis num único lugar; função pura, sem dependência de UI.

export type PilarKey = 'mailing' | 'qualif' | 'screenpop' | 'click2call';

export interface OrcamentoState {
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
  base?: boolean;
}

export interface OrcamentoResult {
  lines: OrcamentoLine[];
  total: number;
}

export const ORCAMENTO_WEIGHTS = {
  base: 500,
  pilar: { mailing: 350, qualif: 350, screenpop: 0, click2call: 300 } as Record<PilarKey, number>,
  funilExtra: 100, // 1º funil incluso; cada extra soma
  campo: 25, // por campo personalizado
  url: 100, // url no retorno
  tier1: 200, // faixa 6–15
  tier2: 350, // faixa 16+
} as const;

export type PilarGroup = 'essenciais' | 'complementos';

export interface Pilar {
  key: PilarKey;
  nome: string;
  benefit: string; // o que o cliente ganha (linguagem de venda)
  group: PilarGroup;
  free?: boolean;
}

export const PILARES: readonly Pilar[] = [
  {
    key: 'mailing',
    nome: 'Subir lista (mailing sync)',
    benefit: 'Seus leads do CRM viram campanha no discador, automaticamente.',
    group: 'essenciais',
  },
  {
    key: 'qualif',
    nome: 'Qualificação no card',
    benefit: 'O resultado de cada ligação volta pro CRM sem digitação.',
    group: 'essenciais',
  },
  {
    key: 'screenpop',
    nome: 'Screen pop',
    benefit: 'A ficha do cliente abre sozinha quando o telefone toca.',
    group: 'complementos',
    free: true,
  },
  {
    key: 'click2call',
    nome: 'Click2call',
    benefit: 'Ligue com um clique direto do CRM, sem discar.',
    group: 'complementos',
  },
];

export type DriverKey = 'funis' | 'qualifs' | 'sdrs' | 'campos';

export interface StepDriver {
  key: DriverKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  tiered: boolean;
}

// Drivers numéricos (steppers). A URL é tratada à parte (toggle).
// max = tetos de sanidade espelhados no backend (schemas/orcamento.ts).
export const STEP_DRIVERS: readonly StepDriver[] = [
  {
    key: 'funis',
    label: 'Funis de gatilho',
    hint: 'Quantos funis do CRM vão disparar ligações na 3C? (o 1º já está incluso)',
    min: 1,
    max: 20,
    tiered: false,
  },
  {
    key: 'qualifs',
    label: 'Qualificações mapeadas',
    hint: 'Quantos status/etapas do funil vamos espelhar entre o CRM e a 3C?',
    min: 1,
    max: 100,
    tiered: true,
  },
  {
    key: 'sdrs',
    label: 'SDRs / operadores',
    hint: 'Quantas pessoas vão usar a discadora e precisam ser mapeadas?',
    min: 1,
    max: 1000,
    tiered: true,
  },
  {
    key: 'campos',
    label: 'Campos personalizados',
    hint: 'Quantos campos novos vamos criar no CRM do cliente?',
    min: 0,
    max: 100,
    tiered: false,
  },
];

// CRMs com template pronto. Fora desta lista, o fluxo manda para reunião de
// viabilidade com o time de integração (não cai no orçamento direto).
export const CRMS_LISTADOS = [
  'Kommo',
  'Pipedrive',
  'HubSpot',
  'RD Station',
  'Bitrix24',
  'Clint',
  'Agendor',
  'PipeRun',
  'Loft / Vista',
] as const;

export function tierFor(n: number): { label: string; add: number } {
  if (n >= 16) return { label: '16+', add: ORCAMENTO_WEIGHTS.tier2 };
  if (n >= 6) return { label: '6–15', add: ORCAMENTO_WEIGHTS.tier1 };
  return { label: 'até 5', add: 0 };
}

export const EMPTY_ORCAMENTO: OrcamentoState = {
  pilares: { mailing: false, qualif: false, screenpop: false, click2call: false },
  funis: 1,
  qualifs: 1,
  sdrs: 1,
  campos: 0,
  url: false,
};

export function computeOrcamento(s: OrcamentoState): OrcamentoResult {
  const W = ORCAMENTO_WEIGHTS;
  const lines: OrcamentoLine[] = [{ label: 'Base do projeto', val: W.base, base: true }];
  let total = W.base;

  for (const p of PILARES) {
    if (s.pilares[p.key]) {
      lines.push({ label: p.nome, val: W.pilar[p.key] });
      total += W.pilar[p.key];
    }
  }

  const funisExtra = Math.max(0, s.funis - 1);
  if (funisExtra > 0) {
    const v = funisExtra * W.funilExtra;
    lines.push({ label: `${funisExtra} funil(is) extra`, val: v });
    total += v;
  }

  const tq = tierFor(s.qualifs);
  if (tq.add > 0) {
    lines.push({ label: `Qualificações (${tq.label})`, val: tq.add });
    total += tq.add;
  }

  const ts = tierFor(s.sdrs);
  if (ts.add > 0) {
    lines.push({ label: `SDRs (${ts.label})`, val: ts.add });
    total += ts.add;
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

export const brl = (n: number): string => n.toLocaleString('pt-BR');

// Desconto (espelho do backend): teto configurável OU cortesia total (100%).
// O teto NÃO é exibido ao cliente; entre o teto e 100% mostramos "excedente".
export const DESCONTO_MAX_PCT = 20;

export type DescontoTipo = 'percentual' | 'valor';
export interface Desconto {
  tipo: DescontoTipo;
  valor: number;
}
export interface DescontoResult {
  aplicado: number;
  total: number;
  isFull: boolean;
  excedente: boolean;
}

export function resolveDesconto(subtotal: number, d: Desconto | null): DescontoResult {
  if (!d || d.valor <= 0 || subtotal <= 0) {
    return { aplicado: 0, total: subtotal, isFull: false, excedente: false };
  }
  const bruto = d.tipo === 'percentual' ? Math.round((subtotal * d.valor) / 100) : d.valor;
  const aplicado = Math.max(0, Math.min(bruto, subtotal));
  const cap = Math.round((subtotal * DESCONTO_MAX_PCT) / 100);
  const isFull = aplicado === subtotal;
  return { aplicado, total: subtotal - aplicado, isFull, excedente: aplicado > cap && !isFull };
}
