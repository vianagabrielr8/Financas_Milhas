-- =====================================================================
-- Link compartilhado: nome na prévia do WhatsApp
-- =====================================================================
-- O QUE FAZ: cria a função titulo_link_compartilhado(código), que devolve
--   SÓ o nome do link (ex.: "Lucas Irmão") se ele existir e estiver ligado.
--   É usada pelo site para montar a prévia do link no WhatsApp
--   ("Contas – Lucas Irmão"). Não devolve valores nem lançamentos e não
--   conta como "aberto" (não mexe no último acesso).
-- NÃO MEXE em nenhum dado.
-- COMO RODAR: SQL Editor. PASSO 0 e depois PASSO 2. Pode rodar de novo.
-- =====================================================================

-- PASSO 0 (conferência). Esperado: tabela_links = true
SELECT to_regclass('public.link_compartilhado') IS NOT NULL AS tabela_links;

-- PASSO 1: nada a mostrar (nenhum dado muda).

-- PASSO 2: aplica.
BEGIN;
CREATE OR REPLACE FUNCTION public.titulo_link_compartilhado(p_codigo text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT titulo FROM public.link_compartilhado
   WHERE codigo = p_codigo AND ativo AND length(p_codigo) >= 32
$$;
REVOKE EXECUTE ON FUNCTION public.titulo_link_compartilhado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.titulo_link_compartilhado(text) TO anon, authenticated;
COMMIT;

-- Conferência. Esperado: true
SELECT to_regprocedure('public.titulo_link_compartilhado(text)') IS NOT NULL AS funcao;

-- COMO DESFAZER (a prévia volta a mostrar o nome geral do site):
-- DROP FUNCTION IF EXISTS public.titulo_link_compartilhado(text);
