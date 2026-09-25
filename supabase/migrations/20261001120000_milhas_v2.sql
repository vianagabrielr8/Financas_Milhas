-- =====================================================================
-- Pacote 5 / Etapa 5.1: Milhas v2 (titulares, passageiros, clubes,
-- regras de limite por programa, parcelas no cartão)
-- =====================================================================
-- O QUE FAZ:
--   1. milhas_titular: a PESSOA (nome, CPF), cadastrada uma vez.
--      milhas_conta vira a "carteira" titular x programa (ganha titular_id).
--      As contas que já existem são ligadas a titulares criados a partir
--      delas (mesmo nome = mesma pessoa).
--   2. milhas_passageiro: passageiros com CPF OU passaporte.
--      Os passageiros já lançados em vendas/usos viram cadastro.
--   3. milhas_clube: clubes de assinatura (Clube Smiles, Clube Livelo...),
--      com data de início, dia do crédito, pontos do plano e bônus.
--      Movimentos ganham os tipos CLUBE (pontos do plano) e CLUBE_BONUS.
--   4. Programas ganham "modo de contagem" do limite de CPF
--      (PASSAGENS_12M, PESSOAS_ANO, LISTA_FIXA, SEM_LIMITE), espera para
--      trocar a lista e nível. Já vêm ajustados conforme a pesquisa
--      de 25/09/2026 (LATAM conta passagens; Azul é lista fixa...).
--      milhas_beneficiario: lista fixa de beneficiários (Azul, Iberia...).
--   5. Parcelas (a pagar) ganham o cartão de FINANÇAS usado (só para
--      Milhas mostrar quanto cai em cada cartão; nada é gravado em Finanças).
--   6. A visão de saldo passa a ignorar créditos com data futura (clube).
--
-- COMPATIBILIDADE: as telas atuais continuam funcionando até a etapa 5.2
--   (o nome do titular continua copiado na conta, automaticamente).
-- NÃO MEXE em Finanças nem apaga dados.
--
-- COMO RODAR: Supabase -> SQL Editor. PASSO 0, depois PASSO 2 (bloco inteiro).
-- =====================================================================


