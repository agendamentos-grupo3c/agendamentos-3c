-- Remove Luan (implantador) e Evolux (segmento) do time de Implantação.
-- O Postgres não permite remover um valor de ENUM diretamente; recriamos os
-- tipos sem os valores e reapontamos as colunas.
--
-- PRÉ-CONDIÇÃO: nenhuma linha de `implantations` pode usar implanter='luan'
-- nem segment='evolux'. Se usar, a conversão (USING ...::text::tipo) falha e a
-- migration aborta inteira (roda em transação) — sem aplicar nada parcial.

ALTER TYPE implanter RENAME TO implanter_old;
CREATE TYPE implanter AS ENUM ('gabrielle', 'bryan', 'wagner');
ALTER TABLE implantations
  ALTER COLUMN implanter TYPE implanter USING implanter::text::implanter;
DROP TYPE implanter_old;

ALTER TYPE segment RENAME TO segment_old;
CREATE TYPE segment AS ENUM ('enterprise', 'middle', 'small');
ALTER TABLE implantations
  ALTER COLUMN segment TYPE segment USING segment::text::segment;
DROP TYPE segment_old;
