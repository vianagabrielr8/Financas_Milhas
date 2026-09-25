-- =====================================================================
-- Pacote 5 / Etapa 5.5: bot confirma créditos programados do clube
-- =====================================================================
-- O QUE FAZ: duas colunas novas, para o bot confirmar os créditos do clube.
--   1) milhas_staging.confirma_id: quando uma linha do print é o crédito do
--      clube que o app já programou, o bot liga a linha a esse crédito. Ao
--      gravar, ele só ACERTA a data e a quantidade do crédito (não duplica).
--   2) milhas_movimento.confirmado_em: quando o crédito foi conferido pelo
--      extrato (vazio = só programado). A tela de Clubes mostra isso.
-- NÃO MEXE em nenhum dado (só acrescenta colunas vazias).
-- COMO RODAR: Supabase -> SQL Editor. PASSO 0, depois PASSO 2.
-- =====================================================================

-- PASSO 0 (conferência). Esperado: colunas_ja_existem = 0, tabelas = 2
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'
     AND ((table_name = 'milhas_staging' AND column_name = 'confirma_id')
       OR (table_name = 'milhas_movimento' AND column_name = 'confirmado_em'))) AS colunas_ja_existem,
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'
     AND table_name IN ('milhas_staging', 'milhas_movimento')) AS tabelas;

-- PASSO 1: nada a conferir.

-- PASSO 2: aplica.
BEGIN;
ALTER TABLE public.milhas_staging
  ADD COLUMN confirma_id uuid REFERENCES public.milhas_movimento(id) ON DELETE SET NULL;
ALTER TABLE public.milhas_movimento
  ADD COLUMN confirmado_em timestamptz;
COMMIT;

-- Conferência (esperado: 2)
SELECT count(*) AS criadas FROM information_schema.columns WHERE table_schema = 'public'
  AND ((table_name = 'milhas_staging' AND column_name = 'confirma_id')
    OR (table_name = 'milhas_movimento' AND column_name = 'confirmado_em'));

-- COMO DESFAZER:
-- ALTER TABLE public.milhas_staging DROP COLUMN IF EXISTS confirma_id;
-- ALTER TABLE public.milhas_movimento DROP COLUMN IF EXISTS confirmado_em;
