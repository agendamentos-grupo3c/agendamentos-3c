-- Fluxo do time de Implantação: agendamento de treinamentos por segmento.
-- Capacidade por slot (coletiva = 8, individual = 1) é controlada na aplicação
-- (lock + contagem); aqui guardamos uma reserva por linha.

CREATE TYPE implanter AS ENUM ('gabrielle', 'bryan', 'luan', 'wagner');
CREATE TYPE segment AS ENUM ('enterprise', 'middle', 'small', 'evolux');
CREATE TYPE implantation_slot_kind AS ENUM ('coletiva_manha', 'individual', 'coletiva_tarde');
CREATE TYPE implantation_status AS ENUM ('agendado', 'compareceu', 'no_show');

CREATE TABLE implantations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dados do lead (entrada manual; HubSpot fica para depois).
  company_name      text NOT NULL,
  client_name       text NOT NULL,
  client_email      text NOT NULL,
  client_phone_e164 text NOT NULL,
  segment           segment NOT NULL,

  -- Atribuição e slot.
  implanter         implanter NOT NULL,
  slot_date         date NOT NULL,
  slot_kind         implantation_slot_kind NOT NULL,
  scheduled_start   timestamptz NOT NULL,
  scheduled_end     timestamptz NOT NULL,

  -- Evento de treinamento já existente: guardamos a referência ao adicionar o
  -- cliente como convidado.
  google_event_id   text,
  meeting_url       text,

  status            implantation_status NOT NULL DEFAULT 'agendado',
  attendance_notes  text,

  seller_email      text NOT NULL,
  idempotency_key   text,
  n8n_notified_at   timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX implantations_idempotency_key_unique
  ON implantations (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX implantations_slot_idx ON implantations (implanter, slot_date, slot_kind);
CREATE INDEX implantations_seller_email_idx ON implantations (seller_email);
CREATE INDEX implantations_status_idx ON implantations (status);

-- Reaproveita a função set_updated_at() criada em 0001_init.sql.
CREATE TRIGGER implantations_set_updated_at
  BEFORE UPDATE ON implantations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
