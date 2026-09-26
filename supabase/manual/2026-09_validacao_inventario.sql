-- =====================================================================
-- Validação dos dados (etapa 1): LEVANTAMENTO, SÓ LEITURA
-- =====================================================================
-- O QUE FAZ: procura em transacao_pessoal tudo que foge do padrão combinado
--   (CLAUDE.md): tipo/situação fora da lista, valor zero ou negativo, cartão
--   e conta juntos (ou nenhum), mês da fatura escrito errado, parcelas com
--   formato diferente, possíveis duplicados etc.
-- NÃO ALTERA NADA. Pode rodar quantas vezes quiser.
-- COMO RODAR: SQL Editor. Rode o PASSO 0 e me mande o print.
--   Se quiser ver as linhas de um problema, rode o PASSO 1.
-- =====================================================================

-- PASSO 0: resumo (uma linha por problema, com a quantidade)
WITH t AS (SELECT * FROM public.transacao_pessoal)
SELECT problema, qtd FROM (
  SELECT 01 AS o, 'tipo fora da lista' AS problema, count(*) FILTER (WHERE tipo IS NULL OR tipo NOT IN ('DESPESA','RECEITA','ESTORNO','PAGAMENTO_FATURA')) AS qtd FROM t
  UNION ALL SELECT 02, 'situação fora da lista', count(*) FILTER (WHERE situacao IS NULL OR situacao NOT IN ('PAGO','PENDENTE','RECEBIDO')) FROM t
  UNION ALL SELECT 03, 'valor zero, vazio ou negativo', count(*) FILTER (WHERE valor IS NULL OR valor <= 0) FROM t
  UNION ALL SELECT 04, 'cartão E conta ao mesmo tempo', count(*) FILTER (WHERE cartao_id IS NOT NULL AND conta_id IS NOT NULL) FROM t
  UNION ALL SELECT 05, 'sem cartão e sem conta', count(*) FILTER (WHERE cartao_id IS NULL AND conta_id IS NULL) FROM t
  UNION ALL SELECT 06, 'cartão sem mês da fatura', count(*) FILTER (WHERE cartao_id IS NOT NULL AND mes_fatura IS NULL) FROM t
  UNION ALL SELECT 07, 'mês da fatura escrito errado (ex.: 09/2026, set/2026)', count(*) FILTER (WHERE mes_fatura IS NOT NULL AND mes_fatura !~ '^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)/20[0-9]{2}$') FROM t
  UNION ALL SELECT 08, 'conta bancária com mês da fatura', count(*) FILTER (WHERE cartao_id IS NULL AND conta_id IS NOT NULL AND mes_fatura IS NOT NULL) FROM t
  UNION ALL SELECT 09, 'pagamento de fatura com cartão (devia ser conta)', count(*) FILTER (WHERE tipo = 'PAGAMENTO_FATURA' AND cartao_id IS NOT NULL) FROM t
  UNION ALL SELECT 10, 'sem centro de custo', count(*) FILTER (WHERE centro_custo_id IS NULL) FROM t
  UNION ALL SELECT 11, 'despesa sem categoria', count(*) FILTER (WHERE tipo = 'DESPESA' AND categoria_id IS NULL) FROM t
  UNION ALL SELECT 12, 'sem família', count(*) FILTER (WHERE familia_id IS NULL) FROM t
  UNION ALL SELECT 13, 'data vazia ou fora de 2020–2030', count(*) FILTER (WHERE data IS NULL OR data < '2020-01-01' OR data > '2030-12-31') FROM t
  UNION ALL SELECT 14, 'parcela no formato [Parc n/t] (padrão é (n/t))', count(*) FILTER (WHERE descricao ~ '\[Parc [0-9]+/[0-9]+\]') FROM t
  UNION ALL SELECT 15, 'possíveis duplicados (mesma data, valor, descrição e cartão/conta)',
    (SELECT COALESCE(sum(n - 1), 0) FROM (SELECT count(*) n FROM t GROUP BY familia_id, data, valor, lower(btrim(descricao)), cartao_id, conta_id, mes_fatura HAVING count(*) > 1) d)
) x ORDER BY o;

-- PASSO 1 (opcional): ver as linhas de um problema. Troque o número em
-- "WHERE problema = 7" pelo número do problema do PASSO 0 (1 a 15).
WITH t AS (SELECT * FROM public.transacao_pessoal),
dup AS (SELECT familia_id, data, valor, lower(btrim(descricao)) d, cartao_id, conta_id, mes_fatura FROM t
        GROUP BY 1,2,3,4,5,6,7 HAVING count(*) > 1),
marcado AS (
  SELECT t.*, CASE
    WHEN tipo IS NULL OR tipo NOT IN ('DESPESA','RECEITA','ESTORNO','PAGAMENTO_FATURA') THEN 1
    WHEN situacao IS NULL OR situacao NOT IN ('PAGO','PENDENTE','RECEBIDO') THEN 2
    WHEN valor IS NULL OR valor <= 0 THEN 3
    WHEN cartao_id IS NOT NULL AND conta_id IS NOT NULL THEN 4
    WHEN cartao_id IS NULL AND conta_id IS NULL THEN 5
    WHEN cartao_id IS NOT NULL AND mes_fatura IS NULL THEN 6
    WHEN mes_fatura IS NOT NULL AND mes_fatura !~ '^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)/20[0-9]{2}$' THEN 7
    WHEN cartao_id IS NULL AND conta_id IS NOT NULL AND mes_fatura IS NOT NULL THEN 8
    WHEN tipo = 'PAGAMENTO_FATURA' AND cartao_id IS NOT NULL THEN 9
    WHEN centro_custo_id IS NULL THEN 10
    WHEN tipo = 'DESPESA' AND categoria_id IS NULL THEN 11
    WHEN familia_id IS NULL THEN 12
    WHEN data IS NULL OR data < '2020-01-01' OR data > '2030-12-31' THEN 13
    WHEN descricao ~ '\[Parc [0-9]+/[0-9]+\]' THEN 14
    WHEN EXISTS (SELECT 1 FROM dup WHERE dup.familia_id IS NOT DISTINCT FROM t.familia_id AND dup.data IS NOT DISTINCT FROM t.data
                 AND dup.valor IS NOT DISTINCT FROM t.valor AND dup.d IS NOT DISTINCT FROM lower(btrim(t.descricao))
                 AND dup.cartao_id IS NOT DISTINCT FROM t.cartao_id AND dup.conta_id IS NOT DISTINCT FROM t.conta_id
                 AND dup.mes_fatura IS NOT DISTINCT FROM t.mes_fatura) THEN 15
  END AS problema FROM t)
SELECT problema, id, data, descricao, valor, tipo, situacao, mes_fatura,
       (cartao_id IS NOT NULL) AS no_cartao, (conta_id IS NOT NULL) AS na_conta
FROM marcado WHERE problema = 7
ORDER BY data DESC LIMIT 200;
-- (Uma linha com vários problemas aparece só no primeiro número da lista.)
