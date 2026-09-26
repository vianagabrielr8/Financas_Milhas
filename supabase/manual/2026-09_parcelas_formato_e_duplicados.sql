-- =====================================================================
-- Validação dos dados (etapa 2): conserto do formato das parcelas
-- =====================================================================
-- O QUE FAZ:
--   1. Troca o final "[Parc 2/10]" (formato antigo do bot) pelo padrão do
--      app "(2/10)" na descrição. Só a descrição muda; valor, data e fatura
--      ficam iguais. Antes, guarda uma cópia das linhas (backup).
--   2. Mostra os possíveis lançamentos duplicados, para VOCÊ decidir
--      (este arquivo não apaga nada).
-- COMO RODAR: SQL Editor. PASSO 0, PASSO 1, depois PASSO 2 (bloco inteiro).
-- Lembrete: voltar versão no GitHub desfaz código, NÃO dados. Para desfazer
-- este conserto, use o bloco COMO DESFAZER no fim.
-- =====================================================================

-- PASSO 0 (conferência). Esperado: parcelas_formato_antigo = 19, backup_ja_existe = false
SELECT
  (SELECT count(*) FROM public.transacao_pessoal WHERE descricao ~ '\s*\[Parc [0-9]+/[0-9]+\]$') AS parcelas_formato_antigo,
  to_regclass('public.backup_2026_09_parcelas_formato') IS NOT NULL AS backup_ja_existe;

-- PASSO 1 (só leitura): como fica cada descrição
SELECT id, data, valor, descricao AS antes,
       regexp_replace(descricao, '\s*\[Parc ([0-9]+)/([0-9]+)\]$', ' (\1/\2)') AS depois
FROM public.transacao_pessoal
WHERE descricao ~ '\s*\[Parc [0-9]+/[0-9]+\]$'
ORDER BY descricao, data;

-- PASSO 1b (só leitura): os possíveis duplicados (mesma data, valor,
-- descrição e cartão/conta). Confira no app e apague na tela Transações
-- o que for repetido de verdade.
SELECT t.id, t.data, t.descricao, t.valor, t.tipo, t.mes_fatura, t.criado_em
FROM public.transacao_pessoal t
JOIN (SELECT familia_id, data, valor, lower(btrim(descricao)) d, cartao_id, conta_id, mes_fatura
        FROM public.transacao_pessoal
       GROUP BY 1,2,3,4,5,6,7 HAVING count(*) > 1) g
  ON g.familia_id = t.familia_id AND g.data = t.data AND g.valor = t.valor AND g.d = lower(btrim(t.descricao))
 AND g.cartao_id IS NOT DISTINCT FROM t.cartao_id AND g.conta_id IS NOT DISTINCT FROM t.conta_id
 AND g.mes_fatura IS NOT DISTINCT FROM t.mes_fatura
ORDER BY t.data, t.descricao;

-- PASSO 2: aplica (rode o bloco inteiro).
BEGIN;
CREATE TABLE public.backup_2026_09_parcelas_formato AS
  SELECT id, descricao FROM public.transacao_pessoal WHERE descricao ~ '\s*\[Parc [0-9]+/[0-9]+\]$';

UPDATE public.transacao_pessoal
   SET descricao = regexp_replace(descricao, '\s*\[Parc ([0-9]+)/([0-9]+)\]$', ' (\1/\2)')
 WHERE descricao ~ '\s*\[Parc [0-9]+/[0-9]+\]$';

-- Trava: tem que ter mexido exatamente nas linhas do backup
DO $$
DECLARE n_backup int; n_resto int;
BEGIN
  SELECT count(*) INTO n_backup FROM public.backup_2026_09_parcelas_formato;
  SELECT count(*) INTO n_resto FROM public.transacao_pessoal WHERE descricao ~ '\[Parc [0-9]+/[0-9]+\]';
  IF n_resto > 0 THEN RAISE EXCEPTION 'Ainda restaram % linha(s) no formato antigo. Nada foi gravado.', n_resto; END IF;
  RAISE NOTICE '% descrição(ões) corrigida(s).', n_backup;
END $$;
COMMIT;

-- Conferência. Esperado: 0
SELECT count(*) AS restam FROM public.transacao_pessoal WHERE descricao ~ '\[Parc [0-9]+/[0-9]+\]';

-- COMO DESFAZER (volta as descrições do backup):
-- BEGIN;
-- UPDATE public.transacao_pessoal t SET descricao = b.descricao
--   FROM public.backup_2026_09_parcelas_formato b WHERE b.id = t.id;
-- COMMIT;
-- Depois de conferir que está tudo certo (alguns dias), o backup pode sair:
-- DROP TABLE public.backup_2026_09_parcelas_formato;
