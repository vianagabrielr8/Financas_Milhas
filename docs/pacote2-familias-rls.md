# Pacote 2: famílias, papéis e RLS (plano aprovado)

**Objetivo:** cada usuário pertence a uma **família**, e cada família vê **só os próprios dados**. O banco garante isso sozinho, com o **RLS** (regras dentro do banco que decidem quem pode ver ou mexer em cada linha).

**Famílias previstas:**
- **a do dono:** ele como admin e a esposa como membro;
- **a do Daniel;**
- **as de pessoas futuras:** cada uma ganha a sua quando entra pela primeira vez, se o e-mail estiver liberado. Nada disso exige mexer em código.

## Decisões

**Quem pode entrar**
- Pessoa nova só entra com **liberação**: o e-mail precisa estar na lista `cadastro_liberado`, que só o administrador da plataforma (o dono) controla.
- Quem está liberado ganha uma família própria e vira admin dela.
- Quem não está liberado vê a mensagem "acesso não liberado".

**Papéis**

| Papel | No app | No bot |
|---|---|---|
| `admin` | Tudo: lançar, editar, apagar, configurações, convidar e remover membros, resolver contestações | Lança |
| `membro` | **Só consulta**, mais o botão "Contestar classificação" | Lança (fica registrado quem lançou) |

- Se um dia precisar de alguém que lance pelo app sem mexer em configurações, cria-se um papel `editor` com uma migration pequena.

**Contestação:** o membro diz "a categoria deste lançamento está errada, deveria ser X". O admin aceita (a categoria é trocada) ou recusa.

**Acesso ao painel:** por enquanto, o Daniel também acessa o painel do Supabase de produção. Os cuidados para quando o app for comercializado estão no CLAUDE.md, seção "Antes de comercializar".

## 1. Tabelas afetadas

### Tabelas novas

| Tabela | Para que serve |
|---|---|
| `familia` | Uma linha por família |
| `familia_membro` | Usuário, família e papel. Cada usuário está em uma família só. |
| `convite_familia` | Convites do admin: e-mail, papel e família. São aceitos automaticamente quando a pessoa entra com o Google. |
| `cadastro_liberado` | Lista de e-mails liberados para criar uma família própria |
| `administrador_plataforma` | Quem controla a lista acima (só o dono) |
| `contestacao_classificacao` | Lançamento contestado, categoria e subcategoria sugeridas, comentário, situação (`PENDENTE`, `ACEITA` ou `RECUSADA`), quem pediu e quem resolveu |
| `telegram_vinculo` | Id da pessoa no Telegram, o usuário do app e a família |
| `telegram_codigo_vinculo` | Códigos de 6 dígitos que valem 10 minutos, usados para fazer o vínculo acima |

### Funções novas no banco

- **`minha_familia()`:** devolve a família de quem está logado.
- **`sou_admin()`:** diz se quem está logado é admin da própria família.
- **`entrar_no_app()`:** chamada logo depois do login. Segue esta ordem:
  1. se a pessoa já tem família, não faz nada;
  2. senão, se existe um convite para o e-mail dela, põe a pessoa nessa família;
  3. senão, se o e-mail está liberado, cria uma família nova com ela como admin;
  4. senão, responde "não liberado".
- **`resolver_contestacao(id, aceitar)`:** só para admin. Se aceitar, troca a categoria do lançamento e fecha a contestação, tudo de uma vez.
- **`gerar_codigo_telegram()`:** gera o código de vínculo com o Telegram.

### Tabelas existentes

Todas ganham a coluna `familia_id`.
- O valor padrão dessa coluna é `minha_familia()`. Por isso **o app não precisa mandar a família ao gravar**: o banco preenche sozinho.
- **Todas as linhas atuais recebem a família do dono.**
- A coluna `user_id` que já existe continua lá e serve para mostrar "quem lançou".

| Grupo | Tabelas | Quem vê | Quem grava pelo app |
|---|---|---|---|
| Lançamentos de Finanças | `transacao_pessoal`, `payables`, `payable_installments`, `receivables`, `receivable_installments` | Toda a família | Admin |
| Configurações de Finanças | `categoria_pessoal`, `subcategoria_pessoal`, `centro_custo_projeto`, `cartao_pessoal`, `cartao_vinculado`, `conta_financeira_pessoal` | Toda a família | Admin |
| Milhas (inglês) | `programs`, `accounts`, `transactions`, `passengers`, `sales`, `sale_passengers`, `clients`, `suppliers`, `credit_cards` | Toda a família | Admin |
| Milhas (português) | `programas_fidelidade`, `contas_titulares`, `passageiros` | Toda a família | Admin |
| Contestações | `contestacao_classificacao` | Toda a família | Membro e admin criam; só o admin resolve |

