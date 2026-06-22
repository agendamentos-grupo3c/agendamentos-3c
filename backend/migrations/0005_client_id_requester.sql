-- ID do cliente (lead) + nome do solicitante (quem subiu o formulário) nos dois
-- fluxos. Email do solicitante já era persistido (seller_email).

ALTER TABLE cards
  ADD COLUMN client_id   text,
  ADD COLUMN seller_name text;

ALTER TABLE implantations
  ADD COLUMN client_id   text,
  ADD COLUMN seller_name text;
