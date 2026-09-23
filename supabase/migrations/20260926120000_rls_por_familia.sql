-- =====================================================================
-- Pacote 2 / Etapa 6: proteção por FAMÍLIA (RLS) no lugar de "por usuário"
-- =====================================================================
-- O QUE FAZ: troca as regras de acesso das tabelas usadas pelo app.
--   ANTES: cada pessoa só via as linhas que ela mesma criou (user_id).
--   DEPOIS: cada pessoa vê as linhas da SUA FAMÍLIA; só o ADMIN da família
--           cria, edita e apaga pelo app (o membro só consulta).
--
--   São 3 BLOCOS, rodados um de cada vez, testando o app entre eles:
--     BLOCO A: Milhas (programas_fidelidade, contas_titulares) - vazias
--     BLOCO B: configurações (cartões, cartões adicionais, contas,
--              categorias, subcategorias, centros de custo)
--     BLOCO C: transacao_pessoal (seus lançamentos) + ajuste das funções
--              de contestação para usar a família
--
--   Cada bloco tem um AUTOTESTE: dentro da mesma operação, o banco finge
--   ser VOCÊ e confere que você continua vendo TODAS as linhas; depois
--   finge ser a CONTA DE TESTE (sem família) e confere que ela vê ZERO.
--   Se qualquer conferência falhar, dá erro e NADA é gravado.
--
-- O QUE NÃO MUDA: o bot usa a chave de servidor e não é afetado.
--   Tabelas só do bot (sessao_bot, open_finance_staging etc.) continuam
--   fechadas para o app, como hoje.
--
-- ANTES DE RODAR: exporte de novo o CSV de transacao_pessoal
--   (Table Editor -> transacao_pessoal -> Export -> CSV).
--
-- COMO RODAR: Supabase (tdatvduchifakmocywhq) -> SQL Editor -> New query.
--   PASSO 0, depois BLOCO A, testar o app, BLOCO B, testar, BLOCO C, testar.
-- =====================================================================


-- PASSO 0 (conferência, só leitura). Resultado esperado:
--   familias_ok = true, regras_desconhecidas = 0, sem_familia = 0
-- ("regras_desconhecidas" = regras de acesso que eu não conheço nessas
--  tabelas; se não for 0, PARE e me avise.)
SELECT
  EXISTS (SELECT 1 FROM public.familia_membro
           WHERE user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2' AND papel = 'admin') AS familias_ok,
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('programas_fidelidade', 'contas_titulares', 'cartao_pessoal',
                        'cartao_vinculado', 'conta_financeira_pessoal', 'categoria_pessoal',
                        'subcategoria_pessoal', 'centro_custo_projeto', 'transacao_pessoal')
      AND policyname NOT IN ('Restricao_Absoluta_Dono', 'Permitir Leitura',
                             'familia_ver', 'familia_criar', 'familia_editar', 'familia_apagar')
  ) AS regras_desconhecidas,
  (SELECT count(*) FROM public.transacao_pessoal WHERE familia_id IS NULL) AS sem_familia;


-- PASSO 1 (só leitura): regras de acesso de hoje nessas tabelas.
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('programas_fidelidade', 'contas_titulares', 'cartao_pessoal',
                    'cartao_vinculado', 'conta_financeira_pessoal', 'categoria_pessoal',
                    'subcategoria_pessoal', 'centro_custo_projeto', 'transacao_pessoal')
ORDER BY tablename, policyname;


