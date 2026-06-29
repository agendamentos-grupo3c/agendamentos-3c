import { AppError } from '../errors/AppError.js';
import { notifyOrcamentoProposta } from '../integrations/n8n.js';
import { logger } from '../lib/logger.js';
import { computeOrcamento, selectedPilarNames } from '../lib/orcamentoPolicy.js';
import { toE164 } from '../lib/phone.js';
import { insertAuditLog } from '../repositories/auditRepository.js';
import {
  type OrcamentoEnvio,
  IDEMPOTENCY_CONSTRAINT,
  findByIdempotencyKey,
  insertEnvio,
  isUniqueViolation,
  markDispatched,
} from '../repositories/orcamentoRepository.js';
import type { OrcamentoSubmitInput } from '../schemas/orcamento.js';

const PROPOSTA_VALIDADE_DIAS = 30;

const brl2 = (n: number): string =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataLonga = (d: Date): string =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const onlyDigits = (s: string): string => s.replace(/\D/g, '');

export interface EnviarOrcamentoInput {
  actorEmail: string;
  actorName: string;
  idempotencyKey: string;
  form: OrcamentoSubmitInput;
}

export interface EnviarOrcamentoResult {
  total: number;
  valorFormatado: string;
  validadeISO: string;
}

function buildResult(total: number, createdAtISO: string): EnviarOrcamentoResult {
  const validade = new Date(new Date(createdAtISO).getTime() + PROPOSTA_VALIDADE_DIAS * 24 * 60 * 60 * 1000);
  return { total, valorFormatado: brl2(total), validadeISO: validade.toISOString() };
}

export async function enviarOrcamento(input: EnviarOrcamentoInput): Promise<EnviarOrcamentoResult> {
  const { form } = input;

  // Preço SEMPRE recomputado no servidor a partir do escopo (nunca confiar no
  // total vindo do cliente).
  const { total, lines } = computeOrcamento(form.escopo);
  const parcelas = form.formaPagamento === 'parcelado' ? (form.parcelas ?? 1) : 1;

  // Idempotência server-side: replay de um envio já despachado retorna o
  // resultado anterior SEM chamar o n8n de novo (não duplica proposta/boleto).
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing?.dispatchedAt) return buildResult(existing.total, existing.createdAt);

  let envio: OrcamentoEnvio | null = existing;
  if (!envio) {
    try {
      envio = await insertEnvio({
        idempotencyKey: input.idempotencyKey,
        actorEmail: input.actorEmail,
        empresa: form.empresa,
        contratanteEmail: form.contratanteEmail,
        crm: form.crm,
        total,
        formaPagamento: form.formaPagamento,
        parcelas: form.formaPagamento === 'parcelado' ? parcelas : null,
      });
    } catch (err) {
      // Corrida: outro POST com a mesma chave inseriu primeiro.
      if (!isUniqueViolation(err, IDEMPOTENCY_CONSTRAINT)) throw err;
      const dup = await findByIdempotencyKey(input.idempotencyKey);
      if (dup?.dispatchedAt) return buildResult(dup.total, dup.createdAt);
      if (!dup) throw err;
      envio = dup;
    }
  }

  // Datas e total ancorados na linha persistida → consistentes entre retries.
  const criadoEm = new Date(envio.createdAt);
  const validade = new Date(criadoEm.getTime() + PROPOSTA_VALIDADE_DIAS * 24 * 60 * 60 * 1000);
  const valorParcela = envio.total / parcelas;

  const payload = {
    tipo: 'orcamento',
    idempotencyKey: input.idempotencyKey,
    NOME_CONTRATANTE: form.contratanteNome,
    EMAIL_CONTRATANTE: form.contratanteEmail,
    TELEFONE_CONTRATANTE: toE164(form.contratanteTelefone),
    EMPRESA_CONTRATANTE: form.empresa,
    CNPJ_CONTRATANTE: onlyDigits(form.cnpj),
    ID_HUBSPOT: form.idHubspot ?? '',
    ID_NEGOCIO: form.idNegocio ?? '',
    CLIENTE_REF: form.clienteRef ?? '',
    CRM: form.crm,
    VALOR_TOTAL: envio.total,
    VALOR_TOTAL_FORMATADO: brl2(envio.total),
    FORMA_PAGAMENTO: form.formaPagamento === 'parcelado' ? 'Parcelado' : 'À vista',
    PARCELAS: parcelas,
    VALOR_PARCELA: brl2(valorParcela),
    ESCOPO: {
      pilares: selectedPilarNames(form.escopo),
      funis: form.escopo.funis,
      qualificacoes: form.escopo.qualifs,
      sdrs: form.escopo.sdrs,
      campos_personalizados: form.escopo.campos,
      url_retorno: form.escopo.url,
    },
    BREAKDOWN: lines,
    DESCRICAO: form.descricao ?? '',
    OBSERVACOES: form.observacoes ?? '',
    DATA_PROPOSTA: dataLonga(criadoEm),
    VALIDADE_PROPOSTA: dataLonga(validade),
    PROPRIETARIO_NEGOCIO: { nome: input.actorName, email: input.actorEmail },
    enviado_em: criadoEm.toISOString(),
  };

  try {
    await notifyOrcamentoProposta(payload, input.idempotencyKey);
  } catch (err) {
    logger.warn({ err }, 'orcamento clicksign dispatch failed');
    if (err instanceof AppError) throw err;
    throw new AppError({
      code: 'ORCAMENTO_DISPATCH_FAILED',
      statusCode: 502,
      publicMessage: 'Não foi possível enviar a proposta agora. Tente novamente.',
    });
  }

  await markDispatched(envio.id);

  // Auditoria (LGPD): quem enviou, para quem e o valor — sem telefone/CNPJ.
  await insertAuditLog({
    actorEmail: input.actorEmail,
    action: 'orcamento.sent',
    metadata: {
      orcamentoId: envio.id,
      empresa: form.empresa,
      contratanteEmail: form.contratanteEmail,
      crm: form.crm,
      total: envio.total,
      formaPagamento: payload.FORMA_PAGAMENTO,
      parcelas,
      idempotencyKey: input.idempotencyKey,
    },
  });

  return buildResult(envio.total, envio.createdAt);
}
