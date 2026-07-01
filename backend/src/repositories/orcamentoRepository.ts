import { query } from '../lib/db.js';

export interface OrcamentoEnvio {
  id: string;
  idempotencyKey: string;
  actorEmail: string;
  empresa: string;
  contratanteEmail: string;
  crm: string;
  total: number; // líquido (após desconto)
  totalBruto: number;
  descontoAplicado: number;
  formaPagamento: string;
  parcelas: number | null;
  dispatchedAt: string | null;
  createdAt: string;
}

const COLUMNS = `
  id,
  idempotency_key AS "idempotencyKey",
  actor_email AS "actorEmail",
  empresa,
  contratante_email AS "contratanteEmail",
  crm,
  total,
  total_bruto AS "totalBruto",
  desconto_aplicado AS "descontoAplicado",
  forma_pagamento AS "formaPagamento",
  parcelas,
  dispatched_at AS "dispatchedAt",
  created_at AS "createdAt"
`;

export const IDEMPOTENCY_CONSTRAINT = 'orcamento_envios_idempotency_key_unique';

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

export interface InsertOrcamentoEnvioInput {
  idempotencyKey: string;
  actorEmail: string;
  empresa: string;
  contratanteEmail: string;
  crm: string;
  total: number; // líquido
  totalBruto: number;
  descontoAplicado: number;
  descontoTipo: string | null;
  formaPagamento: string;
  parcelas: number | null;
}

export async function findByIdempotencyKey(key: string): Promise<OrcamentoEnvio | null> {
  const { rows } = await query<OrcamentoEnvio>(
    `SELECT ${COLUMNS} FROM orcamento_envios WHERE idempotency_key = $1`,
    [key],
  );
  return rows[0] ?? null;
}

// Pode lançar violação de unicidade (corrida entre dois POSTs com a mesma chave).
export async function insertEnvio(input: InsertOrcamentoEnvioInput): Promise<OrcamentoEnvio> {
  const { rows } = await query<OrcamentoEnvio>(
    `INSERT INTO orcamento_envios
       (idempotency_key, actor_email, empresa, contratante_email, crm, total, total_bruto,
        desconto_aplicado, desconto_tipo, forma_pagamento, parcelas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING ${COLUMNS}`,
    [
      input.idempotencyKey,
      input.actorEmail,
      input.empresa,
      input.contratanteEmail,
      input.crm,
      input.total,
      input.totalBruto,
      input.descontoAplicado,
      input.descontoTipo,
      input.formaPagamento,
      input.parcelas,
    ],
  );
  return rows[0]!;
}

export async function markDispatched(id: string): Promise<void> {
  await query(`UPDATE orcamento_envios SET dispatched_at = now() WHERE id = $1`, [id]);
}
