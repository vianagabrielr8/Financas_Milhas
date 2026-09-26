-- =====================================================================
-- Liberar o Daniel no app, com a FAMÍLIA DELE (sem ver os seus dados)
-- =====================================================================
-- O QUE FAZ: coloca o e-mail do Daniel na lista cadastro_liberado. No
--   primeiro login dele (com Google, nesse e-mail), o app cria uma família
--   NOVA para ele, com ele como admin. Ele não vê nada da sua família: cada
--   família só vê os próprios dados (regras do banco, RLS).
--   A família dele começa vazia: ele cadastra contas, cartões, categorias
--   e programas de milhas dele.
-- COMO RODAR: SQL Editor. Troque EMAIL_DO_DANIEL@gmail.com pelo e-mail do
--   Google dele (minúsculo), nos 3 lugares. PASSO 0, depois PASSO 2.
-- =====================================================================

-- PASSO 0 (só leitura). Esperado: ja_liberado = false, ja_tem_familia = false
SELECT
  EXISTS (SELECT 1 FROM public.cadastro_liberado WHERE email = lower('EMAIL_DO_DANIEL@gmail.com')) AS ja_liberado,
  EXISTS (SELECT 1 FROM public.familia_membro m JOIN auth.users u ON u.id = m.user_id
           WHERE lower(u.email) = lower('EMAIL_DO_DANIEL@gmail.com')) AS ja_tem_familia;

-- PASSO 1: nada a mostrar (só acrescenta 1 e-mail na lista).

-- PASSO 2: aplica.
BEGIN;
INSERT INTO public.cadastro_liberado (email) VALUES (lower('EMAIL_DO_DANIEL@gmail.com'))
  ON CONFLICT DO NOTHING;
COMMIT;

-- COMO DESFAZER (antes de ele entrar pela 1ª vez):
-- DELETE FROM public.cadastro_liberado WHERE email = lower('EMAIL_DO_DANIEL@gmail.com') AND usado_em IS NULL;
-- (Depois que ele entrou, a família dele já existe; para remover, me chame.)
