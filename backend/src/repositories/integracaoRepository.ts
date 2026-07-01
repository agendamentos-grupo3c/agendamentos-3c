import { query } from '../lib/db.js';
import type { Integrador, TotaisMes } from '../lib/integracaoDistribuicao.js';

export interface Atribuicao {
  id: string;
  idempotencyKey: string;
  integrador: Integrador;
  valor: number;
  competencia: string;
  empresa: string | null;
  crm: string | null;
  createdAt: string;
}

const COLUMNS = `
  id,
  idempotency_key AS "idempotencyKey",
  integrador,
  valor,
  competencia,
  empresa,
  crm,
  created_at AS "createdAt"
`;

export const ATRIBUICAO_IDEMPOTENCY_CONSTRAINT = 'integracao_atribuicoes_idempotency_key_unique';

export function isUniqueViolation(err: unknown, constraint: string): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    err.code === '23505' &&
    'constraint' in err &&
    err.constraint === constraint
  );
}

export async function findByIdempotencyKey(key: string): Promise<Atribuicao | null> {
  const { rows } = await query<Atribuicao>(
    `SELECT ${COLUMNS} FROM integracao_atribuicoes WHERE idempotency_key = $1`,
    [key],
  );
  return rows[0] ?? null;
}

// Totais do mês por integrador (base do balanceamento). Sempre devolve os dois,
// mesmo quem ainda não tem nada (0), para a decisão ser simples.
export async function totaisDaCompetencia(competencia: string): Promise<TotaisMes> {
  const { rows } = await query<{ integrador: Integrador; soma: number }>(
    `SELECT integrador, COALESCE(SUM(valor),0)::int AS soma
       FROM integracao_atribuicoes WHERE competencia = $1 GROUP BY integrador`,
    [competencia],
  );
  const totais: TotaisMes = { alana: 0, guilherme: 0 };
  for (const r of rows) totais[r.integrador] = r.soma;
  return totais;
}

export interface InsertAtribuicaoInput {
  idempotencyKey: string;
  integrador: Integrador;
  valor: number;
  competencia: string;
  empresa: string | null;
  crm: string | null;
}

// Pode lançar violação de unicidade (retry concorrente com a mesma chave).
export async function insertAtribuicao(input: InsertAtribuicaoInput): Promise<Atribuicao> {
  const { rows } = await query<Atribuicao>(
    `INSERT INTO integracao_atribuicoes
       (idempotency_key, integrador, valor, competencia, empresa, crm)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING ${COLUMNS}`,
    [input.idempotencyKey, input.integrador, input.valor, input.competencia, input.empresa, input.crm],
  );
  return rows[0]!;
}
