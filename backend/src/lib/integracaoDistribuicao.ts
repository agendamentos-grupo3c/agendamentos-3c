// Distribuição dos projetos de integração PAGOS entre Alana e Guilherme.
// Regra: cada novo projeto vai para quem tem o MENOR acumulado no mês (empate →
// alana, determinístico). Mantém os dois o mais parelho possível por valor.
// Cortesia (R$0) conta como 0 — não desequilibra.

export type Integrador = 'alana' | 'guilherme';

export interface TotaisMes {
  alana: number;
  guilherme: number;
}

export function escolherIntegrador(totais: TotaisMes): Integrador {
  return totais.alana <= totais.guilherme ? 'alana' : 'guilherme';
}

// Competência 'YYYY-MM' no fuso de São Paulo (mês de referência do balanceamento).
export function competenciaAtual(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '00';
  return `${y}-${m}`;
}
