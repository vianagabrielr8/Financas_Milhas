-- =====================================================================
-- Pacote 2 / Etapa 3: coluna familia_id nas tabelas que já existem
-- =====================================================================
-- O QUE FAZ (em 20 tabelas):
--   1. Cria a coluna familia_id (pode ficar vazia por enquanto).
--   2. Preenche TODAS as linhas atuais com a Família Viana.
--   3. Daqui pra frente, quem grava pelo app recebe a família sozinho
--      (valor padrão = minha_familia()).
--   4. Cria um índice (atalho de busca) em familia_id.
--   5. REDE DE SEGURANÇA temporária: se alguém gravar sem família e SEM
--      estar logado (o bot, que usa a chave de servidor), a linha recebe
--      a família do user_id gravado ou, sem user_id, a Família Viana.
--      Quem está logado mas não tem família NÃO cai na sua família.
--   6. Troca as regras de "nome único" para valer POR FAMÍLIA
--      (centro de custo, programa de milhas, CPF de titular e duas
--      tabelas vazias), para outra família poder usar os mesmos nomes.
--
-- O QUE NÃO FAZ: não muda nenhum valor que já existe (só preenche a coluna
--   nova) e não mexe nas regras de acesso (RLS). O app continua igual.
--
-- ANTES DE RODAR: cópia CSV de transacao_pessoal guardada (feito em 23/09).
--
-- COMO RODAR: Supabase (projeto tdatvduchifakmocywhq) -> SQL Editor.
--   Um passo por vez, na ordem.
-- =====================================================================


-- PASSO 0 (conferência). Resultado esperado:
--   familia_do_dono = true, tabelas_encontradas = 20, ja_tem_familia_id = 0
-- Se for diferente, PARE e me avise.
SELECT
  EXISTS (SELECT 1 FROM public.familia_membro
           WHERE user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2') AS familia_do_dono,
  (SELECT count(*) FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
      AND relname IN ('transacao_pessoal', 'cartao_pessoal', 'cartao_vinculado',
        'categoria_pessoal', 'subcategoria_pessoal', 'centro_custo_projeto',
        'conta_financeira_pessoal', 'sessao_bot', 'open_finance_staging',
        'memoria_categorizacao', 'auditoria_fila', 'movimentacao_milhas',
        'transacoes_financeiras', 'parcelas_financeiras', 'categoria_financas',
        'categorias', 'subcategorias', 'cartoes_credito', 'programas_fidelidade',
        'contas_titulares')) AS tabelas_encontradas,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'familia_id'
      AND table_name IN ('transacao_pessoal', 'cartao_pessoal', 'cartao_vinculado',
        'categoria_pessoal', 'subcategoria_pessoal', 'centro_custo_projeto',
        'conta_financeira_pessoal', 'sessao_bot', 'open_finance_staging',
        'memoria_categorizacao', 'auditoria_fila', 'movimentacao_milhas',
        'transacoes_financeiras', 'parcelas_financeiras', 'categoria_financas',
        'categorias', 'subcategorias', 'cartoes_credito', 'programas_fidelidade',
        'contas_titulares')) AS ja_tem_familia_id;


-- PASSO 1 (só leitura): quantas linhas cada tabela tem hoje. Anote os
-- números de transacao_pessoal (1518) e das configurações; no fim do
-- passo seguinte os totais têm que ser os mesmos.
SELECT 'transacao_pessoal' AS tabela, count(*) FROM public.transacao_pessoal
UNION ALL SELECT 'cartao_pessoal', count(*) FROM public.cartao_pessoal
UNION ALL SELECT 'cartao_vinculado', count(*) FROM public.cartao_vinculado
UNION ALL SELECT 'categoria_pessoal', count(*) FROM public.categoria_pessoal
UNION ALL SELECT 'subcategoria_pessoal', count(*) FROM public.subcategoria_pessoal
UNION ALL SELECT 'centro_custo_projeto', count(*) FROM public.centro_custo_projeto
UNION ALL SELECT 'conta_financeira_pessoal', count(*) FROM public.conta_financeira_pessoal
UNION ALL SELECT 'sessao_bot', count(*) FROM public.sessao_bot
UNION ALL SELECT 'categoria_financas', count(*) FROM public.categoria_financas;


