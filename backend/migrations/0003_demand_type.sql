-- Tipo da demanda (automação/integração) — preenchido no formulário e enviado
-- ao custom field do ClickUp.
ALTER TABLE cards ADD COLUMN demand_type text;
