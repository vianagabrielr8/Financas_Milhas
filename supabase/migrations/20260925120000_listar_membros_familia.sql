-- =====================================================================
-- Pacote 2 / Etapa 4a: função para a tela "Família" listar os membros
-- =====================================================================
-- O QUE FAZ: cria a função listar_membros_da_familia(), que devolve
--   nome, e-mail e papel das pessoas da SUA família (só da sua).
--   O app precisa dela porque a lista de e-mails de login fica numa
--   área protegida do Supabase que a tela não consegue ler direto.
--
-- O QUE NÃO FAZ: não cria tabela e não mexe em nenhum dado.
--
-- COMO RODAR: Supabase (projeto tdatvduchifakmocywhq) -> SQL Editor.
-- =====================================================================


-- PASSO 0 (conferência): a função ainda não existe e a etapa 2 já rodou.
-- Esperado: funcao_ja_existe = false, etapa2_ok = true.
SELECT
  EXISTS (SELECT 1 FROM pg_proc
           WHERE pronamespace = 'public'::regnamespace
             AND proname = 'listar_membros_da_familia') AS funcao_ja_existe,
  EXISTS (SELECT 1 FROM pg_proc
           WHERE pronamespace = 'public'::regnamespace
             AND proname = 'minha_familia') AS etapa2_ok;


-- PASSO 1: não há linhas a conferir (só cria uma função de leitura).


-- PASSO 2: cria a função. Rode o bloco inteiro.
BEGIN;

CREATE FUNCTION public.listar_membros_da_familia()
RETURNS TABLE (user_id uuid, nome text, email text, papel text, sou_eu boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT fm.user_id,
         coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email)::text,
         u.email::text,
         fm.papel,
         fm.user_id = auth.uid()
  FROM public.familia_membro fm
  JOIN auth.users u ON u.id = fm.user_id
  WHERE fm.familia_id = public.minha_familia()
  ORDER BY fm.papel, u.email
$$;

REVOKE EXECUTE ON FUNCTION public.listar_membros_da_familia() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_membros_da_familia() TO authenticated, service_role;

COMMIT;


-- COMO DESFAZER:
-- DROP FUNCTION IF EXISTS public.listar_membros_da_familia();
