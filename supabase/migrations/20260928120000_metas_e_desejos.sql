-- =====================================================================
-- Pacote 3 / Etapa 1: metas da casa, verba da Ingrid e lista de desejos
-- =====================================================================
-- O QUE FAZ:
--   1. Centros de custo ganham a marca "conta_na_meta". Só o "Familiar"
--      começa marcado; os outros (Dívidas, Terceiros, Milhas, Reembolsos,
--      empresas) ficam FORA da meta. Dá para mudar na tela Metas.
--   2. Tabela meta_categoria: meta de cada CATEGORIA por mês. A meta da
--      casa é a SOMA delas (out/26 R$ 19.000, nov R$ 18.500, dez R$ 18.000,
--      jan a mar/27 R$ 17.000). A verba da Ingrid é a meta da categoria
--      Ingrid (R$ 2.800). Categoria SEM meta não conta no placar da casa
--      (ex.: Investimentos); "Sem categoria" conta.
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
     AND relname IN ('meta_categoria', 'desejo')) AS tabelas_existem,
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

-- 2. Metas por categoria e mês
CREATE TABLE public.meta_categoria (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id   uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  mes          date NOT NULL CHECK (extract(day FROM mes) = 1),
  categoria_id uuid NOT NULL REFERENCES public.categoria_pessoal(id) ON DELETE CASCADE,
  valor        numeric(12,2) NOT NULL CHECK (valor >= 0),
  criado_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (familia_id, mes, categoria_id)
);
CREATE INDEX meta_categoria_familia_mes_idx ON public.meta_categoria (familia_id, mes);

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
ALTER TABLE public.meta_categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desejo   ENABLE ROW LEVEL SECURITY;

CREATE POLICY familia_ver ON public.meta_categoria FOR SELECT TO authenticated
  USING (familia_id = (SELECT public.minha_familia()));
CREATE POLICY familia_criar ON public.meta_categoria FOR INSERT TO authenticated
  WITH CHECK (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()));
CREATE POLICY familia_editar ON public.meta_categoria FOR UPDATE TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))
  WITH CHECK (familia_id = (SELECT public.minha_familia()));
CREATE POLICY familia_apagar ON public.meta_categoria FOR DELETE TO authenticated
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

-- Metas iniciais (Família Viana), por categoria. Somam 19.000 / 18.500 /
-- 18.000 / 17.000. Nome comparado sem acento e sem maiúscula.
INSERT INTO public.meta_categoria (familia_id, mes, categoria_id, valor)
SELECT c.familia_id, v.mes::date, c.id, v.valor
FROM (VALUES
  ('ap',          '2026-10-01', 4500), ('ap',          '2026-11-01', 4400), ('ap',          '2026-12-01', 4300), ('ap',          '2027-01-01', 4100), ('ap',          '2027-02-01', 4100), ('ap',          '2027-03-01', 4100),
  ('gabriel',     '2026-10-01', 3000), ('gabriel',     '2026-11-01', 2900), ('gabriel',     '2026-12-01', 2800), ('gabriel',     '2027-01-01', 2500), ('gabriel',     '2027-02-01', 2500), ('gabriel',     '2027-03-01', 2500),
  ('ingrid',      '2026-10-01', 2800), ('ingrid',      '2026-11-01', 2800), ('ingrid',      '2026-12-01', 2800), ('ingrid',      '2027-01-01', 2800), ('ingrid',      '2027-02-01', 2800), ('ingrid',      '2027-03-01', 2800),
  ('bebe',        '2026-10-01', 1800), ('bebe',        '2026-11-01', 1800), ('bebe',        '2026-12-01', 1800), ('bebe',        '2027-01-01', 1700), ('bebe',        '2027-02-01', 1700), ('bebe',        '2027-03-01', 1700),
  ('carros',      '2026-10-01', 1500), ('carros',      '2026-11-01', 1400), ('carros',      '2026-12-01', 1400), ('carros',      '2027-01-01', 1300), ('carros',      '2027-02-01', 1300), ('carros',      '2027-03-01', 1300),
  ('alimentacao', '2026-10-01', 1800), ('alimentacao', '2026-11-01', 1800), ('alimentacao', '2026-12-01', 1800), ('alimentacao', '2027-01-01', 1800), ('alimentacao', '2027-02-01', 1800), ('alimentacao', '2027-03-01', 1800),
  ('i.r',         '2026-10-01',  300), ('i.r',         '2026-11-01',  300), ('i.r',         '2026-12-01',  300), ('i.r',         '2027-01-01',  300), ('i.r',         '2027-02-01',  300), ('i.r',         '2027-03-01',  300),
  ('lazer',       '2026-10-01', 1000), ('lazer',       '2026-11-01',  900), ('lazer',       '2026-12-01',  800), ('lazer',       '2027-01-01',  700), ('lazer',       '2027-02-01',  700), ('lazer',       '2027-03-01',  700),
  ('eventos',     '2026-10-01', 1000), ('eventos',     '2026-11-01',  900), ('eventos',     '2026-12-01',  800), ('eventos',     '2027-01-01',  800), ('eventos',     '2027-02-01',  800), ('eventos',     '2027-03-01',  800),
  ('farmacia',    '2026-10-01',  900), ('farmacia',    '2026-11-01',  900), ('farmacia',    '2026-12-01',  800), ('farmacia',    '2027-01-01',  700), ('farmacia',    '2027-02-01',  700), ('farmacia',    '2027-03-01',  700),
  ('servicos',    '2026-10-01',  400), ('servicos',    '2026-11-01',  400), ('servicos',    '2026-12-01',  400), ('servicos',    '2027-01-01',  300), ('servicos',    '2027-02-01',  300), ('servicos',    '2027-03-01',  300)
) AS v(nome, mes, valor)
JOIN public.familia_membro fm ON fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2'
JOIN public.categoria_pessoal c
  ON c.familia_id = fm.familia_id
 AND lower(translate(btrim(c.nome), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) = v.nome;

COMMIT;

-- Conferência: meta da casa por mês (esperado 19000 / 18500 / 18000 /
-- 17000 / 17000 / 17000) e só o "Familiar" contando na meta. Se algum
-- mês vier menor, alguma categoria não foi achada pelo nome: me avise.
SELECT mes, sum(valor) AS meta_da_casa, count(*) AS categorias
FROM public.meta_categoria GROUP BY mes ORDER BY mes;
SELECT
  (SELECT string_agg(nome, ', ') FROM public.centro_custo_projeto WHERE conta_na_meta) AS contam_na_meta;


-- COMO DESFAZER (apaga só o que este arquivo criou):
-- BEGIN;
-- DROP TABLE IF EXISTS public.desejo;
-- DROP TABLE IF EXISTS public.meta_categoria;
-- ALTER TABLE public.centro_custo_projeto DROP COLUMN IF EXISTS conta_na_meta;
-- COMMIT;