**Outros cuidados:**
- **Views** `expiring_miles`, `program_balance_summary` e `miles_balance`: precisam da opção `security_invoker`. Sem ela, uma view **ignora o RLS** e mostraria os dados de todas as famílias.
- **Tabelas de backup** (`backup_2026_09_...`): ligar o RLS **sem nenhuma regra**. Assim o app não as enxerga, mas o painel continua enxergando.
- **Regras de "nome único":** passam a valer por família. O inventário mostra quais existem.
- **Programas de milhas** passam a ser por família.
- **Qualquer outra tabela** que o inventário encontrar recebe o mesmo tratamento.

## 2. Etapas (cada uma testável e reversível)

**Arquivos de banco:** ficam em `supabase/migrations/`, no formato PASSO 0, 1, 2 e COMO DESFAZER, conforme o CLAUDE.md. Rodam **primeiro no projeto de teste**, depois em produção.

| Etapa | PR | O que faz | Toca produção? | Como desfazer |
|---|---|---|---|---|
| 0 | 1 | Inventário (só leitura) e atualização do CLAUDE.md. O código atual do bot entra no repositório sem mudanças. | Não | Nada a desfazer |
| 1 | 2 | Projeto de teste: estrutura base igual à real, dados falsos de 2 famílias e guia dos painéis | Não | Apagar o projeto de teste |
| 2 | 3 | Tabelas e funções novas, já com RLS (estão vazias). Cria a família do dono com o dono como admin e a esposa como membro. | Só tabelas novas | `DROP` das tabelas e funções novas |
| 3 | 4 | Coluna `familia_id` em tudo, sem ser obrigatória; preenchimento; índices; backup de `transacao_pessoal`; **rede de segurança** | Sim | `DROP COLUMN` e remover a rede |
| 4 | 5 (ou 5a e 5b) | Telas: família e papel, "acesso não liberado", Família e convites, Liberar acesso, contestar, Contestações, "Conectar Telegram" | Não | Reverter o PR |
| 5 | 6 | Bot com vínculo, bloqueio de desconhecidos e `familia_id` | Função publicada pelo dono | Publicar a versão anterior |
| 6 | 7 | Regras de acesso, views com `security_invoker` e RLS ligado em **3 grupos**: 6a Milhas; 6b configurações e contas a pagar/receber; 6c `transacao_pessoal` | Sim | `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` |
| 7 | 8 | `familia_id` passa a ser obrigatória; remove a rede de segurança, os backups antigos e o rascunho `src/bot.ts` | Sim | `DROP NOT NULL` e recriar a rede |

**Rede de segurança (etapa 3):** se alguém gravar sem família e sem estar logado (por exemplo, o bot antigo), a linha recebe a família do dono. Assim nada "some" enquanto o bot não é atualizado.

**Etapa 6:** em cada arquivo, as regras são criadas **antes** de o RLS ser ligado. O app nunca fica vazio.

## 3. Passos manuais nos painéis

**Supabase: projeto de teste** (na mesma organização)
1. Criar o projeto `milheirosmart-teste`. O plano grátis permite 2 projetos ativos.
2. No SQL Editor do projeto de teste, rodar a estrutura base, as migrations e os dados falsos.
3. Em Authentication → Providers → Google: ligar o login com Google, com o mesmo Client ID e Secret da produção.
4. No Google Cloud Console, no cliente OAuth, em "URIs de redirecionamento autorizados": adicionar `https://<id-do-teste>.supabase.co/auth/v1/callback`.
5. Em Authentication → URL Configuration: adicionar as URLs de preview da Vercel e `http://localhost:5173/**`.