-- =====================================================================
-- BLOCO A: Milhas (tabelas vazias). Rode do BEGIN ao COMMIT de uma vez.
-- =====================================================================
BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['programas_fidelidade', 'contas_titulares'] LOOP
    EXECUTE format('CREATE POLICY familia_ver ON public.%I FOR SELECT TO authenticated USING (familia_id = (SELECT public.minha_familia()))', t);
    EXECUTE format('CREATE POLICY familia_criar ON public.%I FOR INSERT TO authenticated WITH CHECK (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))', t);
    EXECUTE format('CREATE POLICY familia_editar ON public.%I FOR UPDATE TO authenticated USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin())) WITH CHECK (familia_id = (SELECT public.minha_familia()))', t);
    EXECUTE format('CREATE POLICY familia_apagar ON public.%I FOR DELETE TO authenticated USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- guarda o total para o autoteste
    EXECUTE format('SELECT set_config(%L, (SELECT count(*) FROM public.%I)::text, true)', 'teste.' || t, t);
  END LOOP;
END $$;

-- AUTOTESTE (finge ser você, depois a conta de teste)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2', true),
       set_config('request.jwt.claims', '{"sub":"d327ec3e-5f8c-4b13-b023-fc1c3b37c8d2","role":"authenticated"}', true);
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['programas_fidelidade', 'contas_titulares'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n <> current_setting('teste.' || t)::bigint THEN
      RAISE EXCEPTION 'AUTOTESTE: você veria % de % linhas em %. Nada foi gravado.', n, current_setting('teste.' || t), t;
    END IF;
  END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub', '7b27139f-090d-4ec5-b18f-b5aac6b2bde7', true),
       set_config('request.jwt.claims', '{"sub":"7b27139f-090d-4ec5-b18f-b5aac6b2bde7","role":"authenticated"}', true);
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['programas_fidelidade', 'contas_titulares'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n <> 0 THEN
      RAISE EXCEPTION 'AUTOTESTE: a conta de teste veria % linhas em %. Nada foi gravado.', n, t;
    END IF;
  END LOOP;
END $$;
RESET ROLE;

COMMIT;

SELECT 'BLOCO A aplicado' AS resultado;


-- =====================================================================
-- BLOCO B: configurações de Finanças. Rode do BEGIN ao COMMIT de uma vez.
-- =====================================================================
BEGIN;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cartao_pessoal', 'cartao_vinculado', 'conta_financeira_pessoal',
                           'categoria_pessoal', 'subcategoria_pessoal', 'centro_custo_projeto'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Restricao_Absoluta_Dono" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Permitir Leitura" ON public.%I', t);
    EXECUTE format('CREATE POLICY familia_ver ON public.%I FOR SELECT TO authenticated USING (familia_id = (SELECT public.minha_familia()))', t);
    EXECUTE format('CREATE POLICY familia_criar ON public.%I FOR INSERT TO authenticated WITH CHECK (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))', t);
    EXECUTE format('CREATE POLICY familia_editar ON public.%I FOR UPDATE TO authenticated USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin())) WITH CHECK (familia_id = (SELECT public.minha_familia()))', t);
    EXECUTE format('CREATE POLICY familia_apagar ON public.%I FOR DELETE TO authenticated USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('SELECT set_config(%L, (SELECT count(*) FROM public.%I)::text, true)', 'teste.' || t, t);
  END LOOP;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2', true),
       set_config('request.jwt.claims', '{"sub":"d327ec3e-5f8c-4b13-b023-fc1c3b37c8d2","role":"authenticated"}', true);
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['cartao_pessoal', 'cartao_vinculado', 'conta_financeira_pessoal',
                           'categoria_pessoal', 'subcategoria_pessoal', 'centro_custo_projeto'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n <> current_setting('teste.' || t)::bigint THEN
      RAISE EXCEPTION 'AUTOTESTE: você veria % de % linhas em %. Nada foi gravado.', n, current_setting('teste.' || t), t;
    END IF;
  END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub', '7b27139f-090d-4ec5-b18f-b5aac6b2bde7', true),
       set_config('request.jwt.claims', '{"sub":"7b27139f-090d-4ec5-b18f-b5aac6b2bde7","role":"authenticated"}', true);
DO $$
DECLARE t text; n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['cartao_pessoal', 'cartao_vinculado', 'conta_financeira_pessoal',
                           'categoria_pessoal', 'subcategoria_pessoal', 'centro_custo_projeto'] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n <> 0 THEN
      RAISE EXCEPTION 'AUTOTESTE: a conta de teste veria % linhas em %. Nada foi gravado.', n, t;
    END IF;
  END LOOP;
END $$;
RESET ROLE;

COMMIT;

SELECT 'BLOCO B aplicado' AS resultado;


-- =====================================================================
-- BLOCO C: transacao_pessoal + funções de contestação.
-- Rode do BEGIN ao COMMIT de uma vez.
-- =====================================================================
BEGIN;

DROP POLICY IF EXISTS "Restricao_Absoluta_Dono" ON public.transacao_pessoal;
CREATE POLICY familia_ver ON public.transacao_pessoal FOR SELECT TO authenticated
  USING (familia_id = (SELECT public.minha_familia()));
CREATE POLICY familia_criar ON public.transacao_pessoal FOR INSERT TO authenticated
  WITH CHECK (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()));
CREATE POLICY familia_editar ON public.transacao_pessoal FOR UPDATE TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))
  WITH CHECK (familia_id = (SELECT public.minha_familia()));
CREATE POLICY familia_apagar ON public.transacao_pessoal FOR DELETE TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()));
ALTER TABLE public.transacao_pessoal ENABLE ROW LEVEL SECURITY;

-- Contestação passa a conferir a família pela coluna familia_id.
CREATE OR REPLACE FUNCTION public.transacao_da_minha_familia(p_transacao_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transacao_pessoal t
    WHERE t.id = p_transacao_id
      AND t.familia_id = public.minha_familia()
  )
$$;

