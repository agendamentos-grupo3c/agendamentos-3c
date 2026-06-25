-- Novo modelo de implantação: janelas (09:30–11:00 / 13:30–17:00) + produto que
-- define a duração e trava a sessão. slot_kind (horários fixos antigos) deixa de
-- ser usado.
CREATE TYPE implantation_product AS ENUM ('discador', 'omni', 'ura', 'pabx');

ALTER TABLE implantations ADD COLUMN product implantation_product;
ALTER TABLE implantations ALTER COLUMN slot_kind DROP NOT NULL;
