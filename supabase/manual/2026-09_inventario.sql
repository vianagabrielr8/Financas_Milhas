-- =====================================================================
-- Pacote 2 / Etapa 0: INVENTÁRIO do banco real (SÓ LEITURA)
-- =====================================================================
-- O QUE FAZ: fotografa a ESTRUTURA do banco (tabelas, colunas, regras,
-- views, RLS, funções, gatilhos e usuários) para planejarmos as famílias
-- e o RLS em cima do que existe de verdade, e não do que achamos que existe.
--
-- NÃO ALTERA NADA: todos os passos são SELECT. Nenhum UPDATE, INSERT,
-- DELETE, CREATE, ALTER ou DROP.
--
-- NÃO MOSTRA SEUS LANÇAMENTOS: não aparece descrição, valor nem data de
-- nenhuma transação. Só nomes de tabelas/colunas, contagens e, no
-- PASSO 5, os e-mails e ids de quem já fez login no app.
--
-- COMO RODAR: Supabase (projeto de PRODUÇÃO) -> SQL Editor -> New query.
-- Cole UM passo por vez (do comentário "PASSO n" até o ponto e vírgula),
-- clique em Run. Cada passo devolve UMA linha com UMA célula de texto
-- (um JSON). Clique na célula, copie o conteúdo inteiro e me envie,
-- dizendo qual passo é ("PASSO 1: ...").
-- =====================================================================


-- PASSO 1: tabelas e views do esquema "public"
-- (tipo, RLS ligado ou não, quantas linhas, e todas as colunas).
SELECT jsonb_agg(t ORDER BY t->>'tabela') AS inventario_tabelas
FROM (
  SELECT jsonb_build_object(
    'tabela', c.relname,
    'tipo', CASE c.relkind
              WHEN 'r' THEN 'tabela'
              WHEN 'p' THEN 'tabela particionada'
              WHEN 'v' THEN 'view'
              WHEN 'm' THEN 'view materializada'
              WHEN 'f' THEN 'tabela externa'
            END,
    'rls_ligado', c.relrowsecurity,
    'rls_forcado', c.relforcerowsecurity,
    'opcoes', c.reloptions,
    'linhas', CASE WHEN c.relkind IN ('r', 'p') THEN
                (xpath('/row/n/text()',
                  query_to_xml(format('SELECT count(*) AS n FROM public.%I', c.relname),
                               false, true, '')))[1]::text::bigint
              END,
    'colunas', (
      SELECT jsonb_agg(jsonb_build_object(
               'coluna', a.attname,
               'tipo', format_type(a.atttypid, a.atttypmod),
               'obrigatoria', a.attnotnull,
               'padrao', pg_get_expr(d.adbin, d.adrelid)
             ) ORDER BY a.attnum)
      FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    )
  ) AS t
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
) s;


-- PASSO 2: regras das tabelas (chaves, "nome único", ligações entre
-- tabelas, CHECKs) e índices.
SELECT jsonb_build_object(
  'regras', (
    SELECT jsonb_agg(jsonb_build_object(
             'tabela', con.conrelid::regclass::text,
             'nome', con.conname,
             'tipo', CASE con.contype
                       WHEN 'p' THEN 'chave primaria'
                       WHEN 'u' THEN 'unico'
                       WHEN 'f' THEN 'chave estrangeira'
                       WHEN 'c' THEN 'check'
                       WHEN 'x' THEN 'exclusao'
                       ELSE con.contype::text
                     END,
             'definicao', pg_get_constraintdef(con.oid)
           ) ORDER BY con.conrelid::regclass::text, con.conname)
    FROM pg_constraint con
    WHERE con.connamespace = 'public'::regnamespace
      AND con.conrelid <> 0
  ),
  'indices', (
    SELECT jsonb_agg(jsonb_build_object(
             'tabela', i.tablename,
             'nome', i.indexname,
             'definicao', i.indexdef
           ) ORDER BY i.tablename, i.indexname)
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
  )
) AS inventario_regras;