**Vercel:** em Settings → Environment Variables, configurar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` assim:
- em **Production**, com os valores da produção;
- em **Preview**, com os valores do teste.

**Telegram** (etapa 5)
1. Criar um segundo bot, de teste, no @BotFather.
2. Em cada projeto Supabase, cadastrar os segredos `TELEGRAM_BOT_TOKEN` e `TELEGRAM_WEBHOOK_SECRET`.
3. Registrar o webhook (o endereço para onde o Telegram manda as mensagens) com o `secret_token`. O link fica pronto no guia.

## 4. Riscos e testes

| Risco | Como evitar | Como testar |
|---|---|---|
| App fica vazio ao ligar o RLS | Regras criadas antes, 3 grupos, ensaio no teste | Totais do Dashboard antes e depois |
| Linha fica sem família | Preenchimento e rede de segurança | O SELECT de linhas sem família precisa dar 0 |
| View mostra outra família | `security_invoker` | Daniel, no teste, não vê dados da outra família |
| Bot aceita estranhos ou grava na família errada | Vínculo obrigatório, segredo do webhook, família vinda do vínculo | Conta não vinculada recebe "não autorizado" |
| Bot usa categoria de outra família (o `service_role` ignora o RLS) | Toda busca do bot filtra por `familia_id` | 2 famílias falsas com categorias de mesmo nome |
| Nome único trava outra família | Regra passa a valer por família | Criar a mesma categoria nas 2 famílias |
| Admin trancado fora | Proibido remover o último admin | Tentar remover a si mesmo |
| Membro grava pelo navegador | O RLS só deixa o admin gravar | Salvar logado como membro precisa dar erro |
| Perda de dados | Backups, nenhum DELETE, "como desfazer" em cada arquivo | Contagens antes e depois |

## 5. Bot: vínculo com o Telegram

1. No app, a pessoa clica em "Conectar Telegram" e recebe um código de 6 dígitos.
2. No Telegram, manda `/vincular 123456` para o bot.
3. O bot salva o `from.id` (id da pessoa no Telegram), o usuário e a família.
4. **A cada mensagem, o bot:**
   - confere o segredo do webhook;
   - aceita só conversa privada;
   - procura o vínculo; se não achar, responde "não autorizado" e **não grava nada**;
   - grava com o `user_id` e o `familia_id` do vínculo;
   - busca categorias, cartões e contas **só da família** da pessoa.
5. Para desvincular, existe um botão no app.

## Resultado do inventário (set/2026) — ajusta o plano acima

- **Dados reais estão em 6 tabelas**, todas com `user_id` do dono:
  - `transacao_pessoal`: 1524 linhas, **6 delas sem `user_id`**;
  - `subcategoria_pessoal`: 31;
  - `categoria_pessoal`: 17;
  - `cartao_pessoal`: 10;
  - `centro_custo_projeto`: 6;
  - `conta_financeira_pessoal`: 4;
  - `cartao_vinculado`: 4 linhas, sem `user_id`.
- **O RLS já está ligado em todas as tabelas.**
  - As 6 principais têm a regra `Restricao_Absoluta_Dono` (`auth.uid() = user_id`). Hoje cada usuário vê só o que ele mesmo criou, então a esposa não veria nada. Na etapa 6, essa regra é **trocada** pela regra por família, no mesmo comando.
  - `cartao_vinculado` tem a regra "Permitir Leitura" (`true`): qualquer pessoa logada lê. Será fechada por família.
  - As demais tabelas não têm nenhuma regra. Só as funções do servidor, que usam a `service_role`, enxergam essas tabelas.
- **Tabelas do código que NÃO existem no banco:**
  - o modelo de Milhas em inglês: `programs`, `accounts`, `transactions`, `passengers`, `sales`, `sale_passengers`, `clients`, `suppliers`, `credit_cards`;
  - `payables`, `payable_installments`, `receivables`, `receivable_installments`;
  - `passageiros`;
  - as views `expiring_miles` e `program_balance_summary`.

  Não existe nenhuma view, então o cuidado com `security_invoker` não se aplica hoje. Consertar essas telas fica fora do Pacote 2.
- **Tabelas que o plano não previa e que recebem `familia_id`:**
  - `sessao_bot` (chave `chat_id`);
  - `open_finance_staging` e colunas `pluggy_*` (integração Pluggy);
  - `memoria_categorizacao` (usa `vector`);
  - `auditoria_fila`, `movimentacao_milhas`, `transacoes_financeiras`, `parcelas_financeiras`;
  - `categoria_financas`, `categorias`, `subcategorias`, `cartoes_credito`;
  - `programas_fidelidade` e `contas_titulares` (vazias).
- **Regras de "único" que passam a valer por família:**
  - `centro_custo_projeto(nome)`;
  - `programas_fidelidade(nome)`;
  - `contas_titulares(cpf)`;
  - também `categorias(nome)` e `cartoes_credito(nome)`, que estão vazias.

  Os ids do Pluggy continuam únicos no banco inteiro.
- **Não há funções nem gatilhos no esquema `public`.** As extensões instaladas incluem `pg_cron`, `pg_net`, `vector` e `supabase_vault`, então pode haver uma tarefa agendada chamando Edge Functions. Isso precisa ser conferido.
- **O banco é PostgreSQL 17.6.**

## 6. Estimativa

**8 PRs**, ou 9 se o PR 5 for dividido.
