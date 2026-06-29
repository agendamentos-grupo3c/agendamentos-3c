-- Idempotência do envio de orçamento: uma linha por submissão (chave única).
-- O envio só dispara o n8n/ClickSign uma vez; um replay (mesma idempotency_key)
-- retorna o resultado anterior sem gerar proposta/boleto duplicado.
CREATE TABLE orcamento_envios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key   text NOT NULL,
  actor_email       text NOT NULL,
  empresa           text NOT NULL,
  contratante_email text NOT NULL,
  crm               text NOT NULL,
  total             integer NOT NULL,
  forma_pagamento   text NOT NULL,
  parcelas          integer,
  -- Marcado só após o n8n aceitar; enquanto nulo, um retry pode reprocessar.
  dispatched_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX orcamento_envios_idempotency_key_unique
  ON orcamento_envios (idempotency_key);

CREATE INDEX orcamento_envios_actor_email_idx ON orcamento_envios (actor_email);

CREATE TRIGGER orcamento_envios_set_updated_at
  BEFORE UPDATE ON orcamento_envios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
