-- =====================================================================
-- Pacote 2 / Etapa 2: FAMÍLIAS (só tabelas e funções NOVAS)
-- =====================================================================
-- O QUE FAZ:
--   Cria a estrutura de famílias, sem mexer em nenhuma tabela que já existe:
--   - familia ................... uma linha por família
--   - familia_membro ............ quem é de qual família, papel admin/membro
--   - convite_familia ........... convites do admin (por e-mail)
--   - cadastro_liberado ......... e-mails liberados para criar família própria
--   - administrador_plataforma .. quem cuida da lista acima (só o dono)
--   - contestacao_classificacao . "a categoria deste lançamento está errada"
--   - telegram_vinculo .......... conta do Telegram -> usuário -> família
--   - telegram_codigo_vinculo ... códigos de 6 dígitos para fazer o vínculo
--   E as funções minha_familia(), sou_admin(), sou_admin_plataforma(),
--   entrar_no_app(), resolver_contestacao(), gerar_codigo_telegram().
--   Todas as tabelas novas já nascem com RLS e regras (estão vazias,
--   então isso não afeta nada do que existe).
--
--   Por fim cria a SUA família (dono = admin) e marca você como
--   administrador da plataforma.
--
-- O QUE NÃO FAZ: não toca em transacao_pessoal, cartões, categorias etc.
--   O app continua funcionando exatamente igual.
--
-- COMO RODAR: Supabase (projeto tdatvduchifakmocywhq) -> SQL Editor.
--   Rode um passo por vez, na ordem.
-- =====================================================================


