-- =====================================================================
-- Apagar todos os lançamentos ANTES de setembro/2026
-- =====================================================================
-- O QUE FAZ: apaga de transacao_pessoal tudo que é de antes de set/2026:
--   - compra no cartão: pelo MÊS DA FATURA (Ago/2026 ou antes sai;
--     Set/2026 em diante fica). Assim parcelas futuras de compras antigas
--     (ex.: Amazon de fevereiro com parcela em outubro) CONTINUAM;
--   - conta bancária: pela DATA (antes de 01/09/2026 sai).
--   As contestações desses lançamentos saem junto (o banco apaga sozinho).
--   Antes de apagar, guarda cópia COMPLETA das linhas na área "backup"
--   (fechada para o site). Também move para lá os backups antigos.
-- ATENÇÃO: some do Dashboard, das médias e das comparações tudo que é de
--   antes de setembro. Voltar versão no GitHub NÃO traz dados de volta: só
--   o bloco COMO DESFAZER (usando o backup) traz.
-- COMO RODAR: SQL Editor. PASSO 0, PASSO 1 (confira os números), PASSO 2.
-- =====================================================================

-- PASSO 0 (conferência, só leitura).
-- Esperado: backup_ja_existe = false. "outras_tabelas_ligadas" lista quem
-- aponta para os lançamentos; se aparecer algo além de
-- contestacao_classificacao, me mande o print ANTES de seguir.
SELECT
  to_regclass('backup.transacao_antes_set2026') IS NOT NULL AS backup_ja_existe,
  (SELECT string_agg(conrelid::regclass::text || ' (' || CASE confdeltype WHEN 'c' THEN 'apaga junto' WHEN 'n' THEN 'fica sem ligação' ELSE 'TRAVA' END || ')', ', ')
     FROM pg_constraint WHERE confrelid = 'public.transacao_pessoal'::regclass AND contype = 'f') AS outras_tabelas_ligadas;

-- PASSO 1 (só leitura): o que vai ser apagado, por mês e tipo
WITH marcados AS (
  SELECT t.*,
    CASE WHEN t.cartao_id IS NOT NULL
      THEN make_date(split_part(t.mes_fatura, '/', 2)::int,
           array_position(ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'], split_part(t.mes_fatura, '/', 1)), 1)
      ELSE date_trunc('month', t.data)::date END AS mes_ref
  FROM public.transacao_pessoal t)
SELECT to_char(mes_ref, 'MM/YYYY') AS mes, tipo, count(*) AS linhas, sum(valor) AS valor
FROM marcados WHERE mes_ref < '2026-09-01'
GROUP BY mes_ref, tipo ORDER BY mes_ref, tipo;
-- Totais (confira antes do PASSO 2):
WITH marcados AS (
  SELECT t.id, CASE WHEN t.cartao_id IS NOT NULL
      THEN make_date(split_part(t.mes_fatura, '/', 2)::int,
           array_position(ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'], split_part(t.mes_fatura, '/', 1)), 1)
      ELSE date_trunc('month', t.data)::date END AS mes_ref
  FROM public.transacao_pessoal t)
SELECT count(*) FILTER (WHERE mes_ref < '2026-09-01') AS vao_ser_apagados,
       count(*) FILTER (WHERE mes_ref >= '2026-09-01') AS ficam,
       (SELECT count(*) FROM public.contestacao_classificacao c JOIN marcados m ON m.id = c.transacao_id WHERE m.mes_ref < '2026-09-01') AS contestacoes_que_saem
FROM marcados;

-- PASSO 2: aplica (rode o bloco inteiro).
BEGIN;
-- área de backup, fechada para o site (anon/authenticated não enxergam)
CREATE SCHEMA IF NOT EXISTS backup;
REVOKE ALL ON SCHEMA backup FROM PUBLIC, anon, authenticated;
-- backups antigos que estavam na área pública
DO $$
BEGIN
  IF to_regclass('public.backup_2026_09_parcelas_formato') IS NOT NULL THEN
    ALTER TABLE public.backup_2026_09_parcelas_formato SET SCHEMA backup; END IF;
  IF to_regclass('public.backup_2026_09_ajuste_juros') IS NOT NULL THEN
    ALTER TABLE public.backup_2026_09_ajuste_juros SET SCHEMA backup; END IF;
END $$;

CREATE TABLE backup.transacao_antes_set2026 AS
  SELECT t.* FROM public.transacao_pessoal t
  WHERE (CASE WHEN t.cartao_id IS NOT NULL
      THEN make_date(split_part(t.mes_fatura, '/', 2)::int,
           array_position(ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'], split_part(t.mes_fatura, '/', 1)), 1)
      ELSE date_trunc('month', t.data)::date END) < '2026-09-01';
CREATE TABLE backup.contestacao_antes_set2026 AS
  SELECT c.* FROM public.contestacao_classificacao c
  WHERE c.transacao_id IN (SELECT id FROM backup.transacao_antes_set2026);

DELETE FROM public.transacao_pessoal WHERE id IN (SELECT id FROM backup.transacao_antes_set2026);

-- Trava: nada de antes de setembro pode ter sobrado
DO $$
DECLARE n_resto int; n_backup int;
BEGIN
  SELECT count(*) INTO n_backup FROM backup.transacao_antes_set2026;
  SELECT count(*) INTO n_resto FROM public.transacao_pessoal t
   WHERE (CASE WHEN t.cartao_id IS NOT NULL
      THEN make_date(split_part(t.mes_fatura, '/', 2)::int,
           array_position(ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'], split_part(t.mes_fatura, '/', 1)), 1)
      ELSE date_trunc('month', t.data)::date END) < '2026-09-01';
  IF n_resto > 0 THEN RAISE EXCEPTION 'Sobraram % linha(s) de antes de setembro. Nada foi apagado.', n_resto; END IF;
  RAISE NOTICE '% lançamento(s) apagado(s); cópia em backup.transacao_antes_set2026.', n_backup;
END $$;
COMMIT;

-- Conferência. Esperado: antes_de_setembro = 0 e backup igual ao "vao_ser_apagados" do PASSO 1
SELECT (SELECT count(*) FROM public.transacao_pessoal t WHERE
         (CASE WHEN t.cartao_id IS NOT NULL
            THEN make_date(split_part(t.mes_fatura, '/', 2)::int,
                 array_position(ARRAY['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'], split_part(t.mes_fatura, '/', 1)), 1)
            ELSE date_trunc('month', t.data)::date END) < '2026-09-01') AS antes_de_setembro,
       (SELECT count(*) FROM backup.transacao_antes_set2026) AS no_backup;

-- COMO DESFAZER (devolve os lançamentos e as contestações do backup):
-- BEGIN;
-- INSERT INTO public.transacao_pessoal SELECT * FROM backup.transacao_antes_set2026
--   ON CONFLICT (id) DO NOTHING;
-- INSERT INTO public.contestacao_classificacao SELECT * FROM backup.contestacao_antes_set2026
--   ON CONFLICT (id) DO NOTHING;
-- COMMIT;
-- (Se as colunas da tabela mudarem depois de hoje, me chame antes de desfazer.)
-- Depois de algumas semanas, se estiver tudo certo, o backup pode sair:
-- DROP TABLE backup.transacao_antes_set2026; DROP TABLE backup.contestacao_antes_set2026;
