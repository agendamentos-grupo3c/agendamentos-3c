import {
  type Integrador,
  type TotaisMes,
  competenciaAtual,
  escolherIntegrador,
} from '../lib/integracaoDistribuicao.js';
import { insertAuditLog } from '../repositories/auditRepository.js';
import {
  ATRIBUICAO_IDEMPOTENCY_CONSTRAINT,
  findByIdempotencyKey,
  insertAtribuicao,
  isUniqueViolation,
  totaisDaCompetencia,
} from '../repositories/integracaoRepository.js';

export interface AtribuirInput {
  idempotencyKey: string;
  valor: number;
  empresa: string | null;
  crm: string | null;
}

export interface AtribuirResult {
  integrador: Integrador;
  competencia: string;
  totais: TotaisMes;
  jaAtribuido: boolean;
}

// Decide (e registra) qual integrador fica com um projeto PAGO, mantendo o
// balanceamento por valor no mês. Idempotente: a mesma chave (orçamento pago)
// nunca é contabilizada duas vezes — um replay devolve a mesma atribuição.
export async function atribuirIntegracao(
  input: AtribuirInput,
  now: Date = new Date(),
): Promise<AtribuirResult> {
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return {
      integrador: existing.integrador,
      competencia: existing.competencia,
      totais: await totaisDaCompetencia(existing.competencia),
      jaAtribuido: true,
    };
  }

  const competencia = competenciaAtual(now);
  const totais = await totaisDaCompetencia(competencia);
  const integrador = escolherIntegrador(totais);

  try {
    const atrib = await insertAtribuicao({
      idempotencyKey: input.idempotencyKey,
      integrador,
      valor: input.valor,
      competencia,
      empresa: input.empresa,
      crm: input.crm,
    });
    await insertAuditLog({
      actorEmail: 'n8n:integracao',
      action: 'integracao.atribuida',
      metadata: { atribuicaoId: atrib.id, integrador, valor: input.valor, competencia, idempotencyKey: input.idempotencyKey },
    });
  } catch (err) {
    // Corrida: outra chamada com a mesma chave inseriu primeiro → devolve a dela.
    if (!isUniqueViolation(err, ATRIBUICAO_IDEMPOTENCY_CONSTRAINT)) throw err;
    const dup = await findByIdempotencyKey(input.idempotencyKey);
    if (!dup) throw err;
    return {
      integrador: dup.integrador,
      competencia: dup.competencia,
      totais: await totaisDaCompetencia(dup.competencia),
      jaAtribuido: true,
    };
  }

  return {
    integrador,
    competencia,
    totais: { ...totais, [integrador]: totais[integrador] + input.valor },
    jaAtribuido: false,
  };
}
