-- =====================================================================
-- Meta de Presentes: R$ 160/mês de dez/2026 a mar/2027
-- =====================================================================
-- O QUE FAZ: cria a meta da categoria "Presentes" (compras de Natal em
--   novembro, parceladas em até 5x a partir de dezembro: R$ 800 no total).
--   Se já existir meta de Presentes nesses meses, ela passa a ser 160.
-- COMO RODAR: Supabase -> SQL Editor. Bloco inteiro.
-- COMO DESFAZER: ver o fim do arquivo.
-- =====================================================================

BEGIN;

-- Trava: tem que existir exatamente 1 categoria "Presentes".
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.categoria_pessoal c
  JOIN public.familia_membro fm ON fm.familia_id = c.familia_id
  WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2' AND c.nome ILIKE 'presentes';
  IF n <> 1 THEN RAISE EXCEPTION 'Esperava 1 categoria Presentes, achei %. Nada foi gravado.', n; END IF;
END $$;

INSERT INTO public.meta_categoria (familia_id, mes, categoria_id, valor)
SELECT c.familia_id, m.mes::date, c.id, 160
FROM public.categoria_pessoal c
JOIN public.familia_membro fm ON fm.familia_id = c.familia_id
CROSS JOIN (VALUES ('2026-12-01'), ('2027-01-01'), ('2027-02-01'), ('2027-03-01')) AS m(mes)
WHERE fm.user_id = 'd327ec3e-5f8c-4b13-b023-fc1c3b37c8d2' AND c.nome ILIKE 'presentes'
ON CONFLICT (familia_id, mes, categoria_id) DO UPDATE SET valor = EXCLUDED.valor;

COMMIT;

-- Conferência: nova meta da casa por mês (dez a mar sobem R$ 160).
SELECT mes, sum(valor) AS meta_da_casa, count(*) AS categorias
FROM public.meta_categoria GROUP BY mes ORDER BY mes;

-- COMO DESFAZER:
-- DELETE FROM public.meta_categoria mc USING public.categoria_pessoal c
-- WHERE mc.categoria_id = c.id AND c.nome ILIKE 'presentes'
--   AND mc.mes IN ('2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01');
