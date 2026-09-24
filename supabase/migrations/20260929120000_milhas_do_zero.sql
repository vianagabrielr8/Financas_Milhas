-- =====================================================================
-- Pacote 4 / Etapa 4.1: Milhas do zero (tabelas novas)
-- =====================================================================
-- O QUE FAZ: cria as tabelas novas do módulo Milhas, todas com
--   familia_id e as regras de família (a família vê, só o admin grava):
--     milhas_programa          programas (LATAM, Smiles, Livelo...) e regra de limite de CPF
--     milhas_contato           clientes e fornecedores
--     milhas_conta             conta = titular (CPF) num programa
--     milhas_venda             vendas de milhas / passagens
--     milhas_movimento         tudo que mexe no saldo (compra, bônus, transferência, venda, uso...)
--     milhas_venda_passageiro  passageiros de cada emissão (controle de limite de CPF)
--     milhas_parcela           contas a pagar e a receber
--     view milhas_saldo        saldo, custo investido e custo médio por conta
--   e já cadastra os programas mais comuns na sua família (dá para editar/apagar).
--
-- O QUE NÃO FAZ: não mexe em Finanças, não traz dado antigo e não mexe
--   nas tabelas antigas (programas_fidelidade, contas_titulares,
--   movimentacao_milhas).
--
-- COMO RODAR: Supabase -> SQL Editor. PASSO 0, depois PASSO 2 (bloco inteiro).
-- =====================================================================


-- PASSO 0 (conferência). Esperado: tabelas_milhas_ja_existem = 0,
-- funcoes_de_familia = 2, minha_familia = 1.
SELECT
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace
     AND relname LIKE 'milhas\_%') AS tabelas_milhas_ja_existem,
  (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
     AND proname IN ('minha_familia', 'sou_admin')) AS funcoes_de_familia,
  (SELECT count(*) FROM public.familia_membro
    WHERE user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2') AS minha_familia;


-- PASSO 1: nada a conferir (só cria coisas novas e vazias).


-- PASSO 2: aplica. Rode o bloco inteiro.
BEGIN;

-- 1. Programas
CREATE TABLE public.milhas_programa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id    uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  nome          text NOT NULL CHECK (length(btrim(nome)) > 0),
  tipo          text NOT NULL DEFAULT 'AEREA' CHECK (tipo IN ('AEREA', 'BANCO')),
  limite_cpf    int  CHECK (limite_cpf IS NULL OR limite_cpf > 0),         -- vazio = sem limite
  renovacao_cpf text CHECK (renovacao_cpf IN ('ANO_CIVIL', '12_MESES')),
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (familia_id, nome)
);

