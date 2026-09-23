-- =====================================================================
-- Apagar os 6 lançamentos de TESTE sem dono (user_id vazio)
-- =====================================================================
-- O QUE FAZ: apaga de transacao_pessoal as 6 linhas de teste encontradas
-- no inventário (UBER, PADARIA, IFOOD, FARMACIA de 02/09 e 06/09/2026,
-- com valor negativo e sem user_id). Hoje elas já não aparecem no app.
-- Antes de apagar, guarda uma cópia completa numa tabela de backup.
--
-- COMO RODAR: Supabase (projeto tdatvduchifakmocywhq) -> SQL Editor.
-- Rode UM passo por vez, na ordem, conferindo o resultado.
--
-- SEGURANÇA: só apaga linhas que estão na lista de ids abaixo E que
-- continuam sem user_id. Nenhuma outra tabela aponta para
-- transacao_pessoal, então nada mais é afetado.
-- =====================================================================


-- PASSO 0 (conferência): a tabela de backup ainda não existe?
-- Deve voltar "false". Se voltar "true", PARE e me avise.
SELECT to_regclass('public.backup_2026_09_lancamentos_teste') IS NOT NULL AS backup_ja_existe;


-- PASSO 1 (só leitura): as linhas que serão apagadas.
-- Devem aparecer exatamente 6 linhas, iguais às do inventário.
SELECT id, data, descricao, tipo, valor, cartao_id, conta_id, criado_em
FROM public.transacao_pessoal
WHERE user_id IS NULL
  AND id IN (
    '2628fae4-c9a0-43ef-8b5e-028b37e8aec3',
    '4aa971f4-6843-4d20-bb11-4db5e9d6595b',
    '98790790-8373-47ae-88d3-b9724497ee6b',
    '55ea3256-b2a0-4772-976f-3953b37b981e',
    '06526ee1-9a92-4901-a6cb-4c9302921e70',
    '837aa909-a2d5-468c-82be-056d9852d098'
  )
ORDER BY criado_em;


-- PASSO 2: guarda a cópia e apaga. Rode o bloco inteiro de uma vez.
BEGIN;

CREATE TABLE public.backup_2026_09_lancamentos_teste AS
SELECT *
FROM public.transacao_pessoal
WHERE user_id IS NULL
  AND id IN (
    '2628fae4-c9a0-43ef-8b5e-028b37e8aec3',
    '4aa971f4-6843-4d20-bb11-4db5e9d6595b',
    '98790790-8373-47ae-88d3-b9724497ee6b',
    '55ea3256-b2a0-4772-976f-3953b37b981e',
    '06526ee1-9a92-4901-a6cb-4c9302921e70',
    '837aa909-a2d5-468c-82be-056d9852d098'
  );

-- O backup fica escondido do app (RLS ligado, sem nenhuma regra).
ALTER TABLE public.backup_2026_09_lancamentos_teste ENABLE ROW LEVEL SECURITY;

DELETE FROM public.transacao_pessoal t
USING public.backup_2026_09_lancamentos_teste b
WHERE t.id = b.id;

-- Trava automática: se o backup não tiver exatamente 6 linhas, dá erro
-- e NADA é gravado (nem o backup, nem a exclusão).
DO $$
BEGIN
  IF (SELECT count(*) FROM public.backup_2026_09_lancamentos_teste) <> 6 THEN
    RAISE EXCEPTION 'Esperava 6 linhas no backup. Nada foi apagado.';
  END IF;
END $$;

COMMIT;

-- Conferência final: "no_backup" deve ser 6 e "ainda_no_app" deve ser 0.
SELECT
  (SELECT count(*) FROM public.backup_2026_09_lancamentos_teste) AS no_backup,
  (SELECT count(*) FROM public.transacao_pessoal t
     JOIN public.backup_2026_09_lancamentos_teste b ON b.id = t.id) AS ainda_no_app;


-- COMO DESFAZER (só se precisar): devolve as 6 linhas exatamente como eram.
-- INSERT INTO public.transacao_pessoal
-- SELECT * FROM public.backup_2026_09_lancamentos_teste;
--
-- Quando tiver certeza de que não vai precisar mais do backup:
-- DROP TABLE public.backup_2026_09_lancamentos_teste;
