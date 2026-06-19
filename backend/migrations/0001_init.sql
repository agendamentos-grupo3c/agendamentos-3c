-- Passo 3: modelagem inicial.
-- Card do cliente (seção 7.5/7.8) + trilha de auditoria (LGPD / seção 6.4).

CREATE TYPE card_status AS ENUM ('kickoff', 'compareceu', 'no_show', 'orcamento_enviado');

CREATE TYPE collaborator AS ENUM ('alana', 'guilherme');

CREATE TABLE cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados do formulário (seção 7.2).
  company_name        text NOT NULL,
  client_name         text NOT NULL,
  integration_summary text NOT NULL,
  crm_name            text NOT NULL,
  client_phone_e164   text NOT NULL,

  -- Origem e atribuição.
  seller_email        text NOT NULL,
  assigned_to         collaborator NOT NULL,

  -- Agendamento (seção 7.3) — preenchido no submit.
  scheduled_at        timestamptz,
  google_event_id     text,
  meeting_url         text,

  status              card_status NOT NULL DEFAULT 'kickoff',

  -- Preenchidos pós-reunião (seção 7.6). Mantidos flexíveis; refinar no Passo 9.
  required_integration text,
  budget               text,
  production_deadline  text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cards_status_idx ON cards (status);
CREATE INDEX cards_seller_email_idx ON cards (seller_email);

-- Defesa em profundidade contra duplo-agendamento do mesmo slot (corrida —
-- cenário 7.1.12). A proteção em nível de aplicação é construída no Passo 7.
CREATE UNIQUE INDEX cards_collaborator_slot_unique
  ON cards (assigned_to, scheduled_at)
  WHERE scheduled_at IS NOT NULL AND status <> 'no_show';

-- Trilha de auditoria: quem fez o quê e quando, sem duplicar PII além do necessário.
CREATE TABLE audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_email  text NOT NULL,
  action       text NOT NULL,
  card_id      uuid REFERENCES cards (id) ON DELETE SET NULL,
  from_status  card_status,
  to_status    card_status,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_card_id_idx ON audit_log (card_id);
CREATE INDEX audit_log_created_at_idx ON audit_log (created_at);

-- Mantém updated_at coerente em qualquer UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_set_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