-- PASSO 0 (conferência). Esperado:
--   ja_existem = 0, tabelas_milhas = 7, id_do_cartao = uuid
SELECT
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
     AND relname IN ('milhas_titular', 'milhas_passageiro', 'milhas_clube', 'milhas_beneficiario')) AS ja_existem,
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
     AND relname IN ('milhas_programa', 'milhas_contato', 'milhas_conta', 'milhas_venda',
                     'milhas_movimento', 'milhas_venda_passageiro', 'milhas_parcela')) AS tabelas_milhas,
  (SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cartao_pessoal' AND column_name = 'id') AS id_do_cartao;


-- PASSO 1 (só leitura): o que vai ser convertido.
SELECT
  (SELECT count(*) FROM public.milhas_conta) AS contas_hoje,
  (SELECT count(DISTINCT (familia_id, btrim(titular))) FROM public.milhas_conta) AS titulares_que_serao_criados,
  (SELECT count(DISTINCT (familia_id, regexp_replace(cpf, '\D', '', 'g'))) FROM public.milhas_venda_passageiro) AS passageiros_que_serao_criados,
  (SELECT string_agg(nome, ', ' ORDER BY nome) FROM public.milhas_programa) AS programas;


-- PASSO 2: aplica. Rode o bloco inteiro.
BEGIN;

-- ---------------------------------------------------------------- 1. Titulares
CREATE TABLE public.milhas_titular (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  nome       text NOT NULL CHECK (length(btrim(nome)) > 0),
  cpf        text,
  observacao text,
  ativo      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (familia_id, nome)
);

INSERT INTO public.milhas_titular (familia_id, nome, cpf)
SELECT familia_id, btrim(titular), max(NULLIF(btrim(cpf), ''))
FROM public.milhas_conta GROUP BY familia_id, btrim(titular);

ALTER TABLE public.milhas_conta ADD COLUMN titular_id uuid REFERENCES public.milhas_titular(id) ON DELETE RESTRICT;
UPDATE public.milhas_conta c SET titular_id = t.id
FROM public.milhas_titular t WHERE t.familia_id = c.familia_id AND t.nome = btrim(c.titular);
ALTER TABLE public.milhas_conta ALTER COLUMN titular_id SET NOT NULL;
ALTER TABLE public.milhas_conta ADD CONSTRAINT milhas_conta_titular_programa_uk UNIQUE (familia_id, titular_id, programa_id);

-- Mantém nome/CPF copiados na conta (as telas antigas usam) e, se uma tela
-- antiga criar conta só com o nome, acha ou cria o titular.
CREATE FUNCTION public.milhas_conta_sincroniza() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.titular_id IS NULL THEN
    SELECT id INTO NEW.titular_id FROM public.milhas_titular
     WHERE familia_id = NEW.familia_id AND nome = btrim(NEW.titular);
    IF NEW.titular_id IS NULL THEN
      INSERT INTO public.milhas_titular (familia_id, nome, cpf)
      VALUES (NEW.familia_id, btrim(NEW.titular), NULLIF(btrim(NEW.cpf), ''))
      RETURNING id INTO NEW.titular_id;
    END IF;
  END IF;
  SELECT nome, cpf INTO NEW.titular, NEW.cpf FROM public.milhas_titular WHERE id = NEW.titular_id;
  RETURN NEW;
END $$;
CREATE TRIGGER milhas_conta_sincroniza BEFORE INSERT OR UPDATE ON public.milhas_conta
  FOR EACH ROW EXECUTE FUNCTION public.milhas_conta_sincroniza();

CREATE FUNCTION public.milhas_titular_propaga() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.milhas_conta SET titular = NEW.nome, cpf = NEW.cpf WHERE titular_id = NEW.id;
  RETURN NEW;
END $$;
CREATE TRIGGER milhas_titular_propaga AFTER UPDATE OF nome, cpf ON public.milhas_titular
  FOR EACH ROW EXECUTE FUNCTION public.milhas_titular_propaga();

-- ---------------------------------------------------------------- 2. Passageiros
CREATE TABLE public.milhas_passageiro (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id     uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  nome           text NOT NULL CHECK (length(btrim(nome)) > 0),
  documento_tipo text NOT NULL DEFAULT 'CPF' CHECK (documento_tipo IN ('CPF', 'PASSAPORTE')),
  documento      text NOT NULL CHECK (length(btrim(documento)) > 0),
  nascimento     date,
  telefone       text,
  email          text,
  observacao     text,
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (familia_id, documento_tipo, documento)
);

INSERT INTO public.milhas_passageiro (familia_id, nome, documento_tipo, documento)
SELECT DISTINCT ON (familia_id, regexp_replace(cpf, '\D', '', 'g'))
       familia_id, btrim(nome), 'CPF', regexp_replace(cpf, '\D', '', 'g')
FROM public.milhas_venda_passageiro
WHERE regexp_replace(cpf, '\D', '', 'g') <> ''
ORDER BY familia_id, regexp_replace(cpf, '\D', '', 'g'), criado_em DESC;

ALTER TABLE public.milhas_venda_passageiro
  ADD COLUMN passageiro_id  uuid REFERENCES public.milhas_passageiro(id) ON DELETE SET NULL,
  ADD COLUMN documento_tipo text NOT NULL DEFAULT 'CPF' CHECK (documento_tipo IN ('CPF', 'PASSAPORTE'));
UPDATE public.milhas_venda_passageiro vp SET passageiro_id = p.id
FROM public.milhas_passageiro p
WHERE p.familia_id = vp.familia_id AND p.documento_tipo = 'CPF' AND p.documento = regexp_replace(vp.cpf, '\D', '', 'g');

-- Cada emissão guarda o passageiro do cadastro (e cria o cadastro se a tela
-- antiga mandar só nome + CPF). A coluna "cpf" guarda o documento (CPF ou passaporte).
CREATE FUNCTION public.milhas_venda_passageiro_liga() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc text;
BEGIN
  IF NEW.passageiro_id IS NULL THEN
    doc := CASE WHEN NEW.documento_tipo = 'CPF' THEN regexp_replace(NEW.cpf, '\D', '', 'g') ELSE upper(btrim(NEW.cpf)) END;
    SELECT id INTO NEW.passageiro_id FROM public.milhas_passageiro
     WHERE familia_id = NEW.familia_id AND documento_tipo = NEW.documento_tipo AND documento = doc;
    IF NEW.passageiro_id IS NULL THEN
      INSERT INTO public.milhas_passageiro (familia_id, nome, documento_tipo, documento)
      VALUES (NEW.familia_id, btrim(NEW.nome), NEW.documento_tipo, doc) RETURNING id INTO NEW.passageiro_id;
    END IF;
  END IF;
  SELECT nome, documento_tipo, documento INTO NEW.nome, NEW.documento_tipo, NEW.cpf
    FROM public.milhas_passageiro WHERE id = NEW.passageiro_id;
  RETURN NEW;
END $$;
CREATE TRIGGER milhas_venda_passageiro_liga BEFORE INSERT ON public.milhas_venda_passageiro
  FOR EACH ROW EXECUTE FUNCTION public.milhas_venda_passageiro_liga();

-- ---------------------------------------------------------------- 3. Clubes
CREATE TABLE public.milhas_clube (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id      uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  conta_id        uuid NOT NULL REFERENCES public.milhas_conta(id) ON DELETE RESTRICT,  -- titular x programa
  nome_plano      text NOT NULL CHECK (length(btrim(nome_plano)) > 0),                  -- ex.: "Clube Smiles 2.000"
  valor           numeric(12,2) NOT NULL CHECK (valor >= 0),                             -- valor de cada cobrança
  periodicidade   text NOT NULL DEFAULT 'MENSAL' CHECK (periodicidade IN ('MENSAL', 'ANUAL')),
  parcelas        int NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 24),              -- anual parcelado
  forma_pagamento text NOT NULL DEFAULT 'CARTAO' CHECK (forma_pagamento IN ('CARTAO', 'PIX', 'BOLETO')),
  cartao_id       uuid,                                                                  -- cartão de FINANÇAS (só leitura)
  data_inicio     date NOT NULL,
  dia_credito     int  NOT NULL CHECK (dia_credito BETWEEN 1 AND 31),
  pontos_mes      bigint NOT NULL CHECK (pontos_mes >= 0),                               -- pontos do plano
  bonus_mes       bigint NOT NULL DEFAULT 0 CHECK (bonus_mes >= 0),                      -- bônus do clube
  meses           int CHECK (meses IS NULL OR meses > 0),                                -- vazio = sem prazo
  ativo           boolean NOT NULL DEFAULT true,
  cancelado_em    date,
  observacao      text,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.milhas_movimento DROP CONSTRAINT milhas_movimento_tipo_check;
ALTER TABLE public.milhas_movimento ADD CONSTRAINT milhas_movimento_tipo_check CHECK (tipo IN (
  'COMPRA', 'BONUS', 'TRANSF_ENTRADA', 'AJUSTE_MAIS', 'CLUBE', 'CLUBE_BONUS',
  'TRANSF_SAIDA', 'VENDA', 'USO', 'EXPIROU', 'AJUSTE_MENOS'));
ALTER TABLE public.milhas_movimento ADD COLUMN clube_id uuid REFERENCES public.milhas_clube(id) ON DELETE SET NULL;
CREATE INDEX milhas_movimento_clube_idx ON public.milhas_movimento (clube_id) WHERE clube_id IS NOT NULL;

ALTER TABLE public.milhas_staging DROP CONSTRAINT milhas_staging_tipo_check;
ALTER TABLE public.milhas_staging ADD CONSTRAINT milhas_staging_tipo_check CHECK (tipo IN (
  'COMPRA', 'BONUS', 'TRANSF_ENTRADA', 'AJUSTE_MAIS', 'CLUBE', 'CLUBE_BONUS',
  'TRANSF_SAIDA', 'USO', 'EXPIROU', 'AJUSTE_MENOS'));

-- ---------------------------------------------------------------- 4. Regras de limite
ALTER TABLE public.milhas_programa
  ADD COLUMN modo_limite text NOT NULL DEFAULT 'SEM_LIMITE'
    CHECK (modo_limite IN ('PASSAGENS_12M', 'PESSOAS_ANO', 'LISTA_FIXA', 'SEM_LIMITE')),
  ADD COLUMN espera_troca_dias int CHECK (espera_troca_dias IS NULL OR espera_troca_dias >= 0),
  ADD COLUMN nivel text;

-- Ajuste inicial (pesquisa de 25/09/2026). O nome é comparado sem acento/maiúscula.
UPDATE public.milhas_programa SET modo_limite = CASE
    WHEN tipo = 'BANCO' THEN 'SEM_LIMITE'
    WHEN lower(nome) LIKE '%latam%' THEN 'PASSAGENS_12M'
    WHEN lower(nome) LIKE '%smiles%' OR lower(nome) LIKE '%tap%' THEN 'PESSOAS_ANO'
    WHEN lower(nome) LIKE '%azul%' OR lower(nome) LIKE '%iberia%' THEN 'LISTA_FIXA'
    WHEN renovacao_cpf = 'ANO_CIVIL' THEN 'PESSOAS_ANO'
    WHEN renovacao_cpf = '12_MESES' THEN 'PASSAGENS_12M'
    ELSE 'SEM_LIMITE' END;
UPDATE public.milhas_programa SET espera_troca_dias = 30, nivel = COALESCE(nivel, 'Básico')
 WHERE lower(nome) LIKE '%azul%';

CREATE TABLE public.milhas_beneficiario (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id    uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  conta_id      uuid NOT NULL REFERENCES public.milhas_conta(id) ON DELETE CASCADE,
  passageiro_id uuid NOT NULL REFERENCES public.milhas_passageiro(id) ON DELETE RESTRICT,
  incluido_em   date NOT NULL DEFAULT current_date,
  removido_em   date,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- 5. Parcelas no cartão
ALTER TABLE public.milhas_parcela
  ADD COLUMN cartao_id uuid,
  ADD COLUMN clube_id  uuid REFERENCES public.milhas_clube(id) ON DELETE CASCADE;

-- Liga ao cartão de Finanças só se o tipo do id for o mesmo (conferido no PASSO 0).
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'cartao_pessoal' AND column_name = 'id') = 'uuid' THEN
    ALTER TABLE public.milhas_parcela ADD CONSTRAINT milhas_parcela_cartao_fk
      FOREIGN KEY (cartao_id) REFERENCES public.cartao_pessoal(id) ON DELETE SET NULL;
    ALTER TABLE public.milhas_clube ADD CONSTRAINT milhas_clube_cartao_fk
      FOREIGN KEY (cartao_id) REFERENCES public.cartao_pessoal(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------- 6. Saldo (ignora créditos futuros)
CREATE OR REPLACE VIEW public.milhas_saldo WITH (security_invoker = true) AS
SELECT
  c.id AS conta_id, c.familia_id, c.programa_id, c.titular, c.ativo,
  COALESCE(sum(CASE WHEN m.tipo IN ('COMPRA','BONUS','TRANSF_ENTRADA','AJUSTE_MAIS','CLUBE','CLUBE_BONUS') THEN m.quantidade ELSE -m.quantidade END)
           FILTER (WHERE m.data <= current_date), 0)::bigint AS saldo,
  COALESCE(sum(CASE WHEN m.tipo IN ('COMPRA','BONUS','TRANSF_ENTRADA','AJUSTE_MAIS','CLUBE','CLUBE_BONUS') THEN m.custo ELSE -m.custo END)
           FILTER (WHERE m.data <= current_date), 0)::numeric(12,2) AS custo_estoque
FROM public.milhas_conta c
LEFT JOIN public.milhas_movimento m ON m.conta_id = c.id
GROUP BY c.id;

-- ---------------------------------------------------------------- Regras de acesso (família vê, admin grava)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['milhas_titular', 'milhas_passageiro', 'milhas_clube', 'milhas_beneficiario'] LOOP
    EXECUTE format('CREATE INDEX %I ON public.%I (familia_id)', t || '_familia_idx', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY familia_ver ON public.%I FOR SELECT TO authenticated
                      USING (familia_id = (SELECT public.minha_familia()))', t);
    EXECUTE format('CREATE POLICY familia_criar ON public.%I FOR INSERT TO authenticated
                      WITH CHECK (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))', t);
    EXECUTE format('CREATE POLICY familia_editar ON public.%I FOR UPDATE TO authenticated
                      USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))
                      WITH CHECK (familia_id = (SELECT public.minha_familia()))', t);
    EXECUTE format('CREATE POLICY familia_apagar ON public.%I FOR DELETE TO authenticated
                      USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))', t);
  END LOOP;
END $$;

-- Trava: toda conta ficou ligada a um titular.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.milhas_conta WHERE titular_id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION '% conta(s) sem titular. Nada foi gravado.', n; END IF;
END $$;

COMMIT;

-- Conferência: titulares, passageiros e regras dos programas.
SELECT
  (SELECT count(*) FROM public.milhas_titular) AS titulares,
  (SELECT count(*) FROM public.milhas_conta WHERE titular_id IS NOT NULL) AS contas_ligadas,
  (SELECT count(*) FROM public.milhas_passageiro) AS passageiros,
  (SELECT count(*) FROM pg_constraint WHERE conname = 'milhas_parcela_cartao_fk') AS ligado_aos_cartoes;
SELECT nome, tipo, modo_limite, limite_cpf, espera_troca_dias, nivel FROM public.milhas_programa ORDER BY nome;


-- COMO DESFAZER (volta à estrutura da etapa 4; clubes, passageiros e
-- titulares cadastrados depois disso são apagados):
-- BEGIN;
-- DROP TRIGGER IF EXISTS milhas_venda_passageiro_liga ON public.milhas_venda_passageiro;
-- DROP TRIGGER IF EXISTS milhas_conta_sincroniza ON public.milhas_conta;
-- DROP TRIGGER IF EXISTS milhas_titular_propaga ON public.milhas_titular;
-- DROP FUNCTION IF EXISTS public.milhas_venda_passageiro_liga(), public.milhas_conta_sincroniza(), public.milhas_titular_propaga();
-- DELETE FROM public.milhas_movimento WHERE tipo IN ('CLUBE', 'CLUBE_BONUS');
-- DELETE FROM public.milhas_staging WHERE tipo IN ('CLUBE', 'CLUBE_BONUS');
-- ALTER TABLE public.milhas_parcela DROP COLUMN IF EXISTS cartao_id, DROP COLUMN IF EXISTS clube_id;
-- ALTER TABLE public.milhas_movimento DROP COLUMN IF EXISTS clube_id;
-- ALTER TABLE public.milhas_movimento DROP CONSTRAINT milhas_movimento_tipo_check;
-- ALTER TABLE public.milhas_movimento ADD CONSTRAINT milhas_movimento_tipo_check CHECK (tipo IN ('COMPRA','BONUS','TRANSF_ENTRADA','AJUSTE_MAIS','TRANSF_SAIDA','VENDA','USO','EXPIROU','AJUSTE_MENOS'));
-- ALTER TABLE public.milhas_staging DROP CONSTRAINT milhas_staging_tipo_check;
-- ALTER TABLE public.milhas_staging ADD CONSTRAINT milhas_staging_tipo_check CHECK (tipo IN ('COMPRA','BONUS','TRANSF_ENTRADA','AJUSTE_MAIS','TRANSF_SAIDA','USO','EXPIROU','AJUSTE_MENOS'));
-- DROP TABLE IF EXISTS public.milhas_beneficiario, public.milhas_clube;
-- ALTER TABLE public.milhas_venda_passageiro DROP COLUMN IF EXISTS passageiro_id, DROP COLUMN IF EXISTS documento_tipo;
-- DROP TABLE IF EXISTS public.milhas_passageiro;
-- ALTER TABLE public.milhas_conta DROP CONSTRAINT IF EXISTS milhas_conta_titular_programa_uk;
-- ALTER TABLE public.milhas_conta DROP COLUMN IF EXISTS titular_id;
-- DROP TABLE IF EXISTS public.milhas_titular;
-- ALTER TABLE public.milhas_programa DROP COLUMN IF EXISTS modo_limite, DROP COLUMN IF EXISTS espera_troca_dias, DROP COLUMN IF EXISTS nivel;
-- CREATE OR REPLACE VIEW public.milhas_saldo WITH (security_invoker = true) AS
--   SELECT c.id AS conta_id, c.familia_id, c.programa_id, c.titular, c.ativo,
--     COALESCE(sum(CASE WHEN m.tipo IN ('COMPRA','BONUS','TRANSF_ENTRADA','AJUSTE_MAIS') THEN m.quantidade ELSE -m.quantidade END), 0)::bigint AS saldo,
--     COALESCE(sum(CASE WHEN m.tipo IN ('COMPRA','BONUS','TRANSF_ENTRADA','AJUSTE_MAIS') THEN m.custo ELSE -m.custo END), 0)::numeric(12,2) AS custo_estoque
--   FROM public.milhas_conta c LEFT JOIN public.milhas_movimento m ON m.conta_id = c.id GROUP BY c.id;
-- COMMIT;
