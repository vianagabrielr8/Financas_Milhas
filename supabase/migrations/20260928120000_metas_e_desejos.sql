-- =====================================================================
-- Pacote 3 / Etapa 1: metas da casa, verba da Ingrid e lista de desejos
-- =====================================================================
-- O QUE FAZ:
--   1. Centros de custo ganham a marca "conta_na_meta". Só o "Familiar"
--      começa marcado; os outros (Dívidas, Terceiros, Milhas, Reembolsos,
--      empresas) ficam FORA da meta. Dá para mudar na tela Metas.
--   2. Tabela meta_mes: meta da casa e verba da categoria Ingrid por mês.
--      Já vem com: out/26 R$ 19.000, nov/26 R$ 18.500, dez/26 R$ 18.000,
--      jan a mar/27 R$ 17.000; verba Ingrid R$ 2.800 em todos.
--   3. Tabela desejo: a lista de desejos (prêmios), por nível
--      (QUINZENA, MES, TRIMESTRE). Qualquer pessoa da família cadastra;
--      o admin marca como conquistado/entregue.
--
-- O QUE NÃO FAZ: não mexe em lançamentos.
--
-- COMO RODAR: Supabase -> SQL Editor. PASSO 0, depois PASSO 2.
-- =====================================================================


-- PASSO 0 (conferência). Esperado: coluna_existe = false,
-- tabelas_existem = 0, centro_familiar = 1.
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'centro_custo_projeto'
             AND column_name = 'conta_na_meta') AS coluna_existe,
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
     AND relname IN ('meta_mes', 'desejo')) AS tabelas_existem,
  (SELECT count(*) FROM public.centro_custo_projeto cc
     JOIN public.familia_membro fm ON fm.familia_id = cc.familia_id
    WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2' AND cc.nome = 'Familiar') AS centro_familiar;


-- PASSO 1: nada a conferir (só cria coisas novas e marca o "Familiar").


-- PASSO 2: aplica. Rode o bloco inteiro.
BEGIN;

-- 1. Marca "conta na meta"
ALTER TABLE public.centro_custo_projeto
  ADD COLUMN conta_na_meta boolean NOT NULL DEFAULT false;

UPDATE public.centro_custo_projeto cc SET conta_na_meta = true
FROM public.familia_membro fm
WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2'
  AND cc.familia_id = fm.familia_id AND cc.nome = 'Familiar';

-- 2. Metas por mês
CREATE TABLE public.meta_mes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id   uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  mes          date NOT NULL CHECK (extract(day FROM mes) = 1),
  meta_casa    numeric(12,2) NOT NULL CHECK (meta_casa > 0),
  verba_ingrid numeric(12,2) CHECK (verba_ingrid IS NULL OR verba_ingrid >= 0),
  criado_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (familia_id, mes)
);

-- 3. Lista de desejos
CREATE TABLE public.desejo (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  titulo     text NOT NULL CHECK (length(btrim(titulo)) > 0),
  valor      numeric(12,2) CHECK (valor IS NULL OR valor >= 0),
  nivel      text NOT NULL CHECK (nivel IN ('QUINZENA', 'MES', 'TRIMESTRE')),
  situacao   text NOT NULL DEFAULT 'DESEJADO' CHECK (situacao IN ('DESEJADO', 'CONQUISTADO', 'ENTREGUE')),
  criado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX desejo_familia_id_idx ON public.desejo (familia_id);

-- Regras de acesso
ALTER TABLE public.meta_mes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desejo   ENABLE ROW LEVEL SECURITY;

CREATE POLICY familia_ver ON public.meta_mes FOR SELECT TO authenticated
  USING (familia_id = (SELECT public.minha_familia()));
CREATE POLICY familia_criar ON public.meta_mes FOR INSERT TO authenticated
  WITH CHECK (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()));
CREATE POLICY familia_editar ON public.meta_mes FOR UPDATE TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))
  WITH CHECK (familia_id = (SELECT public.minha_familia()));
CREATE POLICY familia_apagar ON public.meta_mes FOR DELETE TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()));

-- desejo: toda a família vê e cadastra; o autor edita/apaga enquanto
-- "DESEJADO"; o admin pode tudo (inclusive marcar conquistado/entregue).
CREATE POLICY desejo_ver ON public.desejo FOR SELECT TO authenticated
  USING (familia_id = (SELECT public.minha_familia()));
CREATE POLICY desejo_criar ON public.desejo FOR INSERT TO authenticated
  WITH CHECK (familia_id = (SELECT public.minha_familia())
              AND criado_por = (SELECT auth.uid()) AND situacao = 'DESEJADO');
CREATE POLICY desejo_editar ON public.desejo FOR UPDATE TO authenticated
  USING (familia_id = (SELECT public.minha_familia())
         AND ((SELECT public.sou_admin()) OR (criado_por = (SELECT auth.uid()) AND situacao = 'DESEJADO')))
  WITH CHECK (familia_id = (SELECT public.minha_familia())
              AND ((SELECT public.sou_admin()) OR situacao = 'DESEJADO'));
CREATE POLICY desejo_apagar ON public.desejo FOR DELETE TO authenticated
  USING (familia_id = (SELECT public.minha_familia())
         AND ((SELECT public.sou_admin()) OR (criado_por = (SELECT auth.uid()) AND situacao = 'DESEJADO')));

-- Metas iniciais (Família Viana)
INSERT INTO public.meta_mes (familia_id, mes, meta_casa, verba_ingrid)
SELECT fm.familia_id, m.mes, m.meta, 2800
FROM public.familia_membro fm
CROSS JOIN (VALUES ('2026-10-01'::date, 19000), ('2026-11-01', 18500), ('2026-12-01', 18000),
                   ('2027-01-01', 17000), ('2027-02-01', 17000), ('2027-03-01', 17000)) AS m(mes, meta)
WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2';

COMMIT;

-- Conferência: 6 metas e só o "Familiar" contando na meta.
SELECT
  (SELECT count(*) FROM public.meta_mes) AS metas,
  (SELECT string_agg(nome, ', ') FROM public.centro_custo_projeto WHERE conta_na_meta) AS contam_na_meta;


-- COMO DESFAZER (apaga só o que este arquivo criou):
-- BEGIN;
-- DROP TABLE IF EXISTS public.desejo;
-- DROP TABLE IF EXISTS public.meta_mes;
-- ALTER TABLE public.centro_custo_projeto DROP COLUMN IF EXISTS conta_na_meta;
-- COMMIT;
