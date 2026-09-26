-- =====================================================================
-- Validação dos dados (etapa 3): travas no banco para transacao_pessoal
-- =====================================================================
-- O QUE FAZ: coloca regras dentro do próprio banco (CHECK = "o banco recusa
--   gravar se a regra não for cumprida"). Valem para a tela, a importação e o
--   bot, venha o dado de onde vier. São as regras do CLAUDE.md:
--   - tipo: DESPESA, RECEITA, ESTORNO ou PAGAMENTO_FATURA;
--   - situação: PAGO, PENDENTE ou RECEBIDO;
--   - valor sempre positivo;
--   - cartão OU conta (um dos dois, nunca os dois, nunca nenhum);
--   - compra no cartão tem mês da fatura no formato "Set/2026"; conta não tem;
--   - pagamento de fatura fica na conta, nunca no cartão.
-- O levantamento de 26/09/2026 deu ZERO linhas fora dessas regras, então
-- nada existente é afetado. Se alguma linha nova tiver entrado fora do
-- padrão depois disso, o PASSO 2 dá erro e NADA é gravado (aí me avise).
-- NÃO MEXE em nenhum dado.
-- COMO RODAR: SQL Editor. PASSO 0 e depois PASSO 2 (bloco inteiro).
-- =====================================================================

-- PASSO 0 (conferência). Esperado: fora_do_padrao = 0 e travas_ja_existem = 0
SELECT
  (SELECT count(*) FROM public.transacao_pessoal WHERE
      tipo IS NULL OR tipo NOT IN ('DESPESA','RECEITA','ESTORNO','PAGAMENTO_FATURA')
   OR situacao IS NULL OR situacao NOT IN ('PAGO','PENDENTE','RECEBIDO')
   OR valor IS NULL OR valor <= 0
   OR (cartao_id IS NULL) = (conta_id IS NULL)
   OR (cartao_id IS NOT NULL AND (mes_fatura IS NULL OR mes_fatura !~ '^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)/20[0-9]{2}$'))
   OR (cartao_id IS NULL AND mes_fatura IS NOT NULL)
   OR (tipo = 'PAGAMENTO_FATURA' AND cartao_id IS NOT NULL)) AS fora_do_padrao,
  (SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.transacao_pessoal'::regclass AND conname LIKE 'transacao_trava_%') AS travas_ja_existem;

-- PASSO 1: nada a mostrar (nenhum dado muda).

-- PASSO 2: aplica (rode o bloco inteiro).
BEGIN;
ALTER TABLE public.transacao_pessoal
  ADD CONSTRAINT transacao_trava_tipo CHECK (tipo IN ('DESPESA','RECEITA','ESTORNO','PAGAMENTO_FATURA')),
  ADD CONSTRAINT transacao_trava_situacao CHECK (situacao IN ('PAGO','PENDENTE','RECEBIDO')),
  ADD CONSTRAINT transacao_trava_valor CHECK (valor > 0),
  ADD CONSTRAINT transacao_trava_cartao_ou_conta CHECK ((cartao_id IS NULL) <> (conta_id IS NULL)),
  ADD CONSTRAINT transacao_trava_mes_fatura CHECK (
    CASE WHEN cartao_id IS NOT NULL
         THEN mes_fatura ~ '^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)/20[0-9]{2}$'
         ELSE mes_fatura IS NULL END),
  ADD CONSTRAINT transacao_trava_pagamento_fatura CHECK (tipo <> 'PAGAMENTO_FATURA' OR cartao_id IS NULL);
COMMIT;

-- Conferência. Esperado: 6
SELECT count(*) AS travas FROM pg_constraint
 WHERE conrelid = 'public.transacao_pessoal'::regclass AND conname LIKE 'transacao_trava_%';

-- COMO DESFAZER (tira as travas; nenhum dado muda):
-- ALTER TABLE public.transacao_pessoal
--   DROP CONSTRAINT IF EXISTS transacao_trava_tipo,
--   DROP CONSTRAINT IF EXISTS transacao_trava_situacao,
--   DROP CONSTRAINT IF EXISTS transacao_trava_valor,
--   DROP CONSTRAINT IF EXISTS transacao_trava_cartao_ou_conta,
--   DROP CONSTRAINT IF EXISTS transacao_trava_mes_fatura,
--   DROP CONSTRAINT IF EXISTS transacao_trava_pagamento_fatura;