CREATE OR REPLACE FUNCTION public.resolver_contestacao(p_id uuid, p_aceitar boolean) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_c record;
BEGIN
  IF NOT public.sou_admin() THEN
    RAISE EXCEPTION 'Só o admin da família pode resolver contestações.';
  END IF;

  SELECT * INTO v_c FROM public.contestacao_classificacao WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_c.familia_id IS DISTINCT FROM public.minha_familia() THEN
    RAISE EXCEPTION 'Contestação não encontrada.';
  END IF;
  IF v_c.situacao <> 'PENDENTE' THEN
    RAISE EXCEPTION 'Esta contestação já foi resolvida.';
  END IF;

  IF p_aceitar THEN
    IF NOT public.transacao_da_minha_familia(v_c.transacao_id) THEN
      RAISE EXCEPTION 'O lançamento não é da sua família.';
    END IF;
    IF v_c.categoria_sugerida_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.categoria_pessoal c
         WHERE c.id = v_c.categoria_sugerida_id AND c.familia_id = v_c.familia_id) THEN
      RAISE EXCEPTION 'A categoria sugerida não é da sua família.';
    END IF;
    IF v_c.subcategoria_sugerida_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.subcategoria_pessoal s
         WHERE s.id = v_c.subcategoria_sugerida_id
           AND s.categoria_id IS NOT DISTINCT FROM v_c.categoria_sugerida_id) THEN
      RAISE EXCEPTION 'A subcategoria sugerida não pertence à categoria sugerida.';
    END IF;

    UPDATE public.transacao_pessoal
    SET categoria_id = v_c.categoria_sugerida_id,
        subcategoria_id = v_c.subcategoria_sugerida_id
    WHERE id = v_c.transacao_id;
  END IF;

  UPDATE public.contestacao_classificacao
  SET situacao = CASE WHEN p_aceitar THEN 'ACEITA' ELSE 'RECUSADA' END,
      resolvido_por = auth.uid(),
      resolvido_em = now()
  WHERE id = p_id;
END;
$$;

SELECT set_config('teste.transacao_pessoal', (SELECT count(*) FROM public.transacao_pessoal)::text, true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2', true),
       set_config('request.jwt.claims', '{"sub":"d327ec3e-5f8c-4b13-b023-fc1c3b37c8d2","role":"authenticated"}', true);
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.transacao_pessoal;
  IF n <> current_setting('teste.transacao_pessoal')::bigint THEN
    RAISE EXCEPTION 'AUTOTESTE: você veria % de % lançamentos. Nada foi gravado.', n, current_setting('teste.transacao_pessoal');
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub', '7b27139f-090d-4ec5-b18f-b5aac6b2bde7', true),
       set_config('request.jwt.claims', '{"sub":"7b27139f-090d-4ec5-b18f-b5aac6b2bde7","role":"authenticated"}', true);
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.transacao_pessoal;
  IF n <> 0 THEN
    RAISE EXCEPTION 'AUTOTESTE: a conta de teste veria % lançamentos. Nada foi gravado.', n;
  END IF;
END $$;
RESET ROLE;

COMMIT;

SELECT 'BLOCO C aplicado' AS resultado,
       (SELECT count(*) FROM public.transacao_pessoal) AS lancamentos;


-- =====================================================================
-- COMO DESFAZER (cada bloco separado; devolve as regras antigas)
-- =====================================================================
-- Desfazer BLOCO C:
-- BEGIN;
-- DROP POLICY IF EXISTS familia_ver ON public.transacao_pessoal;
-- DROP POLICY IF EXISTS familia_criar ON public.transacao_pessoal;
-- DROP POLICY IF EXISTS familia_editar ON public.transacao_pessoal;
-- DROP POLICY IF EXISTS familia_apagar ON public.transacao_pessoal;
-- CREATE POLICY "Restricao_Absoluta_Dono" ON public.transacao_pessoal FOR ALL TO authenticated
--   USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- COMMIT;
-- (As funções de contestação podem ficar na versão nova: ninguém usa ainda.)
--
-- Desfazer BLOCO B:
-- BEGIN;
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['cartao_pessoal', 'cartao_vinculado', 'conta_financeira_pessoal',
--                            'categoria_pessoal', 'subcategoria_pessoal', 'centro_custo_projeto'] LOOP
--     EXECUTE format('DROP POLICY IF EXISTS familia_ver ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS familia_criar ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS familia_editar ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS familia_apagar ON public.%I', t);
--     IF t = 'cartao_vinculado' THEN
--       EXECUTE 'CREATE POLICY "Permitir Leitura" ON public.cartao_vinculado FOR SELECT TO authenticated USING (true)';
--     ELSE
--       EXECUTE format('CREATE POLICY "Restricao_Absoluta_Dono" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
--     END IF;
--   END LOOP;
-- END $$;
-- COMMIT;
--
-- Desfazer BLOCO A:
-- BEGIN;
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['programas_fidelidade', 'contas_titulares'] LOOP
--     EXECUTE format('DROP POLICY IF EXISTS familia_ver ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS familia_criar ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS familia_editar ON public.%I', t);
--     EXECUTE format('DROP POLICY IF EXISTS familia_apagar ON public.%I', t);
--   END LOOP;
-- END $$;
-- COMMIT;
