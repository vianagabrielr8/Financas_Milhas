-- =====================================================================
-- Pacote 3 / Etapa 4: fechamento automático do jogo (quinzena, mês e trimestre)
-- =====================================================================
-- O QUE FAZ:
--   1. Tabela jogo_fechamento: guarda cada período já fechado (quinzena,
--      mês, trimestre), com o resultado, a meta, o gasto e o prêmio ligado.
--      Serve para o bot nunca mandar a mesma mensagem duas vezes.
--      Só o bot grava (chave de servidor); a família só consulta.
--   2. Liga o agendador do Supabase (pg_cron) e as chamadas de internet do
--      banco (pg_net).
--   3. Agenda, todo dia às 00h10 (horário de Brasília), uma chamada ao bot
--      com a tarefa "fechamento". O bot confere se algum período terminou
--      (com 2 dias de folga para lançamentos atrasados) e manda as mensagens.
--      A senha dessa chamada NÃO fica neste arquivo: fica no cofre do
--      Supabase (Vault), no PASSO 3, digitada por você.
-- NÃO MEXE em nenhum dado existente.
--
-- COMO RODAR (SQL Editor): PASSO 0; depois PASSO 2 (bloco inteiro);
-- depois o PASSO 3, trocando a senha.
-- =====================================================================


-- PASSO 0 (conferência). Esperado:
--   tabela_ja_existe = false, pg_cron e pg_net aparecem na lista (instalados ou não),
--   cofre = true
SELECT
  to_regclass('public.jogo_fechamento') IS NOT NULL AS tabela_ja_existe,
  (SELECT string_agg(name || ' ' || COALESCE(installed_version, '(não instalado)'), ', ')
     FROM pg_available_extensions WHERE name IN ('pg_cron', 'pg_net')) AS extensoes,
  to_regclass('vault.secrets') IS NOT NULL AS cofre;

-- PASSO 1: nada a conferir (tabela nova, nenhum dado muda).


-- PASSO 2: aplica. Rode o bloco inteiro.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.jogo_fechamento (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL REFERENCES public.familia(id) ON DELETE CASCADE,
  nivel      text NOT NULL CHECK (nivel IN ('QUINZENA', 'MES', 'TRIMESTRE')),
  periodo    text NOT NULL,          -- 2026-10-Q1, 2026-10-Q2, 2026-10, 2026-T4
  resultado  text NOT NULL CHECK (resultado IN ('GANHOU', 'PERDEU')),
  meta       numeric(12,2) NOT NULL,
  gasto      numeric(12,2) NOT NULL,
  desejo_id  uuid REFERENCES public.desejo(id) ON DELETE SET NULL,  -- prêmio conquistado
  criado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (familia_id, nivel, periodo)
);
CREATE INDEX jogo_fechamento_familia_idx ON public.jogo_fechamento (familia_id);
ALTER TABLE public.jogo_fechamento ENABLE ROW LEVEL SECURITY;
-- a família só consulta; quem grava é o bot (chave de servidor, que ignora o RLS)
CREATE POLICY familia_ver ON public.jogo_fechamento FOR SELECT TO authenticated
  USING (familia_id = (SELECT public.minha_familia()));

-- Todo dia 03:10 UTC = 00:10 em Brasília. A senha vem do cofre (PASSO 3).
SELECT cron.schedule('fechamento-jogo', '10 3 * * *', $job$
  SELECT net.http_post(
    url := 'https://tdatvduchifakmocywhq.supabase.co/functions/v1/telegram-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Fechamento-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'fechamento_secret')
    ),
    body := '{"internal_task": "fechamento"}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);

COMMIT;

-- Conferência. Esperado: 1 linha "fechamento-jogo" com "10 3 * * *"
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'fechamento-jogo';


-- PASSO 3: guarda a senha no cofre do Supabase.
-- Troque COLE_AQUI_A_SENHA pela MESMA senha que você cadastrou em
-- Edge Functions -> Secrets com o nome FECHAMENTO_SECRET. Rode só esta linha.
-- (A senha fica só no cofre do banco; não salve este arquivo com ela.)
-- SELECT vault.create_secret('COLE_AQUI_A_SENHA', 'fechamento_secret');

-- Para TESTAR agora, sem esperar a meia-noite (roda o mesmo que o agendador):
-- SELECT net.http_post(
--   url := 'https://tdatvduchifakmocywhq.supabase.co/functions/v1/telegram-webhook',
--   headers := jsonb_build_object('Content-Type', 'application/json',
--     'X-Fechamento-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'fechamento_secret')),
--   body := '{"internal_task": "fechamento"}'::jsonb, timeout_milliseconds := 30000);


-- COMO DESFAZER (código apenas; os fechamentos gravados se perdem):
-- SELECT cron.unschedule('fechamento-jogo');
-- DROP TABLE IF EXISTS public.jogo_fechamento;
-- DELETE FROM vault.secrets WHERE name = 'fechamento_secret';
-- (as extensões pg_cron e pg_net podem ficar; não atrapalham nada)
