# Pacote 3: metas da casa e gamificação (plano, ainda NÃO implementado)

## Por que existe

A casa gasta mais do que deveria. O objetivo é chegar a um **orçamento de R$ 17 mil por mês para a casa**, aos poucos, sem que a Ingrid sinta que está sempre se apertando. A ferramenta é um **jogo**: metas quinzenais, mensais e trimestrais, com **prêmios da lista de desejos dela**. Os prêmios são pagos com uma parte do que a casa economizou.

## Decisões do dono (24/09/2026)

- **Meta de economia:** é da **casa toda**, não só da categoria Ingrid.
- **Orçamento da casa:** chegar a **R$ 17 mil/mês**, descendo aos poucos.
- **Entrada da Ingrid:**
  - o app controla só a **contribuição** que ela passa para a casa (hoje R$ 3 mil), mais os gastos dela no cartão (categoria Ingrid);
  - o que ela ganha acima da contribuição fica com ela e **não** entra no app.
- **Prêmios:** em **coisas**, escolhidas numa **lista de desejos** dela, cada item com um valor.
- **Percentuais aprovados:**
  - quinzena: prêmio pequeno e fixo;
  - mês: **20%** da economia do mês;
  - trimestre: **30%** da economia acumulada.
- **Mensagens:** lista de modelos sorteados, sem IA. **Só a Ingrid recebe**; o dono não.

## O que os dados mostram hoje

Base: CSV de `transacao_pessoal`, com 1518 linhas.

| Mês (fatura ou data) | Gasto já lançado |
|---|---|
| Set/2026 | R$ 58,5 mil |
| Out/2026 | R$ 41,9 mil |
| Nov/2026 | R$ 36,2 mil |
| Dez/2026 | R$ 30,7 mil |
| Jan/2027 | R$ 22,2 mil |
| Fev/2027 | R$ 17,1 mil |
| Mar/2027 | R$ 10,7 mil |

- **De outubro em diante, quase tudo é parcela já comprometida.** Por isso a meta de R$ 17 mil precisa de uma **rampa**: a meta de cada mês é a soma de três coisas:
  - **as parcelas que já existem naquele mês**, que não dá para mudar;
  - **os gastos fixos** (a estimar);
  - **uma verba livre que vai encolhendo.**
- **A rampa só desce se não entrar parcelamento novo sem combinar.** Isso vira uma regra do jogo.
- **Não há nenhuma receita registrada.** Sem entradas (salário do dono e contribuição da Ingrid), não dá para medir a economia de verdade. **Registrar as entradas é o primeiro passo.**
- **Falta o histórico do outro app** que o dono usava. Ele ajuda a estimar os gastos fixos e a média real.

## Como o jogo funciona

1. **O prêmio sai da economia.** Economia do período = meta do período − gasto real. O prêmio é uma parte dela. A casa sempre fica com a maior parte.
2. **Três níveis:**
   - **Quinzena** (1–15 e 16–fim): ficar dentro da verba da quinzena → prêmio pequeno.
   - **Mês:** fechar o mês dentro da meta → 20% da economia do mês.
   - **Trimestre:** juntar a meta de economia do trimestre → 30% do acumulado. Este é o prêmio grande.
3. **Regras para não desanimar:**
   - estourar uma quinzena **não zera** o cofrinho do trimestre;
   - **1 coringa por trimestre**: uma quinzena ruim que não conta.
4. **Lista de desejos:** a Ingrid cadastra o que quer ganhar, com um valor. O painel mostra quanto falta para cada item.
5. **Linguagem sempre de "quanto está livre" e "quanto você já ganhou"**, e não de "quanto você gastou".

## Mensagens (bot do Telegram, só para a Ingrid)

**Quando ela recebe:**
- a cada lançamento novo ou alterado na **categoria Ingrid**, venha do bot ou do app;
- a cada mudança feita pelo dono que afete a meta: editar, apagar ou aceitar uma contestação;
- no botão **"📊 Como estou?"** do bot, a qualquer hora;
- no **fechamento** da quinzena, do mês e do trimestre, com o resultado e o prêmio.

**Faixas de tom:**
- 🟢 tranquila;
- 🟡 atenção, com uma dica concreta;
- 🔴 estourou, acolhendo sem bronca;
- 🏆 conquista.

Cada faixa terá **vários modelos**, sorteados sem repetir o anterior.

**Exemplo:**

> "💚 Faltam 9 dias pro fim da quinzena e você ainda tem **R$ 310 livres**. Cofrinho do trimestre: **R$ 1.840**, 37% do caminho pro prêmio grande!"

## O que muda no app (proposta)

- **Metas** (hoje a tela é só visual e não salva nada): meta da casa por mês, com a rampa, verba da categoria Ingrid e metas de economia do trimestre.
- **Entradas:** lançar todo mês a receita do dono e a contribuição da Ingrid, como `RECEITA`.
- **Painel do jogo**, para a Ingrid e para o dono:
  - verba livre da quinzena;
  - barra do mês;
  - cofrinho do trimestre;
  - lista de desejos;
  - prêmios conquistados.
- **Painel do dono:** economia real, prêmios devidos e o botão "Prêmio pago ✅".

## Etapas previstas (cada uma vira um PR)

| Etapa | O que faz |
|---|---|
| 1 | Dados de partida: importar ou analisar o histórico do outro app; estimar gastos fixos; montar a rampa até R$ 17 mil; registrar as entradas |
| 2 | Tabelas novas: `meta_mensal`, `periodo_jogo` (quinzena, mês e trimestre, com resultado), `desejo` (lista de desejos), `premio` (conquistado e pago), `mensagem_modelo` e `notificacao_enviada` |
| 3 | Tela Metas de verdade, mais o painel do jogo e a lista de desejos |
| 4 | Bot: botão "Como estou?" e aviso a cada lançamento da categoria Ingrid |
| 5 | Aviso quando o dono muda algo (gatilho no banco que chama o bot), mais o fechamento automático de quinzena, mês e trimestre (agendador) |
| 6 | Ajuste fino das mensagens e dos valores depois de 1 mês de uso |

## Perguntas em aberto

1. **Histórico do outro app:** o arquivo não chegou. Reenviar (CSV ou planilha).
2. **Verba mensal da categoria Ingrid:** partir da média dela nos últimos meses, um pouco abaixo?
3. **Valor fixo do prêmio da quinzena** (sugestão: R$ 50)?
4. **Meta de economia do trimestre** (o dono citou R$ 5 mil)?
5. **As entradas:** o dono lança a própria receita também, ou só a contribuição da Ingrid?