-- PASSO 2: aplica. Copie do BEGIN até o fim da conferência e rode de uma
-- vez. Se der qualquer erro, NADA é gravado.
BEGIN;

-- Rede de segurança (temporária; sai na etapa 7).
CREATE FUNCTION public.rede_seguranca_familia() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_familia uuid;
BEGIN
  IF NEW.familia_id IS NULL AND auth.uid() IS NULL THEN
    -- 1º: a família de quem aparece no user_id da linha (se a tabela tiver)
    SELECT fm.familia_id INTO v_familia
    FROM public.familia_membro fm
    WHERE fm.user_id = nullif(to_jsonb(NEW)->>'user_id', '')::uuid;
    -- 2º: sem user_id, a família do dono (hoje só ele usa o bot)
    IF v_familia IS NULL THEN
      SELECT fm.familia_id INTO v_familia
      FROM public.familia_membro fm
      WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2';
    END IF;
    NEW.familia_id := v_familia;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rede_seguranca_familia() FROM PUBLIC, anon;

DO $$
DECLARE
  v_fam uuid;
  v_tem boolean;
  t     text;
  tabelas text[] := ARRAY['transacao_pessoal', 'cartao_pessoal', 'cartao_vinculado',
    'categoria_pessoal', 'subcategoria_pessoal', 'centro_custo_projeto',
    'conta_financeira_pessoal', 'sessao_bot', 'open_finance_staging',
    'memoria_categorizacao', 'auditoria_fila', 'movimentacao_milhas',
    'transacoes_financeiras', 'parcelas_financeiras', 'categoria_financas',
    'categorias', 'subcategorias', 'cartoes_credito', 'programas_fidelidade',
    'contas_titulares'];
BEGIN
  SELECT familia_id INTO v_fam FROM public.familia_membro
  WHERE user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2';
  IF v_fam IS NULL THEN
    RAISE EXCEPTION 'Família do dono não encontrada. Rode a etapa 2 antes.';
  END IF;

  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN familia_id uuid REFERENCES public.familia(id)', t);
    EXECUTE format('UPDATE public.%I SET familia_id = %L', t, v_fam);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN familia_id SET DEFAULT public.minha_familia()', t);
    EXECUTE format('CREATE INDEX %I ON public.%I (familia_id)', t || '_familia_id_idx', t);
    EXECUTE format('CREATE TRIGGER rede_seguranca_familia BEFORE INSERT ON public.%I '
                   'FOR EACH ROW EXECUTE FUNCTION public.rede_seguranca_familia()', t);
  END LOOP;

  -- Trava: se sobrou qualquer linha sem família, desfaz tudo.
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE familia_id IS NULL)', t)
      INTO v_tem;
    IF v_tem THEN
      RAISE EXCEPTION 'A tabela % ficou com linha sem família. Nada foi gravado.', t;
    END IF;
  END LOOP;
END $$;

-- "Nome único" passa a valer por família.
ALTER TABLE public.centro_custo_projeto
  DROP CONSTRAINT centro_custo_projeto_nome_key,
  ADD CONSTRAINT centro_custo_projeto_familia_nome_key UNIQUE (familia_id, nome);
ALTER TABLE public.programas_fidelidade
  DROP CONSTRAINT programas_fidelidade_nome_key,
  ADD CONSTRAINT programas_fidelidade_familia_nome_key UNIQUE (familia_id, nome);
ALTER TABLE public.contas_titulares
  DROP CONSTRAINT contas_titulares_cpf_key,
  ADD CONSTRAINT contas_titulares_familia_cpf_key UNIQUE (familia_id, cpf);
ALTER TABLE public.categorias
  DROP CONSTRAINT categorias_nome_key,
  ADD CONSTRAINT categorias_familia_nome_key UNIQUE (familia_id, nome);