-- PASSO 0 (conferência): nada disto pode existir ainda, e o seu usuário
-- tem que existir. Resultado esperado: tabelas_ja_existentes = 0 e
-- dono_existe = true. Se for diferente, PARE e me avise.
SELECT
  (SELECT count(*) FROM pg_class
    WHERE relnamespace = 'public'::regnamespace
      AND relname IN ('familia', 'familia_membro', 'convite_familia',
                      'cadastro_liberado', 'administrador_plataforma',
                      'contestacao_classificacao', 'telegram_vinculo',
                      'telegram_codigo_vinculo')) AS tabelas_ja_existentes,
  EXISTS (SELECT 1 FROM auth.users
           WHERE id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2') AS dono_existe;


-- PASSO 1 (só leitura): este é o usuário que vira ADMIN da sua família
-- e administrador da plataforma. Confira se o e-mail é o seu.
SELECT id, email
FROM auth.users
WHERE id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2';


-- PASSO 2: cria tudo. Copie do BEGIN até o COMMIT e rode de uma vez.
-- Se der qualquer erro, nada é gravado.
BEGIN;

-- ---------- Tabelas base ----------
CREATE TABLE public.familia (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.familia_membro (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  familia_id uuid NOT NULL REFERENCES public.familia(id) ON DELETE CASCADE,
  papel      text NOT NULL CHECK (papel IN ('admin', 'membro')),
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX familia_membro_familia_id_idx ON public.familia_membro (familia_id);

CREATE TABLE public.administrador_plataforma (
  user_id   uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- ---------- Funções de apoio (usadas nas regras de acesso) ----------
-- "security definer" = a função consulta as tabelas com permissão própria,
-- mas só devolve informação sobre QUEM ESTÁ LOGADO.
CREATE FUNCTION public.minha_familia() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT familia_id FROM public.familia_membro WHERE user_id = auth.uid()
$$;

CREATE FUNCTION public.sou_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.familia_membro
                  WHERE user_id = auth.uid() AND papel = 'admin')
$$;

CREATE FUNCTION public.sou_admin_plataforma() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.administrador_plataforma
                  WHERE user_id = auth.uid())
$$;

-- Um lançamento é "da minha família" se quem o criou (user_id) é membro
-- da minha família. Na etapa 3 isto passa a usar a coluna familia_id.
CREATE FUNCTION public.transacao_da_minha_familia(p_transacao_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.transacao_pessoal t
    JOIN public.familia_membro fm ON fm.user_id = t.user_id
    WHERE t.id = p_transacao_id
      AND fm.familia_id = public.minha_familia()
  )
$$;

-- ---------- Convites e liberação ----------
CREATE TABLE public.convite_familia (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id    uuid NOT NULL DEFAULT public.minha_familia()
                REFERENCES public.familia(id) ON DELETE CASCADE,
  email         text NOT NULL CHECK (email = lower(btrim(email)) AND email LIKE '%@%'),
  papel         text NOT NULL DEFAULT 'membro' CHECK (papel IN ('admin', 'membro')),
  convidado_por uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  aceito_em     timestamptz
);
-- Um mesmo e-mail só pode ter UM convite pendente (evita dúvida de família).
CREATE UNIQUE INDEX convite_familia_email_pendente_idx
  ON public.convite_familia (email) WHERE aceito_em IS NULL;
CREATE INDEX convite_familia_familia_id_idx ON public.convite_familia (familia_id);

CREATE TABLE public.cadastro_liberado (
  email        text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email LIKE '%@%'),
  liberado_por uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  usado_em     timestamptz
);

-- ---------- Contestação de classificação ----------
CREATE TABLE public.contestacao_classificacao (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id               uuid NOT NULL DEFAULT public.minha_familia()
                           REFERENCES public.familia(id) ON DELETE CASCADE,
  transacao_id             uuid NOT NULL REFERENCES public.transacao_pessoal(id) ON DELETE CASCADE,
  categoria_sugerida_id    uuid REFERENCES public.categoria_pessoal(id) ON DELETE SET NULL,
  subcategoria_sugerida_id uuid REFERENCES public.subcategoria_pessoal(id) ON DELETE SET NULL,
  comentario               text,
  situacao                 text NOT NULL DEFAULT 'PENDENTE'
                           CHECK (situacao IN ('PENDENTE', 'ACEITA', 'RECUSADA')),
  criado_por               uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em                timestamptz NOT NULL DEFAULT now(),
  resolvido_por            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolvido_em             timestamptz
);
CREATE INDEX contestacao_familia_id_idx ON public.contestacao_classificacao (familia_id);
CREATE INDEX contestacao_transacao_id_idx ON public.contestacao_classificacao (transacao_id);

-- ---------- Telegram ----------
CREATE TABLE public.telegram_vinculo (
  telegram_user_id bigint PRIMARY KEY,
  user_id          uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  familia_id       uuid NOT NULL REFERENCES public.familia(id) ON DELETE CASCADE,
  criado_em        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telegram_vinculo_familia_id_idx ON public.telegram_vinculo (familia_id);

CREATE TABLE public.telegram_codigo_vinculo (
  codigo    text PRIMARY KEY,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expira_em timestamptz NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telegram_codigo_user_id_idx ON public.telegram_codigo_vinculo (user_id);

-- ---------- Funções chamadas pelo app ----------

-- Chamada logo após o login. Decide a família da pessoa:
-- 1) já tem família -> devolve;  2) tem convite -> entra nela;
-- 3) e-mail liberado -> ganha família própria como admin;
-- 4) senão -> NAO_LIBERADO.
CREATE FUNCTION public.entrar_no_app() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_email      text;
  v_confirmado timestamptz;
  v_nome       text;
  v_membro     record;
  v_convite    record;
  v_familia    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado.';
  END IF;

  -- Evita que dois cliques ao mesmo tempo criem duas famílias.
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));

  SELECT familia_id, papel INTO v_membro
  FROM public.familia_membro WHERE user_id = v_uid;
  IF FOUND THEN
    RETURN jsonb_build_object('situacao', 'OK',
                              'familia_id', v_membro.familia_id,
                              'papel', v_membro.papel);
  END IF;

  -- O e-mail vem da conta de login (confirmado pelo Google), não do app.
  SELECT lower(email), email_confirmed_at,
         coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
    INTO v_email, v_confirmado, v_nome
  FROM auth.users WHERE id = v_uid;

  IF v_email IS NULL OR v_confirmado IS NULL THEN
    RETURN jsonb_build_object('situacao', 'NAO_LIBERADO');
  END IF;

  SELECT id, familia_id, papel INTO v_convite
  FROM public.convite_familia
  WHERE email = v_email AND aceito_em IS NULL
  ORDER BY criado_em
  LIMIT 1
  FOR UPDATE;
  IF FOUND THEN
    INSERT INTO public.familia_membro (user_id, familia_id, papel)
    VALUES (v_uid, v_convite.familia_id, v_convite.papel);
    UPDATE public.convite_familia SET aceito_em = now() WHERE id = v_convite.id;
    RETURN jsonb_build_object('situacao', 'OK',
                              'familia_id', v_convite.familia_id,
                              'papel', v_convite.papel);
  END IF;

  IF EXISTS (SELECT 1 FROM public.cadastro_liberado WHERE email = v_email) THEN
    INSERT INTO public.familia (nome) VALUES ('Família de ' || v_nome)
    RETURNING id INTO v_familia;
    INSERT INTO public.familia_membro (user_id, familia_id, papel)
    VALUES (v_uid, v_familia, 'admin');
    UPDATE public.cadastro_liberado SET usado_em = now() WHERE email = v_email;
    RETURN jsonb_build_object('situacao', 'OK',
                              'familia_id', v_familia,
                              'papel', 'admin');
  END IF;

  RETURN jsonb_build_object('situacao', 'NAO_LIBERADO');
