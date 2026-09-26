-- =====================================================================
-- Link compartilhável: "quanto você me deve" para terceiros
-- =====================================================================
-- O QUE FAZ:
--   1. Tabela link_compartilhado: cada link tem um código secreto (64
--      letras/números, impossível de adivinhar) e aponta para UMA categoria
--      (ex.: "Lucas Irmão", dentro do centro Terceiros). Só o admin da
--      família cria, vê, desliga ou apaga os links.
--   2. Função extrato_compartilhado(código, de, até): é a ÚNICA porta que
--      quem não tem login consegue usar. Com o código certo e o link ligado,
--      devolve só os lançamentos daquela categoria (data, descrição, valor,
--      cartão com vencimento da fatura ou conta) e os totais: lançado,
--      já pago (RECEITAS na categoria) e quanto falta. Nada além disso.
--      O período (de/até, por mês) é o único filtro que a pessoa escolhe.
-- NÃO MEXE em nenhum dado existente.
-- COMO RODAR: SQL Editor. PASSO 0 e depois PASSO 2 (bloco inteiro).
-- Pode rodar o PASSO 2 de novo sem problema: ele pula o que já existe.
-- =====================================================================

-- PASSO 0 (conferência). Esperado: tabela_ja_existe = false, categorias_terceiros = 3 (ou mais)
SELECT
  to_regclass('public.link_compartilhado') IS NOT NULL AS tabela_ja_existe,
  (SELECT count(*) FROM public.categoria_pessoal c JOIN public.centro_custo_projeto cc ON cc.id = c.centro_custo_id
    WHERE lower(cc.nome) LIKE '%terceiro%') AS categorias_terceiros;

-- PASSO 1: nada a mostrar (tabela nova, nenhum dado muda).

-- PASSO 2: aplica (rode o bloco inteiro).
BEGIN;

CREATE TABLE IF NOT EXISTS public.link_compartilhado (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id    uuid NOT NULL DEFAULT public.minha_familia() REFERENCES public.familia(id) ON DELETE CASCADE,
  codigo        text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  titulo        text NOT NULL CHECK (length(btrim(titulo)) > 0),
  categoria_id  uuid NOT NULL REFERENCES public.categoria_pessoal(id) ON DELETE CASCADE,
  ativo         boolean NOT NULL DEFAULT true,
  ultimo_acesso timestamptz,
  criado_por    uuid DEFAULT auth.uid(),
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS link_compartilhado_familia_idx ON public.link_compartilhado (familia_id);

ALTER TABLE public.link_compartilhado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_ver ON public.link_compartilhado;
CREATE POLICY admin_ver ON public.link_compartilhado FOR SELECT TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()));
DROP POLICY IF EXISTS admin_criar ON public.link_compartilhado;
CREATE POLICY admin_criar ON public.link_compartilhado FOR INSERT TO authenticated
  WITH CHECK (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()));
DROP POLICY IF EXISTS admin_editar ON public.link_compartilhado;
CREATE POLICY admin_editar ON public.link_compartilhado FOR UPDATE TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()))
  WITH CHECK (familia_id = (SELECT public.minha_familia()));
DROP POLICY IF EXISTS admin_apagar ON public.link_compartilhado;
CREATE POLICY admin_apagar ON public.link_compartilhado FOR DELETE TO authenticated
  USING (familia_id = (SELECT public.minha_familia()) AND (SELECT public.sou_admin()));

-- A categoria do link tem que ser da mesma família
CREATE OR REPLACE FUNCTION public.link_compartilhado_confere() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.categoria_pessoal WHERE id = NEW.categoria_id AND familia_id = NEW.familia_id) THEN
    RAISE EXCEPTION 'Categoria de outra família.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS link_compartilhado_confere ON public.link_compartilhado;
CREATE TRIGGER link_compartilhado_confere BEFORE INSERT OR UPDATE OF categoria_id, familia_id ON public.link_compartilhado
  FOR EACH ROW EXECUTE FUNCTION public.link_compartilhado_confere();

