-- Distribuição dos projetos de integração PAGOS entre Alana e Guilherme.
-- Uma linha por projeto pago; o balanceamento soma `valor` por integrador dentro
-- da `competencia` (mês). idempotency_key = referência do orçamento pago, para
-- não contabilizar duas vezes em retry do n8n.
CREATE TYPE integrador AS ENUM ('alana', 'guilherme');

CREATE TABLE integracao_atribuicoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL,
  integrador      integrador NOT NULL,
  valor           integer NOT NULL,   -- líquido pago (R$ inteiros); cortesia = 0
  competencia     text NOT NULL,      -- 'YYYY-MM' (America/Sao_Paulo)
  empresa         text,
  crm             text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX integracao_atribuicoes_idempotency_key_unique
  ON integracao_atribuicoes (idempotency_key);

CREATE INDEX integracao_atribuicoes_competencia_idx
  ON integracao_atribuicoes (competencia, integrador);
