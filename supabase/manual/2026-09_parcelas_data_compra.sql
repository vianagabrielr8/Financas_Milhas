-- =====================================================================
-- Parcelas do cartão: todas com a DATA DA COMPRA
-- =====================================================================
-- O QUE FAZ: o bot gravava cada parcela de compra no cartão com a data
--   andando um mês ("Tênis (2/5)" em 05/11, "(3/5)" em 05/12...). A regra
--   agora é: toda parcela fica com a data da compra (igual à importação da
--   fatura); o mês de cada parcela continua vindo do mês da fatura.
--   Este arquivo acha as compras parceladas no cartão cujas parcelas têm
--   datas diferentes entre si e volta todas para a data da compra
--   (calculada pela parcela de menor número). Valor, fatura e descrição
--   não mudam. Antes guarda cópia (backup) na área fechada "backup".
-- COMO RODAR: SQL Editor. PASSO 0, PASSO 1 (confira), PASSO 2.
-- =====================================================================

-- PASSO 0 (só leitura). Esperado: backup_ja_existe = false. "parcelas_a_corrigir" = quantas mudam.
WITH p AS (
  SELECT t.id, t.familia_id, t.cartao_id, t.valor, t.data,
         regexp_replace(t.descricao, '\s*\(\d+/\d+\)\s*$', '') AS base,
         (regexp_match(t.descricao, '\((\d+)/(\d+)\)\s*$'))[1]::int AS n,
         (regexp_match(t.descricao, '\((\d+)/(\d+)\)\s*$'))[2]::int AS total
  FROM public.transacao_pessoal t
  WHERE t.cartao_id IS NOT NULL AND t.descricao ~ '\(\d+/\d+\)\s*$'),
g AS (
  SELECT familia_id, cartao_id, base, total, valor,
         (array_agg(data - make_interval(months => n - 1) ORDER BY n))[1]::date AS data_compra
  FROM p GROUP BY 1,2,3,4,5 HAVING count(DISTINCT data) > 1)
SELECT
  to_regclass('backup.parcelas_data_antes') IS NOT NULL AS backup_ja_existe,
  (SELECT count(*) FROM p JOIN g USING (familia_id, cartao_id, base, total, valor) WHERE p.data <> g.data_compra) AS parcelas_a_corrigir;

-- PASSO 1 (só leitura): como fica cada parcela
WITH p AS (
  SELECT t.id, t.familia_id, t.cartao_id, t.valor, t.data, t.descricao, t.mes_fatura,
         regexp_replace(t.descricao, '\s*\(\d+/\d+\)\s*$', '') AS base,
         (regexp_match(t.descricao, '\((\d+)/(\d+)\)\s*$'))[1]::int AS n,
         (regexp_match(t.descricao, '\((\d+)/(\d+)\)\s*$'))[2]::int AS total
  FROM public.transacao_pessoal t
  WHERE t.cartao_id IS NOT NULL AND t.descricao ~ '\(\d+/\d+\)\s*$'),
g AS (
  SELECT familia_id, cartao_id, base, total, valor,
         (array_agg(data - make_interval(months => n - 1) ORDER BY n))[1]::date AS data_compra
  FROM p GROUP BY 1,2,3,4,5 HAVING count(DISTINCT data) > 1)
SELECT p.descricao, p.mes_fatura, p.valor, p.data AS data_hoje, g.data_compra AS data_nova
FROM p JOIN g USING (familia_id, cartao_id, base, total, valor)
WHERE p.data <> g.data_compra
ORDER BY p.base, p.n;

-- PASSO 2: aplica (bloco inteiro).
BEGIN;
CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM PUBLIC, anon, authenticated;

CREATE TABLE backup.parcelas_data_antes AS
WITH p AS (
  SELECT t.id, t.familia_id, t.cartao_id, t.valor, t.data,
         regexp_replace(t.descricao, '\s*\(\d+/\d+\)\s*$', '') AS base,
         (regexp_match(t.descricao, '\((\d+)/(\d+)\)\s*$'))[1]::int AS n,
         (regexp_match(t.descricao, '\((\d+)/(\d+)\)\s*$'))[2]::int AS total
  FROM public.transacao_pessoal t
  WHERE t.cartao_id IS NOT NULL AND t.descricao ~ '\(\d+/\d+\)\s*$'),
g AS (
  SELECT familia_id, cartao_id, base, total, valor,
         (array_agg(data - make_interval(months => n - 1) ORDER BY n))[1]::date AS data_compra
  FROM p GROUP BY 1,2,3,4,5 HAVING count(DISTINCT data) > 1)
SELECT p.id, p.data AS data_antes, g.data_compra AS data_nova
FROM p JOIN g USING (familia_id, cartao_id, base, total, valor)
WHERE p.data <> g.data_compra;

UPDATE public.transacao_pessoal t SET data = b.data_nova
  FROM backup.parcelas_data_antes b WHERE b.id = t.id;
COMMIT;

-- Conferência: quantas parcelas foram corrigidas
SELECT count(*) AS corrigidas FROM backup.parcelas_data_antes;

-- COMO DESFAZER (volta as datas de antes):
-- BEGIN;
-- UPDATE public.transacao_pessoal t SET data = b.data_antes
--   FROM backup.parcelas_data_antes b WHERE b.id = t.id;
-- COMMIT;