-- PASSO 3: regras de RLS que já existem, definição das views,
-- versão do banco e extensões instaladas.
SELECT jsonb_build_object(
  'regras_rls', (
    SELECT jsonb_agg(jsonb_build_object(
             'tabela', p.tablename,
             'nome', p.policyname,
             'comando', p.cmd,
             'papeis', p.roles,
             'permissiva', p.permissive,
             'usando', p.qual,
             'verificando', p.with_check
           ) ORDER BY p.tablename, p.policyname)
    FROM pg_policies p
    WHERE p.schemaname = 'public'
  ),
  'views', (
    SELECT jsonb_agg(jsonb_build_object(
             'view', c.relname,
             'opcoes', c.reloptions,
             'definicao', pg_get_viewdef(c.oid, true)
           ) ORDER BY c.relname)
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind IN ('v', 'm')
  ),
  'versao_postgres', current_setting('server_version'),
  'extensoes', (
    SELECT jsonb_agg(e.extname || ' ' || e.extversion ORDER BY e.extname)
    FROM pg_extension e
  )
) AS inventario_rls_views;


-- PASSO 4: funções e gatilhos (só nomes e onde estão ligados, sem o
-- código de dentro) e se existem tabelas fora do "public".
SELECT jsonb_build_object(
  'funcoes', (
    SELECT jsonb_agg(jsonb_build_object(
             'nome', p.proname,
             'argumentos', pg_get_function_identity_arguments(p.oid),
             'retorna', pg_get_function_result(p.oid),
             'security_definer', p.prosecdef,
             'linguagem', l.lanname
           ) ORDER BY p.proname)
    FROM pg_proc p
    JOIN pg_language l ON l.oid = p.prolang
    WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  ),
  'gatilhos', (
    SELECT jsonb_agg(jsonb_build_object(
             'tabela', t.tgrelid::regclass::text,
             'nome', t.tgname,
             'definicao', pg_get_triggerdef(t.oid)
           ) ORDER BY t.tgrelid::regclass::text, t.tgname)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE NOT t.tgisinternal
      AND c.relnamespace IN ('public'::regnamespace, 'auth'::regnamespace)
      AND NOT (c.relnamespace = 'auth'::regnamespace AND t.tgname LIKE 'RI_%')
  ),
  'tabelas_em_outros_esquemas', (
    SELECT jsonb_agg(DISTINCT n.nspname || '.' || c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname NOT IN (
        'public', 'pg_catalog', 'information_schema', 'pg_toast',
        'auth', 'storage', 'realtime', '_realtime', 'supabase_functions',
        'supabase_migrations', 'extensions', 'graphql', 'graphql_public',
        'net', 'pgsodium', 'pgsodium_masks', 'vault', 'cron',
        '_analytics', 'pgbouncer', 'pgmq'
      )
      AND n.nspname NOT LIKE 'pg\_%'
  )
) AS inventario_funcoes;


-- PASSO 5: quem já fez login no app e, em cada tabela que tem a coluna
-- "user_id", quantas linhas estão sem usuário e quais ids aparecem.
-- (Serve para confirmar que hoje tudo é da sua família e descobrir
-- o id do seu usuário e o da sua esposa.)
WITH tabelas_com_user AS (
  SELECT col.table_name
  FROM information_schema.columns col
  JOIN information_schema.tables tab
    ON tab.table_schema = col.table_schema AND tab.table_name = col.table_name
  WHERE col.table_schema = 'public'
    AND col.column_name = 'user_id'
    AND tab.table_type = 'BASE TABLE'
), resumo AS (
  SELECT table_name,
         query_to_xml(format(
           'SELECT count(*) FILTER (WHERE user_id IS NULL) AS sem_usuario,
                   count(DISTINCT user_id) AS usuarios_distintos,
                   string_agg(DISTINCT user_id::text, '','') AS ids
            FROM public.%I', table_name), false, true, '') AS x
  FROM tabelas_com_user
)
SELECT jsonb_build_object(
  'usuarios', (
    SELECT jsonb_agg(jsonb_build_object(
             'id', u.id,
             'email', u.email,
             'criado_em', u.created_at::date,
             'ultimo_login', u.last_sign_in_at::date,
             'provedor', u.raw_app_meta_data->>'provider'
           ) ORDER BY u.created_at)
    FROM auth.users u
  ),
  'user_id_por_tabela', (
    SELECT jsonb_agg(jsonb_build_object(
             'tabela', r.table_name,
             'sem_usuario', (xpath('/row/sem_usuario/text()', r.x))[1]::text,
             'usuarios_distintos', (xpath('/row/usuarios_distintos/text()', r.x))[1]::text,
             'ids', (xpath('/row/ids/text()', r.x))[1]::text
           ) ORDER BY r.table_name)
    FROM resumo r
  )
) AS inventario_usuarios;


-- FIM. Não há PASSO de alteração nem "como desfazer": nada foi mudado.
