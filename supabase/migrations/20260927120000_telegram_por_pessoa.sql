-- =====================================================================
-- Pacote 2 / Etapa 5: bot do Telegram por PESSOA e por FAMÍLIA
-- =====================================================================
-- O QUE FAZ:
--   1. Vincula o SEU Telegram (chat 5595411198) ao seu usuário e à
--      Família Viana, para o bot novo te reconhecer desde o primeiro
--      minuto (sem precisar do /vincular).
--   2. Cria a coluna chat_id na triagem do bot (open_finance_staging),
--      para cada pessoa ter o PRÓPRIO lote de prints. Hoje o lote é um só
--      para todo mundo: o "limpar" de um apagaria o lote do outro.
--      As linhas que estiverem na triagem agora ficam marcadas como suas.
--
-- O QUE NÃO FAZ: não mexe em lançamentos, cartões, categorias etc.
--   O bot ATUAL continua funcionando depois deste arquivo (ele ignora
--   a coluna nova). Rode ESTE arquivo ANTES de publicar o bot novo.
--
-- COMO RODAR: Supabase (tdatvduchifakmocywhq) -> SQL Editor.
-- =====================================================================


-- PASSO 0 (conferência). Esperado: familia_do_dono = true,
--   ja_vinculado = false, coluna_existe = false.
SELECT
  EXISTS (SELECT 1 FROM public.familia_membro
           WHERE user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2') AS familia_do_dono,
  EXISTS (SELECT 1 FROM public.telegram_vinculo
           WHERE telegram_user_id = 5595411198) AS ja_vinculado,
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'open_finance_staging'
             AND column_name = 'chat_id') AS coluna_existe;


-- PASSO 1 (só leitura): quantas linhas estão na triagem agora
-- (vão ficar marcadas como do seu chat).
SELECT count(*) AS linhas_na_triagem FROM public.open_finance_staging;


-- PASSO 2: aplica. Rode o bloco inteiro.
BEGIN;

INSERT INTO public.telegram_vinculo (telegram_user_id, user_id, familia_id)
SELECT 5595411198, fm.user_id, fm.familia_id
FROM public.familia_membro fm
WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2';

ALTER TABLE public.open_finance_staging ADD COLUMN chat_id bigint;
UPDATE public.open_finance_staging SET chat_id = 5595411198 WHERE chat_id IS NULL;
CREATE INDEX open_finance_staging_chat_id_idx ON public.open_finance_staging (chat_id);

COMMIT;

-- Conferência: vinculado = true e sem_chat = 0.
SELECT
  EXISTS (SELECT 1 FROM public.telegram_vinculo WHERE telegram_user_id = 5595411198) AS vinculado,
  (SELECT count(*) FROM public.open_finance_staging WHERE chat_id IS NULL) AS sem_chat;


-- COMO DESFAZER (o bot atual não usa nada disto):
-- BEGIN;
-- DELETE FROM public.telegram_vinculo WHERE telegram_user_id = 5595411198;
-- DROP INDEX IF EXISTS public.open_finance_staging_chat_id_idx;
-- ALTER TABLE public.open_finance_staging DROP COLUMN IF EXISTS chat_id;
-- COMMIT;
