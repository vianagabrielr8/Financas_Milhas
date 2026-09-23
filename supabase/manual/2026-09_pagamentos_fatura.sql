-- =====================================================================
-- Correção: pagamentos de fatura antigos gravados como DESPESA
-- =====================================================================
-- O QUE FAZ: muda o "tipo" dos pagamentos de fatura antigos de 'DESPESA'
-- para 'PAGAMENTO_FATURA', para que eles parem de ser contados como gasto
-- em dobro (as compras do cartão já são contadas).
--
-- COMO RODAR: Supabase -> SQL Editor. Rode UM passo por vez, na ordem,
-- conferindo o resultado antes de seguir.
--
-- COMO RECONHECEMOS UM PAGAMENTO ANTIGO: são as linhas que o botão
-- "Pagar Fatura" criava:
--   descrição começa com "Pagamento Fatura ", sem cartão (cartao_id vazio),
--   tipo 'DESPESA' e observação "Liquidação de fatura do cartão ...".
-- =====================================================================


-- PASSO 0 (conferência): a coluna "tipo" aceita o valor novo?
-- Se aparecer alguma regra (CHECK) listando só DESPESA/RECEITA/ESTORNO,
-- ou se o tipo da coluna for um ENUM, PARE e me avise: será preciso
-- liberar o valor 'PAGAMENTO_FATURA' antes (o botão "Pagar Fatura" novo
-- também depende disso).
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transacao_pessoal' AND column_name = 'tipo';

SELECT conname, pg_get_constraintdef(oid) AS regra
FROM pg_constraint
WHERE conrelid = 'public.transacao_pessoal'::regclass AND contype = 'c';


-- PASSO 1 (só leitura): quais linhas serão alteradas?
SELECT id, data, descricao, valor, tipo, conta_id, observacao
FROM public.transacao_pessoal
WHERE tipo = 'DESPESA'
  AND cartao_id IS NULL
  AND descricao LIKE 'Pagamento Fatura %'
  AND observacao LIKE 'Liquidação de fatura do cartão %'
ORDER BY data;


-- PASSO 2: guarda os ids numa tabela de backup (para poder desfazer)
-- e depois altera. Rode o bloco inteiro de uma vez.
BEGIN;

CREATE TABLE IF NOT EXISTS public.backup_2026_09_pagamentos_fatura AS
SELECT id, tipo AS tipo_antigo, now() AS alterado_em
FROM public.transacao_pessoal
WHERE tipo = 'DESPESA'
  AND cartao_id IS NULL
  AND descricao LIKE 'Pagamento Fatura %'
  AND observacao LIKE 'Liquidação de fatura do cartão %';

UPDATE public.transacao_pessoal t
SET tipo = 'PAGAMENTO_FATURA'
FROM public.backup_2026_09_pagamentos_fatura b
WHERE t.id = b.id;

-- Conferência: os dois números abaixo devem ser iguais ao total do PASSO 1
SELECT
  (SELECT count(*) FROM public.backup_2026_09_pagamentos_fatura) AS guardados,
  (SELECT count(*) FROM public.transacao_pessoal t
     JOIN public.backup_2026_09_pagamentos_fatura b ON b.id = t.id
    WHERE t.tipo = 'PAGAMENTO_FATURA') AS alterados;

COMMIT;


-- PASSO 3 (SÓ SE PRECISAR DESFAZER): volta exatamente as linhas guardadas
-- no backup para o tipo antigo. Pagamentos novos, feitos depois, não são
-- tocados.
-- BEGIN;
-- UPDATE public.transacao_pessoal t
-- SET tipo = b.tipo_antigo
-- FROM public.backup_2026_09_pagamentos_fatura b
-- WHERE t.id = b.id;
-- COMMIT;

-- Quando tiver certeza de que está tudo certo, a tabela de backup pode
-- ser apagada:
-- DROP TABLE public.backup_2026_09_pagamentos_fatura;