-- 2. Clientes e fornecedores
CREATE TABLE public.milhas_contato (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  nome       text NOT NULL CHECK (length(btrim(nome)) > 0),
  tipo       text NOT NULL DEFAULT 'CLIENTE' CHECK (tipo IN ('CLIENTE', 'FORNECEDOR', 'AMBOS')),
  telefone   text,
  documento  text,
  observacao text,
  ativo      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

-- 3. Contas (titular/CPF num programa)
CREATE TABLE public.milhas_conta (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id      uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  programa_id     uuid NOT NULL REFERENCES public.milhas_programa(id) ON DELETE RESTRICT,
  titular         text NOT NULL CHECK (length(btrim(titular)) > 0),
  cpf             text,
  numero_programa text,
  ativo           boolean NOT NULL DEFAULT true,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (familia_id, programa_id, titular)
);

-- 4. Vendas
CREATE TABLE public.milhas_venda (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id   uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  conta_id     uuid NOT NULL REFERENCES public.milhas_conta(id) ON DELETE RESTRICT,
  contato_id   uuid REFERENCES public.milhas_contato(id) ON DELETE SET NULL,  -- cliente
  data         date NOT NULL,
  milhas       bigint NOT NULL CHECK (milhas > 0),                  -- milhas da passagem/venda
  valor_total  numeric(12,2) NOT NULL CHECK (valor_total >= 0),     -- quanto o cliente paga
  taxa_dinheiro numeric(12,2) NOT NULL DEFAULT 0 CHECK (taxa_dinheiro >= 0), -- taxa paga por você em R$
  taxa_milhas  bigint NOT NULL DEFAULT 0 CHECK (taxa_milhas >= 0),  -- taxa paga em milhas
  custo_milhas numeric(12,2) NOT NULL DEFAULT 0,                    -- custo médio na hora da venda (fica guardado)
  localizador  text,
  observacao   text,
  criado_por   uuid DEFAULT auth.uid(),
  criado_em    timestamptz NOT NULL DEFAULT now()
);

-- 5. Movimentos (tudo que mexe no saldo). Quantidade sempre positiva;
--    o tipo diz se entra ou sai. "custo" = R$ que entrou no estoque
--    (entradas) ou que saiu pelo custo médio (saídas).
CREATE TABLE public.milhas_movimento (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id       uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  conta_id         uuid NOT NULL REFERENCES public.milhas_conta(id) ON DELETE RESTRICT,
  tipo             text NOT NULL CHECK (tipo IN ('COMPRA', 'BONUS', 'TRANSF_ENTRADA', 'AJUSTE_MAIS',
                                                 'TRANSF_SAIDA', 'VENDA', 'USO', 'EXPIROU', 'AJUSTE_MENOS')),
  quantidade       bigint NOT NULL CHECK (quantidade > 0),
  custo            numeric(12,2) NOT NULL DEFAULT 0 CHECK (custo >= 0),
  data             date NOT NULL,
  validade         date,
  forma_pagamento  text CHECK (forma_pagamento IN ('CARTAO', 'A_VISTA', 'PARCELADO')), -- só em COMPRA
  transferencia_id uuid,        -- liga a saída e a entrada da mesma transferência
  venda_id         uuid REFERENCES public.milhas_venda(id) ON DELETE CASCADE,
  contato_id       uuid REFERENCES public.milhas_contato(id) ON DELETE SET NULL, -- fornecedor
  observacao       text,
  criado_por       uuid DEFAULT auth.uid(),
  criado_em        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX milhas_movimento_conta_idx ON public.milhas_movimento (familia_id, conta_id, data);
CREATE INDEX milhas_movimento_transf_idx ON public.milhas_movimento (transferencia_id) WHERE transferencia_id IS NOT NULL;

-- 6. Passageiros de cada emissão (venda ou uso)
CREATE TABLE public.milhas_venda_passageiro (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id   uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  movimento_id uuid NOT NULL REFERENCES public.milhas_movimento(id) ON DELETE CASCADE,
  nome         text NOT NULL CHECK (length(btrim(nome)) > 0),
  cpf          text NOT NULL CHECK (length(btrim(cpf)) > 0),
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX milhas_venda_passageiro_mov_idx ON public.milhas_venda_passageiro (movimento_id);

-- 7. Contas a pagar e a receber
CREATE TABLE public.milhas_parcela (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id   uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('PAGAR', 'RECEBER')),
  venda_id     uuid REFERENCES public.milhas_venda(id) ON DELETE CASCADE,
  movimento_id uuid REFERENCES public.milhas_movimento(id) ON DELETE CASCADE,
  contato_id   uuid REFERENCES public.milhas_contato(id) ON DELETE SET NULL,
  descricao    text NOT NULL,
  numero       int NOT NULL DEFAULT 1 CHECK (numero >= 1),
  total        int NOT NULL DEFAULT 1 CHECK (total >= numero),
  valor        numeric(12,2) NOT NULL CHECK (valor >= 0),
  vencimento   date NOT NULL,
  situacao     text NOT NULL DEFAULT 'ABERTA' CHECK (situacao IN ('ABERTA', 'PAGA')),
  pago_em      date,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX milhas_parcela_venc_idx ON public.milhas_parcela (familia_id, situacao, vencimento);

-- 8. Saldo por conta (respeita as regras de família de quem consulta)
CREATE VIEW public.milhas_saldo WITH (security_invoker = true) AS
SELECT
  c.id AS conta_id, c.familia_id, c.programa_id, c.titular, c.ativo,
  COALESCE(sum(CASE WHEN m.tipo IN ('COMPRA','BONUS','TRANSF_ENTRADA','AJUSTE_MAIS') THEN m.quantidade ELSE -m.quantidade END), 0)::bigint AS saldo,
  COALESCE(sum(CASE WHEN m.tipo IN ('COMPRA','BONUS','TRANSF_ENTRADA','AJUSTE_MAIS') THEN m.custo ELSE -m.custo END), 0)::numeric(12,2) AS custo_estoque
FROM public.milhas_conta c
LEFT JOIN public.milhas_movimento m ON m.conta_id = c.id
GROUP BY c.id;

-- 9. Regras de acesso: a família vê; só o admin cria, edita e apaga.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['milhas_programa', 'milhas_contato', 'milhas_conta', 'milhas_venda',
                           'milhas_movimento', 'milhas_venda_passageiro', 'milhas_parcela'] LOOP
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

-- 10. Programas mais comuns já cadastrados na sua família (dá para editar/apagar na tela).
INSERT INTO public.milhas_programa (familia_id, nome, tipo, limite_cpf, renovacao_cpf)
SELECT fm.familia_id, v.nome, v.tipo, v.limite, v.renovacao
FROM (VALUES
  ('LATAM Pass',    'AEREA', 25,   '12_MESES'),
  ('Smiles',        'AEREA', 25,   'ANO_CIVIL'),
  ('TudoAzul',      'AEREA', 5,    'ANO_CIVIL'),
  ('TAP Miles&Go',  'AEREA', 10,   'ANO_CIVIL'),
  ('Iberia Plus',   'AEREA', 10,   '12_MESES'),
  ('Livelo',        'BANCO', NULL, NULL),
  ('Esfera',        'BANCO', NULL, NULL)
) AS v(nome, tipo, limite, renovacao)
JOIN public.familia_membro fm ON fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2';

COMMIT;

-- Conferência (esperado: tabelas = 7, programas = 7, rls_ligado = 7).
SELECT
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname LIKE 'milhas\_%') AS tabelas,
  (SELECT count(*) FROM public.milhas_programa) AS programas,
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname LIKE 'milhas\_%' AND relrowsecurity) AS rls_ligado;


-- COMO DESFAZER (apaga só o que este arquivo criou, inclusive o que foi lançado nelas):
-- BEGIN;
-- DROP VIEW  IF EXISTS public.milhas_saldo;
-- DROP TABLE IF EXISTS public.milhas_parcela, public.milhas_venda_passageiro, public.milhas_movimento,
--                      public.milhas_venda, public.milhas_conta, public.milhas_contato, public.milhas_programa;
-- COMMIT;
