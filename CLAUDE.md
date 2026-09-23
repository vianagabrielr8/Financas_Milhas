# MilheiroSmart — regras para quem mexe neste projeto (IA ou pessoa)

App de finanças pessoais + milhas. React (Vite) + Supabase (banco) + Vercel (site).
Um bot do Telegram também grava lançamentos no mesmo banco. Outra IA (Gemini)
também edita este repositório — estas regras valem para todos.

## Quem é o dono
- Não é programador. Explique tudo em **português simples**, sem jargão.
  Quando usar um termo técnico, explique em uma frase.
- Ele testa as mudanças no preview da Vercel antes de aprovar.

## Regras de trabalho
1. Sempre trabalhe num **branch** e abra um **Pull Request**. Nunca faça push
   direto na `main` e nunca faça merge sozinho.
2. **Nunca altere dados do banco** (UPDATE/DELETE/INSERT em massa, mudança de
   tabela, RLS) direto. Escreva o SQL num arquivo em `supabase/manual/`, com:
   um SELECT que mostra o que muda, o comando, e como desfazer. O dono revisa e
   roda manualmente.
3. Nunca escreva chaves, tokens ou senhas no código. Use o `.env` (que não vai
   para o GitHub) e o `.env.example` (só os nomes). No site, as variáveis ficam
   no painel da Vercel.
4. O Supabase devolve no máximo 1000 linhas por consulta. Consultas que podem
   passar disso devem paginar com `.range()`.

## Formato de `transacao_pessoal` (tela, importação e bot devem gravar IGUAL)

| Campo | Formato |
|---|---|
| `tipo` | `DESPESA`, `RECEITA`, `ESTORNO` ou `PAGAMENTO_FATURA` (maiúsculas, exatamente assim) |
| `situacao` | `PAGO`, `PENDENTE` ou `RECEBIDO` |
| `valor` | sempre **positivo**; o sinal vem do `tipo` |
| `data` | `AAAA-MM-DD` (data da compra ou do lançamento) |
| `cartao_id` **ou** `conta_id` | um OU outro, nunca os dois. Compra no cartão → `cartao_id`; conta/dinheiro → `conta_id` |
| `mes_fatura` | só em compra de cartão. Texto `Mmm/AAAA` com 1ª letra maiúscula: `Jan`, `Fev`, `Mar`, `Abr`, `Mai`, `Jun`, `Jul`, `Ago`, `Set`, `Out`, `Nov`, `Dez` (ex.: `Set/2026`). Nunca `09/2026` nem `set/2026` |
| `centro_custo_id` | id de `centro_custo_projeto` (obrigatório na tela) |
| `categoria_id` / `subcategoria_id` | ids de `categoria_pessoal` / `subcategoria_pessoal` (podem ficar vazios) |
| parcelas | uma linha por parcela, com ` (n/total)` no fim da descrição (ex.: `Geladeira (2/10)`), cada uma com o `mes_fatura` do seu mês |

### `PAGAMENTO_FATURA`
- Criado pelo botão "Pagar Fatura". Fica na **conta bancária** (`conta_id`),
  sem `cartao_id`.
- **Não** é gasto: as compras do cartão já foram contadas. Nunca some esse
  tipo em totais de despesa/consumo (Transações, Dashboard, Fluxo de Caixa).
- Mas o dinheiro saiu de verdade da conta: em qualquer cálculo de saldo
  bancário, ele **subtrai**.

## Tabelas reais do app
Finanças (as principais):
- `transacao_pessoal` — todo lançamento (conta ou cartão)
- `cartao_pessoal` — cartões (`nome`, `limite`, `dia_fechamento`, `dia_vencimento`)
- `cartao_vinculado` — cartões adicionais ligados a um cartão
- `conta_financeira_pessoal` — contas bancárias/caixas (`nome`, `saldo_inicial`)
- `categoria_pessoal`, `subcategoria_pessoal`
- `centro_custo_projeto`
- `payables`, `payable_installments`, `receivables`, `receivable_installments`

Milhas (dois modelos convivendo — não misturar sem combinar antes):
- em inglês: `programs`, `accounts`, `transactions`, `passengers`, `sales`,
  `sale_passengers`, `clients`, `suppliers`, `credit_cards`, views
  `expiring_miles`, `program_balance_summary`
- em português: `programas_fidelidade`, `contas_titulares`, `passageiros`

Atenção: as tabelas de finanças **não** estão em `supabase/migrations`
(foram criadas pelo painel do Supabase). A estrutura real está no Supabase.
