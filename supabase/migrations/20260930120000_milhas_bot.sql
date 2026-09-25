-- =====================================================================
-- Pacote 4 / Etapa 4.4: bot lê print do extrato de milhas
-- =====================================================================
-- O QUE FAZ: cria 2 tabelas pequenas, usadas só pelo bot do Telegram:
--   milhas_sessao_bot  qual conta de milhas a pessoa escolheu no bot
--                      (para saber de quem é o print que chega)
--   milhas_staging     os lançamentos lidos do print, esperando você
--                      aprovar ("✅ Gravar") antes de irem para o estoque
-- As duas ficam com RLS ligado e SEM regras: o app não enxerga; só o bot
-- (chave de servidor) usa, e o bot sempre filtra por família e por chat.
--
-- O QUE NÃO FAZ: não mexe em nenhuma tabela existente nem em dados.
--
-- COMO RODAR: Supabase -> SQL Editor. PASSO 0, depois PASSO 2 (bloco inteiro).
-- =====================================================================


-- PASSO 0 (conferência). Esperado: ja_existem = 0, tabelas_de_milhas = 7.
SELECT
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
     AND relname IN ('milhas_sessao_bot', 'milhas_staging')) AS ja_existem,
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
     AND relname IN ('milhas_programa', 'milhas_contato', 'milhas_conta', 'milhas_venda',
                     'milhas_movimento', 'milhas_venda_passageiro', 'milhas_parcela')) AS tabelas_de_milhas;


-- PASSO 1: nada a conferir (só cria tabelas novas e vazias).


-- PASSO 2: aplica. Rode o bloco inteiro.
BEGIN;

CREATE TABLE public.milhas_sessao_bot (
  chat_id       bigint PRIMARY KEY,
  familia_id    uuid NOT NULL REFERENCES public.familia(id) ON DELETE CASCADE,
  conta_id      uuid NOT NULL REFERENCES public.milhas_conta(id) ON DELETE CASCADE,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.milhas_staging (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL REFERENCES public.familia(id) ON DELETE CASCADE,
  chat_id    bigint NOT NULL,
  conta_id   uuid NOT NULL REFERENCES public.milhas_conta(id) ON DELETE CASCADE,
  data       date NOT NULL,
  descricao  text NOT NULL DEFAULT '',
  tipo       text NOT NULL CHECK (tipo IN ('COMPRA', 'BONUS', 'TRANSF_ENTRADA', 'AJUSTE_MAIS',
                                          'TRANSF_SAIDA', 'USO', 'EXPIROU', 'AJUSTE_MENOS')),
  quantidade bigint NOT NULL CHECK (quantidade > 0),
  custo      numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo >= 0),
  validade   date,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX milhas_staging_chat_idx ON public.milhas_staging (chat_id, data);

ALTER TABLE public.milhas_sessao_bot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milhas_staging   ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Conferência (esperado: 2).
SELECT count(*) AS criadas FROM pg_class WHERE relnamespace = 'public'::regnamespace
   AND relname IN ('milhas_sessao_bot', 'milhas_staging') AND relrowsecurity;


-- COMO DESFAZER:
-- BEGIN;
-- DROP TABLE IF EXISTS public.milhas_staging, public.milhas_sessao_bot;
-- COMMIT;