END;
$$;

-- Só o admin resolve. Se aceitar, troca a categoria do lançamento.
CREATE FUNCTION public.resolver_contestacao(p_id uuid, p_aceitar boolean) RETURNS void
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
    -- A categoria sugerida tem que ser de alguém da família.
    IF v_c.categoria_sugerida_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.categoria_pessoal c
         JOIN public.familia_membro fm ON fm.user_id = c.user_id
         WHERE c.id = v_c.categoria_sugerida_id AND fm.familia_id = v_c.familia_id) THEN
      RAISE EXCEPTION 'A categoria sugerida não é da sua família.';
    END IF;
    -- A subcategoria sugerida tem que pertencer à categoria sugerida.
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

-- Gera o código de 6 dígitos (vale 10 minutos) para vincular o Telegram.
CREATE FUNCTION public.gerar_codigo_telegram() RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_codigo text;
  v_tent   int := 0;
BEGIN
  IF v_uid IS NULL OR public.minha_familia() IS NULL THEN
    RAISE EXCEPTION 'É preciso estar logado e ter uma família.';
  END IF;

  DELETE FROM public.telegram_codigo_vinculo
  WHERE user_id = v_uid OR expira_em < now();

  LOOP
    v_tent := v_tent + 1;
    v_codigo := lpad((abs(('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::int) % 1000000)::text, 6, '0');
    BEGIN
      INSERT INTO public.telegram_codigo_vinculo (codigo, user_id, expira_em)
      VALUES (v_codigo, v_uid, now() + interval '10 minutes');
      RETURN v_codigo;
    EXCEPTION WHEN unique_violation THEN
      IF v_tent >= 5 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

-- Quem pode chamar as funções: só quem está logado.
REVOKE EXECUTE ON FUNCTION public.minha_familia(), public.sou_admin(),
  public.sou_admin_plataforma(), public.transacao_da_minha_familia(uuid),
  public.entrar_no_app(), public.resolver_contestacao(uuid, boolean),
  public.gerar_codigo_telegram()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minha_familia(), public.sou_admin(),
  public.sou_admin_plataforma(), public.transacao_da_minha_familia(uuid),
  public.entrar_no_app(), public.resolver_contestacao(uuid, boolean),
  public.gerar_codigo_telegram()
  TO authenticated, service_role;

-- ---------- RLS (regras de acesso) das tabelas novas ----------
ALTER TABLE public.familia                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.familia_membro            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrador_plataforma  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convite_familia           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadastro_liberado         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contestacao_classificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_vinculo          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_codigo_vinculo   ENABLE ROW LEVEL SECURITY;

-- familia: vê a sua; só o admin muda o nome.
CREATE POLICY familia_ver ON public.familia FOR SELECT TO authenticated
  USING (id = (SELECT public.minha_familia()));
CREATE POLICY familia_renomear ON public.familia FOR UPDATE TO authenticated
  USING (id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))
  WITH CHECK (id = (SELECT public.minha_familia()));

-- familia_membro: vê os da sua família; admin muda papel ou remove OUTROS
-- (não a si mesmo, para a família nunca ficar sem admin).
CREATE POLICY membro_ver ON public.familia_membro FOR SELECT TO authenticated
  USING (familia_id = (SELECT public.minha_familia()));
CREATE POLICY membro_mudar_papel ON public.familia_membro FOR UPDATE TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin())
         AND user_id <> (SELECT auth.uid()))
  WITH CHECK (familia_id = (SELECT public.minha_familia()));
CREATE POLICY membro_remover ON public.familia_membro FOR DELETE TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin())
         AND user_id <> (SELECT auth.uid()));

-- administrador_plataforma: cada um só consegue ver a própria linha.
CREATE POLICY admin_plataforma_ver ON public.administrador_plataforma FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- convite_familia: só o admin, e só da própria família.
CREATE POLICY convite_ver ON public.convite_familia FOR SELECT TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()));
CREATE POLICY convite_criar ON public.convite_familia FOR INSERT TO authenticated
  WITH CHECK (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin())
              AND convidado_por = (SELECT auth.uid()) AND aceito_em IS NULL);
CREATE POLICY convite_cancelar ON public.convite_familia FOR DELETE TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin())
         AND aceito_em IS NULL);

-- cadastro_liberado: só o administrador da plataforma.
CREATE POLICY liberado_admin_plataforma ON public.cadastro_liberado FOR ALL TO authenticated
  USING ((SELECT public.sou_admin_plataforma()))
  WITH CHECK ((SELECT public.sou_admin_plataforma()));

