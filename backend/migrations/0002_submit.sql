-- Passo 8: campo de e-mail do cliente + suporte a idempotência e rastreio de
-- disparos das integrações (Slack/WhatsApp/ClickUp) para falha parcial.

ALTER TABLE cards ADD COLUMN client_email text NOT NULL DEFAULT '';
ALTER TABLE cards ALTER COLUMN client_email DROP DEFAULT;

ALTER TABLE cards
  ADD COLUMN idempotency_key   text,
  ADD COLUMN slack_notified_at timestamptz,
  ADD COLUMN whatsapp_sent_at  timestamptz,
  ADD COLUMN clickup_synced_at timestamptz,
  ADD COLUMN clickup_task_id   text;

-- Idempotência do submit: a mesma Idempotency-Key não cria card duplicado.
CREATE UNIQUE INDEX cards_idempotency_key_unique
  ON cards (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
