-- =====================================================================
-- Mover "Empréstimos / Taxas Juros" do centro Familiar para "Dívidas"
-- =====================================================================
-- O QUE FAZ:
--   1. A categoria de empréstimos passa a pertencer ao centro "Dívidas"
--      (assim o bot e a IA passam a sugerir o centro certo sozinhos).
--   2. Os lançamentos dessa categoria que hoje estão no centro "Familiar"
--      (inclusive parcelas futuras) passam para o centro "Dívidas".
--   Antes de mexer, guarda uma cópia (backup) para poder desfazer.
--
-- NÃO MEXE em valores, datas, descrições, nem em lançamentos de outros
-- centros de custo (ex.: empréstimos da empresa continuam onde estão).
--
-- COMO RODAR: Supabase -> SQL Editor. Um passo por vez.
-- =====================================================================


-- PASSO 0 (conferência): tem que aparecer EXATAMENTE 1 categoria de
-- empréstimos e EXATAMENTE 1 centro "Dívidas" e 1 "Familiar" na sua família.
-- Se aparecer 0 ou mais de 1 em qualquer coluna, PARE e me avise.
SELECT
  (SELECT count(*) FROM public.categoria_pessoal c
    JOIN public.familia_membro fm ON fm.familia_id = c.familia_id
    WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2'
      AND c.nome ILIKE 'empr%stimo%') AS categorias_emprestimo,
  (SELECT string_agg(c.nome, ' | ') FROM public.categoria_pessoal c
    JOIN public.familia_membro fm ON fm.familia_id = c.familia_id
    WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2'
      AND c.nome ILIKE 'empr%stimo%') AS nome_encontrado,
  (SELECT count(*) FROM public.centro_custo_projeto cc
    JOIN public.familia_membro fm ON fm.familia_id = cc.familia_id
    WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2' AND cc.nome = 'Dívidas') AS centro_dividas,
  (SELECT count(*) FROM public.centro_custo_projeto cc
    JOIN public.familia_membro fm ON fm.familia_id = cc.familia_id
    WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2' AND cc.nome = 'Familiar') AS centro_familiar,
  to_regclass('public.backup_2026_09_emprestimos_dividas') IS NOT NULL AS backup_ja_existe;


-- PASSO 1 (só leitura): quantos lançamentos vão mudar e quanto somam.
SELECT count(*) AS lancamentos, round(sum(t.valor), 2) AS valor_total,
       min(t.data) AS primeira_data, max(t.data) AS ultima_data
FROM public.transacao_pessoal t
JOIN public.categoria_pessoal c ON c.id = t.categoria_id
JOIN public.centro_custo_projeto cc ON cc.id = t.centro_custo_id
JOIN public.familia_membro fm ON fm.familia_id = t.familia_id
WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2'
  AND c.nome ILIKE 'empr%stimo%'
  AND cc.nome = 'Familiar';


-- PASSO 2: aplica. Rode o bloco inteiro de uma vez.
-- Se qualquer conferência falhar, dá erro e NADA é gravado.
BEGIN;

CREATE TABLE public.backup_2026_09_emprestimos_dividas (
  tabela text, id uuid, centro_custo_id_antigo uuid, copiado_em timestamptz DEFAULT now()
);
ALTER TABLE public.backup_2026_09_emprestimos_dividas ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_fam uuid; v_cat uuid; v_div uuid; v_fml uuid; n int;
BEGIN
  SELECT familia_id INTO v_fam FROM public.familia_membro
  WHERE user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2';

  SELECT count(*) INTO n FROM public.categoria_pessoal WHERE familia_id = v_fam AND nome ILIKE 'empr%stimo%';
  IF n <> 1 THEN RAISE EXCEPTION 'Esperava 1 categoria de empréstimos, achei %. Nada foi gravado.', n; END IF;
  SELECT id INTO v_cat FROM public.categoria_pessoal WHERE familia_id = v_fam AND nome ILIKE 'empr%stimo%';

  SELECT count(*) INTO n FROM public.centro_custo_projeto WHERE familia_id = v_fam AND nome = 'Dívidas';
  IF n <> 1 THEN RAISE EXCEPTION 'Esperava 1 centro "Dívidas", achei %. Nada foi gravado.', n; END IF;
  SELECT id INTO v_div FROM public.centro_custo_projeto WHERE familia_id = v_fam AND nome = 'Dívidas';

  SELECT count(*) INTO n FROM public.centro_custo_projeto WHERE familia_id = v_fam AND nome = 'Familiar';
  IF n <> 1 THEN RAISE EXCEPTION 'Esperava 1 centro "Familiar", achei %. Nada foi gravado.', n; END IF;
  SELECT id INTO v_fml FROM public.centro_custo_projeto WHERE familia_id = v_fam AND nome = 'Familiar';

  -- backup
  INSERT INTO public.backup_2026_09_emprestimos_dividas (tabela, id, centro_custo_id_antigo)
  SELECT 'categoria_pessoal', id, centro_custo_id FROM public.categoria_pessoal WHERE id = v_cat;
  INSERT INTO public.backup_2026_09_emprestimos_dividas (tabela, id, centro_custo_id_antigo)
  SELECT 'transacao_pessoal', id, centro_custo_id FROM public.transacao_pessoal
  WHERE familia_id = v_fam AND categoria_id = v_cat AND centro_custo_id = v_fml;

  -- mudança
  UPDATE public.categoria_pessoal SET centro_custo_id = v_div WHERE id = v_cat;
  UPDATE public.transacao_pessoal t SET centro_custo_id = v_div
  FROM public.backup_2026_09_emprestimos_dividas b
  WHERE b.tabela = 'transacao_pessoal' AND b.id = t.id;
END $$;

COMMIT;

-- Conferência: "movidos" tem que ser igual a "lancamentos" do PASSO 1,
-- e "ainda_no_familiar" tem que ser 0.
SELECT
  (SELECT count(*) FROM public.backup_2026_09_emprestimos_dividas WHERE tabela = 'transacao_pessoal') AS movidos,
  (SELECT count(*) FROM public.transacao_pessoal t
     JOIN public.categoria_pessoal c ON c.id = t.categoria_id
     JOIN public.centro_custo_projeto cc ON cc.id = t.centro_custo_id
     JOIN public.familia_membro fm ON fm.familia_id = t.familia_id
    WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2'
      AND c.nome ILIKE 'empr%stimo%' AND cc.nome = 'Familiar') AS ainda_no_familiar;


-- COMO DESFAZER (devolve tudo para onde estava):
-- BEGIN;
-- UPDATE public.transacao_pessoal t SET centro_custo_id = b.centro_custo_id_antigo
--   FROM public.backup_2026_09_emprestimos_dividas b WHERE b.tabela = 'transacao_pessoal' AND b.id = t.id;
-- UPDATE public.categoria_pessoal c SET centro_custo_id = b.centro_custo_id_antigo
--   FROM public.backup_2026_09_emprestimos_dividas b WHERE b.tabela = 'categoria_pessoal' AND b.id = c.id;
-- COMMIT;
