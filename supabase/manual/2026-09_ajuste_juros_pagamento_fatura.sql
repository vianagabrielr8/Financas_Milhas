-- =====================================================================
-- Acerto: pagamento de fatura com outro cartão (recargapay 25/09/2026)
-- =====================================================================
-- O QUE FAZ: passa a diferença entre "pagamento" (Giro Cartão) e "juros"
--   (Empréstimos / Taxas Juros) para o pagamento bater com a fatura paga.
--   O TOTAL cobrado no cartão que pagou NÃO muda.
--
--   cartoesca (pagou a Caixa Gold Visa Set/2026 = R$ 601,71)
--     pagamento  600,69 -> 601,71
--     juros       25,03 ->  24,01      (total 625,72 continua igual)
--   bancoibis (pagou a Amazon Bradesco Set/2026 = R$ 386,90)
--     pagamento  386,24 -> 386,90
--     juros       16,09 ->  15,43      (total 402,33 continua igual)
--
-- Antes de mexer, guarda uma cópia (backup) dos valores antigos.
-- COMO RODAR: Supabase -> SQL Editor. Um passo por vez.
-- =====================================================================


-- PASSO 0 (conferência): tem que aparecer EXATAMENTE 4 linhas, com os
-- valores 600.69, 25.03, 386.24 e 16.09. Se vier diferente, PARE e me avise.
SELECT t.id, t.data, t.descricao, t.valor, c.nome AS categoria, t.mes_fatura
FROM public.transacao_pessoal t
LEFT JOIN public.categoria_pessoal c ON c.id = t.categoria_id
JOIN public.familia_membro fm ON fm.familia_id = t.familia_id
WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2'
  AND t.data = '2026-09-25'
  AND t.descricao ILIKE 'recargapay%'
  AND (t.descricao ILIKE '%cartoesca%' OR t.descricao ILIKE '%bancoibis%')
  AND t.valor IN (600.69, 25.03, 386.24, 16.09)
ORDER BY t.descricao;


-- PASSO 1 (só leitura): como vai ficar.
SELECT t.descricao, t.valor AS valor_hoje,
       CASE t.valor WHEN 600.69 THEN 601.71 WHEN 25.03 THEN 24.01
                    WHEN 386.24 THEN 386.90 WHEN 16.09 THEN 15.43 END AS valor_novo
FROM public.transacao_pessoal t
JOIN public.familia_membro fm ON fm.familia_id = t.familia_id
WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2'
  AND t.data = '2026-09-25' AND t.descricao ILIKE 'recargapay%'
  AND (t.descricao ILIKE '%cartoesca%' OR t.descricao ILIKE '%bancoibis%')
  AND t.valor IN (600.69, 25.03, 386.24, 16.09)
ORDER BY t.descricao;


-- PASSO 2: aplica. Rode o bloco inteiro de uma vez.
-- Se não achar exatamente as 4 linhas, dá erro e NADA é gravado.
BEGIN;

CREATE TABLE public.backup_2026_09_ajuste_juros (
  id uuid, valor_antigo numeric, copiado_em timestamptz DEFAULT now()
);
ALTER TABLE public.backup_2026_09_ajuste_juros ENABLE ROW LEVEL SECURITY;

INSERT INTO public.backup_2026_09_ajuste_juros (id, valor_antigo)
SELECT t.id, t.valor
FROM public.transacao_pessoal t
JOIN public.familia_membro fm ON fm.familia_id = t.familia_id
WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2'
  AND t.data = '2026-09-25' AND t.descricao ILIKE 'recargapay%'
  AND (t.descricao ILIKE '%cartoesca%' OR t.descricao ILIKE '%bancoibis%')
  AND t.valor IN (600.69, 25.03, 386.24, 16.09);

DO $$
DECLARE n int; v int;
BEGIN
  SELECT count(*), count(DISTINCT valor_antigo) INTO n, v FROM public.backup_2026_09_ajuste_juros;
  IF n <> 4 OR v <> 4 THEN
    RAISE EXCEPTION 'Esperava 4 lançamentos (um de cada valor), achei % (% valores diferentes). Nada foi gravado.', n, v;
  END IF;
END $$;

UPDATE public.transacao_pessoal t
SET valor = CASE b.valor_antigo WHEN 600.69 THEN 601.71 WHEN 25.03 THEN 24.01
                                WHEN 386.24 THEN 386.90 WHEN 16.09 THEN 15.43 END
FROM public.backup_2026_09_ajuste_juros b
WHERE b.id = t.id;

COMMIT;

-- Conferência: os totais de cada par continuam 625.72 e 402.33.
SELECT CASE WHEN t.descricao ILIKE '%cartoesca%' THEN 'cartoesca (Caixa)' ELSE 'bancoibis (Amazon)' END AS pagamento,
       sum(t.valor) AS total_no_cartao, string_agg(t.valor::text, ' + ') AS partes
FROM public.transacao_pessoal t
JOIN public.backup_2026_09_ajuste_juros b ON b.id = t.id
GROUP BY 1 ORDER BY 1;


-- COMO DESFAZER (volta os valores antigos):
-- BEGIN;
-- UPDATE public.transacao_pessoal t SET valor = b.valor_antigo
--   FROM public.backup_2026_09_ajuste_juros b WHERE b.id = t.id;
-- COMMIT;
