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

## Histórico do app antigo (jan–abr/2026, 1.284 lançamentos)

Média mensal ≈ **R$ 37 mil**, mas nem tudo é consumo da casa:

| Grupo | Média/mês |
|---|---|
| **Consumo da casa** (mercado, bebê, AP, carros, Ingrid, Gabriel etc.) | **R$ 19,7 mil** |
| Terceiros no cartão (tags `cartão-paiemae`, `cartão-lucas`, `terceiros-*`) | R$ 9,2 mil |
| Milhas (negócio: Livelo, Esfera, compra de pontos) | R$ 4,6 mil |
| Investimentos | R$ 2,4 mil |
| Empréstimos | R$ 1,5 mil |

- A **meta de R$ 17 mil vale para o consumo da casa**. Hoje ele é de R$ 19,7 mil, então falta cortar cerca de **R$ 2,7 mil/mês (14%)**. É uma meta alcançável.
- **Terceiros, milhas e investimentos ficam fora da meta.** No app, eles precisam ter uma marca própria (centro de custo ou tag) para não contar como gasto da casa. Terceiros deveriam virar "a receber".
- **Categoria Ingrid:** média de **R$ 3,7 mil/mês** (Fixo ≈ R$ 2,7 mil e Variável ≈ R$ 1 mil). A contribuição dela é de R$ 3 mil.
  - Há compras (Shein, C&A, Arezzo) marcadas como "Fixo", o que atrapalha a leitura.
  - Há um item do Gabriel (RELOGIO_GABRIEL) dentro de Ingrid.

## Recomendação de metas (primeira versão)

**Consumo da casa: rampa até R$ 17 mil.**

| Mês | Meta de consumo |
|---|---|
| 1º | R$ 19 mil |
| 2º | R$ 18,5 mil |
| 3º | R$ 18 mil |
| 4º em diante | R$ 17 mil |

**Economia do trimestre**, medida contra a base de R$ 19,7 mil:
- **Trimestre 1:** meta de **R$ 3,5 mil**. É um começo realista, que dá vitória logo.
- **Trimestre 2 em diante:** meta de **R$ 8 mil**, que é o consumo em R$ 17 mil pelos três meses.

**Verba da Ingrid:**
- **Trimestre 1:** **R$ 3,3 mil/mês** (Fixo R$ 2,7 mil + Variável R$ 600).
- **Depois:** **R$ 3 mil/mês**, igual à contribuição dela. A mensagem é: *"sua categoria cabe na sua contribuição"*.

**Prêmios: cuidado para não pagar duas vezes pela mesma economia.** Com 20% no mês **mais** 30% no trimestre, até 50% da economia vira prêmio. A recomendação é um teto de cerca de 30% no total:

| Nível | Prêmio |
|---|---|
| Quinzena | R$ 50 fixos (no máximo R$ 300 por trimestre) |
| Mês | 10% da economia do mês |
| Trimestre | 20% da economia do trimestre, só se bater a meta |

**Exemplo:** no trimestre 2, economizando R$ 8 mil:
- R$ 800 vêm dos prêmios mensais (10% de cada mês);
- R$ 1.600 vêm do prêmio do trimestre (20%);
- até R$ 300 vêm das quinzenas.

Ela ganha até cerca de R$ 2,7 mil em desejos, e **a casa fica com cerca de R$ 5,3 mil.**

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

1. ~~Histórico do outro app~~: recebido e analisado (acima).
2. **Verba mensal da categoria Ingrid:** partir da média dela nos últimos meses, um pouco abaixo?
3. **Valor fixo do prêmio da quinzena** (sugestão: R$ 50)?
4. **Meta de economia do trimestre:** a recomendação está acima (R$ 3,5 mil e depois R$ 8 mil). Falta o dono confirmar.
5. ~~Entradas~~: o dono lança a receita dele (variável, porque é empreendedor) e a contribuição da Ingrid.
6. **Terceiros no cartão** (pai e mãe, Lucas etc.): eles devolvem o dinheiro? Se sim, o app deve controlar como "a receber".

## Ajustes do dono (24/09/2026), que valem por cima da recomendação acima

- **Fixo e Variável:** "Fixo" = compra **parcelada**; "Variável" = compra **à vista** no crédito.
- **Verba da Ingrid:** cerca de **R$ 2.800/mês**. Em set/2026 ela gastou R$ 3.050. Os números devem vir **do banco atual** (Supabase), não só do app antigo.
- **Prêmios deixam de ser % da economia.** Passam a ser **prêmios fixos, combinados antes**, por nível:
  - quinzena: pequeno;
  - mês: médio;
  - trimestre: grande, por exemplo **uma viagem de R$ 3 a 5 mil**.
- **O prêmio pode ser parcelado.** A parcela entra no orçamento dos meses seguintes, como uma linha "Prêmios" dentro da meta da casa. Assim a rampa até R$ 17 mil continua valendo.
- **Terceiros devolvem o dinheiro.**
  - A compra deles no cartão fica com o centro de custo "Terceiros – nome".
  - Quando eles pagam, o dono lança uma `RECEITA` no mesmo centro de custo.
  - Nada disso conta na meta da casa, e o app mostra quanto cada um ainda deve.