-- Porta de leitura para quem abre o link (sem login).
-- p_de / p_ate: 'AAAA-MM' (vazio = sem limite). Cartão conta no mês da
-- fatura (quando se paga); conta bancária, no mês da data.
CREATE OR REPLACE FUNCTION public.extrato_compartilhado(p_codigo text, p_de text DEFAULT NULL, p_ate text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l public.link_compartilhado;
  meses text[] := ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  resultado jsonb;
BEGIN
  IF p_codigo IS NULL OR length(p_codigo) < 32 THEN RETURN NULL; END IF;
  SELECT * INTO l FROM public.link_compartilhado WHERE codigo = p_codigo AND ativo;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE public.link_compartilhado SET ultimo_acesso = now() WHERE id = l.id;

  WITH base AS (
    SELECT t.data, t.descricao, t.valor, t.tipo, t.mes_fatura, t.situacao,
           c.nome AS cartao, cf.nome AS conta,
           CASE WHEN t.cartao_id IS NOT NULL AND t.mes_fatura IS NOT NULL
                THEN make_date(split_part(t.mes_fatura, '/', 2)::int, array_position(meses, split_part(t.mes_fatura, '/', 1)), 1)
                ELSE date_trunc('month', t.data)::date END AS mes_ref,
           c.dia_vencimento
      FROM public.transacao_pessoal t
      LEFT JOIN public.cartao_pessoal c ON c.id = t.cartao_id
      LEFT JOIN public.conta_financeira_pessoal cf ON cf.id = t.conta_id
     WHERE t.familia_id = l.familia_id AND t.categoria_id = l.categoria_id
       AND t.tipo IN ('DESPESA', 'ESTORNO', 'RECEITA')
  ), com_venc AS (
    SELECT b.*,
           CASE WHEN b.cartao IS NOT NULL AND b.dia_vencimento IS NOT NULL
                THEN b.mes_ref + (LEAST(b.dia_vencimento, EXTRACT(day FROM (b.mes_ref + interval '1 month - 1 day'))::int) - 1)
                ELSE b.data END AS vencimento
      FROM base b
  ), periodo AS (
    SELECT * FROM com_venc
     WHERE (p_de IS NULL OR p_de = '' OR mes_ref >= to_date(p_de || '-01', 'YYYY-MM-DD'))
       AND (p_ate IS NULL OR p_ate = '' OR mes_ref <= to_date(p_ate || '-01', 'YYYY-MM-DD'))
  )
  SELECT jsonb_build_object(
    'titulo', l.titulo,
    -- totais de tudo (qualquer período): é o que a pessoa deve hoje
    'total_lancado', COALESCE((SELECT sum(CASE tipo WHEN 'DESPESA' THEN valor WHEN 'ESTORNO' THEN -valor ELSE 0 END) FROM com_venc), 0),
    'total_pago',    COALESCE((SELECT sum(valor) FILTER (WHERE tipo = 'RECEITA') FROM com_venc), 0),
    -- totais só do período escolhido
    'periodo_lancado', COALESCE((SELECT sum(CASE tipo WHEN 'DESPESA' THEN valor WHEN 'ESTORNO' THEN -valor ELSE 0 END) FROM periodo), 0),
    'periodo_pago',    COALESCE((SELECT sum(valor) FILTER (WHERE tipo = 'RECEITA') FROM periodo), 0),
    'primeiro_mes', (SELECT to_char(min(mes_ref), 'YYYY-MM') FROM com_venc),
    'ultimo_mes',   (SELECT to_char(max(mes_ref), 'YYYY-MM') FROM com_venc),
    'lancamentos', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'data', data, 'descricao', descricao, 'valor', valor, 'tipo', tipo, 'situacao', situacao,
        'cartao', cartao, 'conta', conta, 'mes_fatura', mes_fatura, 'vencimento', vencimento
      ) ORDER BY vencimento DESC, data DESC) FROM periodo), '[]'::jsonb)
  ) INTO resultado;
  RETURN resultado;
END $$;

REVOKE EXECUTE ON FUNCTION public.extrato_compartilhado(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extrato_compartilhado(text, text, text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_compartilhado_confere() FROM PUBLIC, anon;

COMMIT;

-- Conferência. Esperado: tabela = true, funcao = true
SELECT to_regclass('public.link_compartilhado') IS NOT NULL AS tabela,
       to_regprocedure('public.extrato_compartilhado(text, text, text)') IS NOT NULL AS funcao;

-- COMO DESFAZER (os links deixam de funcionar; nenhum lançamento muda):
-- DROP FUNCTION IF EXISTS public.extrato_compartilhado(text, text, text);
-- DROP TABLE IF EXISTS public.link_compartilhado;
-- DROP FUNCTION IF EXISTS public.link_compartilhado_confere();