-- contestacao: toda a família vê; qualquer membro cria para lançamento
-- da família; o autor pode apagar enquanto estiver pendente.
-- Resolver só pela função resolver_contestacao().
CREATE POLICY contestacao_ver ON public.contestacao_classificacao FOR SELECT TO authenticated
  USING (familia_id = (SELECT public.minha_familia()));
CREATE POLICY contestacao_criar ON public.contestacao_classificacao FOR INSERT TO authenticated
  WITH CHECK (familia_id = (SELECT public.minha_familia())
              AND criado_por = (SELECT auth.uid())
              AND situacao = 'PENDENTE'
              AND resolvido_por IS NULL AND resolvido_em IS NULL
              AND public.transacao_da_minha_familia(transacao_id));
CREATE POLICY contestacao_apagar ON public.contestacao_classificacao FOR DELETE TO authenticated
  USING (criado_por = (SELECT auth.uid()) AND situacao = 'PENDENTE');

-- telegram_vinculo: a pessoa vê/remove o próprio; o admin vê/remove os
-- da família. Quem cria o vínculo é o bot (chave de servidor).
CREATE POLICY telegram_ver ON public.telegram_vinculo FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid())
         OR (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin())));
CREATE POLICY telegram_desvincular ON public.telegram_vinculo FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid())
         OR (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin())));

-- telegram_codigo_vinculo: cada um vê só o próprio código.
CREATE POLICY codigo_ver ON public.telegram_codigo_vinculo FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------- A SUA família ----------
WITH nova AS (
  INSERT INTO public.familia (nome) VALUES ('Família Viana') RETURNING id
)
INSERT INTO public.familia_membro (user_id, familia_id, papel)
SELECT 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2', id, 'admin' FROM nova;

INSERT INTO public.administrador_plataforma (user_id)
VALUES ('d327ec3e-5f8c-4b13-b023-fc1c3b37c8d2');

COMMIT;

-- Conferência: deve mostrar 1 família, você como admin, e você como
-- administrador da plataforma (admin_plataforma = true).
SELECT f.nome, fm.papel, u.email,
       EXISTS (SELECT 1 FROM public.administrador_plataforma a
                WHERE a.user_id = fm.user_id) AS admin_plataforma
FROM public.familia f
JOIN public.familia_membro fm ON fm.familia_id = f.id
JOIN auth.users u ON u.id = fm.user_id;


-- PASSO 3 (opcional, quando quiser): liberar o Daniel para ter a família
-- própria. Troque EMAIL_DO_DANIEL pelo e-mail Google dele (entre aspas).
-- Quando ele entrar no app pela primeira vez, a família dele é criada.
--
-- INSERT INTO public.cadastro_liberado (email, liberado_por)
-- VALUES (lower(btrim('EMAIL_DO_DANIEL')), 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2');


-- PASSO 4 (opcional, quando quiser): convidar sua esposa como MEMBRO da
-- sua família. Troque EMAIL_DA_ESPOSA pelo e-mail Google dela.
--
-- INSERT INTO public.convite_familia (familia_id, email, papel, convidado_por)
-- SELECT familia_id, lower(btrim('EMAIL_DA_ESPOSA')), 'membro', user_id
-- FROM public.familia_membro
-- WHERE user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2';


-- COMO DESFAZER (apaga só o que este arquivo criou; seus lançamentos,
-- cartões e categorias não são tocados). Rode o bloco inteiro:
--
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.entrar_no_app();
-- DROP FUNCTION IF EXISTS public.resolver_contestacao(uuid, boolean);
-- DROP FUNCTION IF EXISTS public.gerar_codigo_telegram();
-- DROP TABLE IF EXISTS public.telegram_codigo_vinculo;
-- DROP TABLE IF EXISTS public.telegram_vinculo;
-- DROP TABLE IF EXISTS public.contestacao_classificacao;
-- DROP TABLE IF EXISTS public.cadastro_liberado;
-- DROP TABLE IF EXISTS public.convite_familia;
-- DROP FUNCTION IF EXISTS public.transacao_da_minha_familia(uuid);
-- DROP TABLE IF EXISTS public.administrador_plataforma;
-- DROP TABLE IF EXISTS public.familia_membro;
-- DROP TABLE IF EXISTS public.familia;
-- DROP FUNCTION IF EXISTS public.minha_familia();
-- DROP FUNCTION IF EXISTS public.sou_admin();
-- DROP FUNCTION IF EXISTS public.sou_admin_plataforma();
-- COMMIT;