ALTER TABLE public.cartoes_credito
  DROP CONSTRAINT cartoes_credito_nome_key,
  ADD CONSTRAINT cartoes_credito_familia_nome_key UNIQUE (familia_id, nome);

COMMIT;

-- Conferência: todas as linhas com a Família Viana e nenhuma sem família.
-- "sem_familia" tem que ser 0 em todas; "total" igual ao PASSO 1.
SELECT 'transacao_pessoal' AS tabela, count(*) AS total, count(*) FILTER (WHERE familia_id IS NULL) AS sem_familia FROM public.transacao_pessoal
UNION ALL SELECT 'cartao_pessoal', count(*), count(*) FILTER (WHERE familia_id IS NULL) FROM public.cartao_pessoal
UNION ALL SELECT 'cartao_vinculado', count(*), count(*) FILTER (WHERE familia_id IS NULL) FROM public.cartao_vinculado
UNION ALL SELECT 'categoria_pessoal', count(*), count(*) FILTER (WHERE familia_id IS NULL) FROM public.categoria_pessoal
UNION ALL SELECT 'subcategoria_pessoal', count(*), count(*) FILTER (WHERE familia_id IS NULL) FROM public.subcategoria_pessoal
UNION ALL SELECT 'centro_custo_projeto', count(*), count(*) FILTER (WHERE familia_id IS NULL) FROM public.centro_custo_projeto
UNION ALL SELECT 'conta_financeira_pessoal', count(*), count(*) FILTER (WHERE familia_id IS NULL) FROM public.conta_financeira_pessoal
UNION ALL SELECT 'sessao_bot', count(*), count(*) FILTER (WHERE familia_id IS NULL) FROM public.sessao_bot
UNION ALL SELECT 'categoria_financas', count(*), count(*) FILTER (WHERE familia_id IS NULL) FROM public.categoria_financas;


-- COMO DESFAZER (remove só o que este arquivo criou; os dados continuam).
-- Se outra família já tiver criado um nome igual ao seu (ex.: centro de
-- custo "Casa"), o desfazer dá erro e não muda nada: me chame.
-- Rode o bloco inteiro:
--
-- BEGIN;
-- ALTER TABLE public.centro_custo_projeto DROP CONSTRAINT centro_custo_projeto_familia_nome_key, ADD CONSTRAINT centro_custo_projeto_nome_key UNIQUE (nome);
-- ALTER TABLE public.programas_fidelidade DROP CONSTRAINT programas_fidelidade_familia_nome_key, ADD CONSTRAINT programas_fidelidade_nome_key UNIQUE (nome);
-- ALTER TABLE public.contas_titulares DROP CONSTRAINT contas_titulares_familia_cpf_key, ADD CONSTRAINT contas_titulares_cpf_key UNIQUE (cpf);
-- ALTER TABLE public.categorias DROP CONSTRAINT categorias_familia_nome_key, ADD CONSTRAINT categorias_nome_key UNIQUE (nome);
-- ALTER TABLE public.cartoes_credito DROP CONSTRAINT cartoes_credito_familia_nome_key, ADD CONSTRAINT cartoes_credito_nome_key UNIQUE (nome);
-- DO $$
-- DECLARE t text;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['transacao_pessoal', 'cartao_pessoal', 'cartao_vinculado',
--     'categoria_pessoal', 'subcategoria_pessoal', 'centro_custo_projeto',
--     'conta_financeira_pessoal', 'sessao_bot', 'open_finance_staging',
--     'memoria_categorizacao', 'auditoria_fila', 'movimentacao_milhas',
--     'transacoes_financeiras', 'parcelas_financeiras', 'categoria_financas',
--     'categorias', 'subcategorias', 'cartoes_credito', 'programas_fidelidade',
--     'contas_titulares'] LOOP
--     EXECUTE format('DROP TRIGGER IF EXISTS rede_seguranca_familia ON public.%I', t);
--     EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS familia_id', t);
--   END LOOP;
-- END $$;
-- DROP FUNCTION IF EXISTS public.rede_seguranca_familia();
-- COMMIT;
