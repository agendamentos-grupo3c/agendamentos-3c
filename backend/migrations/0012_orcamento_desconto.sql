-- Desconto no orçamento. `total` passa a ser o valor LÍQUIDO (após desconto);
-- guardamos também o bruto e o desconto aplicado para rastreio/relatório.
ALTER TABLE orcamento_envios ADD COLUMN total_bruto integer;
ALTER TABLE orcamento_envios ADD COLUMN desconto_aplicado integer NOT NULL DEFAULT 0;
ALTER TABLE orcamento_envios ADD COLUMN desconto_tipo text;

-- Linhas antigas: bruto = total (não havia desconto).
UPDATE orcamento_envios SET total_bruto = total WHERE total_bruto IS NULL;
