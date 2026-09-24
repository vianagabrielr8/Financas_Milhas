# Pacote 4: Milhas do zero (plano para aprovar)

> Este documento é **só o plano**. Nada foi alterado no banco nem nas telas.

## Por que refazer

- As telas de milhas atuais são uma **cópia** do app `milhas_erp`.
- Lá elas funcionam porque usam outro banco. Aqui, as tabelas que elas procuram (`programs`, `accounts`, `transactions`, `sales`...) **nunca foram criadas**. Por isso quase tudo está quebrado:
  - Estoque e Transferências não salvam;
  - Compras usa dados de mentira;
  - Passageiros lê uma tabela que não existe.
- As tabelas de milhas que existem (`programas_fidelidade`, `contas_titulares`, `movimentacao_milhas`) estão **vazias** e não são usadas por nenhuma tela.

**Decisões já tomadas por você:**
- **Não trazer nenhum dado antigo.**
- **Milhas não se mistura com Finanças.** A compra de milhas no cartão continua sendo lançada em Finanças, no centro de custo **"Gestão de Milhas"**. No módulo de milhas entram só a quantidade de milhas e o custo, e nada é gravado em `transacao_pessoal`.
- **Roxo** no lugar do verde, para não lembrar Finanças.
- As telas seguem o **`milhas_erp`**, que você já aprova.
- **No futuro, lançar milhas por print**, pelo bot.

## Como vai funcionar (em português simples)

- **Programa:** LATAM Pass, Smiles, TudoAzul, Livelo, Esfera, TAP, Iberia...
- **Conta:** uma pessoa (CPF) num programa. Exemplo: "Gabriel – LATAM Pass".
- **Movimento:** tudo que mexe no saldo:
  - **Compra:** comprei milhas e paguei R$;
  - **Bônus:** ganhei milhas sem pagar, como bônus de cartão ou promoção;
  - **Transferência:** saiu de um programa e entrou em outro, com ou sem bônus. Por exemplo, Livelo → LATAM com 80%;
  - **Uso:** emiti uma passagem para mim ou para a família;
  - **Venda:** vendi milhas ou emiti uma passagem para um cliente;
  - **Expirou:** as milhas venceram;
  - **Ajuste:** acerto manual para bater com o extrato do programa.
- **Saldo** de cada conta = soma dos movimentos. Não precisa digitar o saldo.
- **Custo médio do milheiro** = tudo o que você pagou ÷ milhas que tem × 1.000.
  - **Exemplo:** comprei 10.000 pontos Livelo por R$ 350 (R$ 35 o milheiro). Transferi para a LATAM com 80% de bônus e entraram 18.000 milhas custando os mesmos R$ 350. O milheiro na LATAM sai por R$ 19,44.
  - Quando você usa ou vende, sai do estoque pelo custo médio daquele momento.
- **Lucro da venda** = valor recebido − custo das milhas (pelo custo médio) − taxas pagas.
- **Validade:** cada compra, bônus ou transferência pode ter data de vencimento. O painel avisa o que vence nos próximos 90 dias.
- **Limite de CPF:** cada programa limita para quantas pessoas diferentes você emite:

  | Programa | Limite | Quando renova |
  |---|---|---|
  | LATAM | 25 CPFs | 12 meses depois de cada emissão |
  | Smiles | 25 CPFs | todo 1º de janeiro |
  | Azul/TudoAzul | 5 CPFs | todo 1º de janeiro |
  | TAP | 10 CPFs | todo 1º de janeiro |
  | Iberia | 10 CPFs | 12 meses depois de cada emissão |

  A regra fica no **cadastro do programa**, e você pode mudar se o programa mudar.

## Banco (tabelas novas, com nomes em português)

Todas as tabelas têm:
- **`familia_id`**, preenchido sozinho pelo banco;
- as **mesmas regras de família**: a família vê, e só o admin grava.

| Tabela | O que guarda |
|---|---|
| `milhas_programa` | nome, tipo (companhia aérea ou banco de pontos), limite de CPF, tipo de renovação (`ANO_CIVIL` ou `12_MESES`), ativo |
| `milhas_conta` | titular (nome, CPF), programa, número do cadastro no programa (opcional), ativo |
| `milhas_movimento` | conta, tipo (os 7 acima), quantidade (sempre positiva; o sinal vem do tipo), custo em R$, data, validade, observação, ligação com a transferência ou a venda de origem |
| `milhas_venda` | conta, data, milhas usadas, valor do milheiro ou valor total, taxa de embarque (em R$ ou em milhas), cliente, localizador, situação (`A_RECEBER` ou `RECEBIDO`), data prevista de recebimento, custo e lucro calculados na hora da venda |
| `milhas_contato` | clientes e fornecedores: nome, tipo (cliente, fornecedor ou os dois), telefone, documento e observação |
| `milhas_parcela` | **contas a pagar e a receber**: tipo (`PAGAR` ou `RECEBER`), venda ou compra de origem, cliente ou fornecedor, parcela n/total, valor, vencimento, situação (`ABERTA` ou `PAGA`) e data em que foi paga |
| `milhas_venda_passageiro` | nome e CPF de cada passageiro da venda ou do uso. É daqui que sai o controle de **limite de CPF** |
| view `milhas_saldo` | saldo, custo investido e custo médio por conta. Respeita as regras de família (`security_invoker`) |

**Tabelas antigas** (`programas_fidelidade`, `contas_titulares`, `movimentacao_milhas`, vazias):
- não serão usadas;
- a remoção vai num arquivo separado em `supabase/manual/`, com backup;
- **só roda se você quiser.**

## Telas (tudo em roxo)

| Tela | O que mostra |
|---|---|
| **Painel** (`/milhas`) | milhas em estoque, valor investido, custo médio do milheiro, vendas e lucro do mês, a receber, milhas vencendo em 90 dias |
| **Estoque** | um cartão por conta: saldo, custo médio e próximo vencimento. Tocando no cartão, abre o histórico de movimentos |
| **Lançar** | um formulário só, com abas Compra / Bônus / Transferência / Uso / Expirou / Ajuste. A transferência mostra na hora quantas milhas vão entrar e o novo custo médio |
| **Vendas** | lista com lucro de cada venda e o que falta receber. Nova venda com passageiros (nome e CPF), taxa, e valor do milheiro ↔ valor total calculados um pelo outro |
| **Contas a receber / a pagar** | parcelas por vencimento, separadas em atrasadas, deste mês e futuras, com o botão "marcar como paga". Cada venda parcelada gera as parcelas a receber. Uma compra de milhas parcelada com fornecedor (Pix ou boleto) gera as parcelas a pagar |
| **Limites de CPF** | por conta e programa: usados / disponíveis, barra de progresso e quando cada CPF libera |
| **Cadastros** | **Programas**, **Contas (CPFs)** e **Clientes/Fornecedores**, cada um com as opções de criar, editar e apagar. Não dá para apagar o que já tem movimento; nesse caso, dá para desativar |

- Tudo pensado **primeiro para o celular**: listas em cartões, o menu em gaveta e botões grandes, igual ao que foi feito em Finanças.
- Saem as telas e o código antigos que usavam as tabelas em inglês (`src/hooks/useSupabaseData.ts`, `pages/milhas/*`).

## Prints pelo bot (última etapa)

- No menu do bot entra **"✈️ Milhas"**. Você escolhe a conta (ex.: Gabriel – LATAM) e manda o print do extrato do programa.
- A IA, que já lê os prints de despesas, lê o print e propõe os movimentos (compras, bônus, transferências, vencimentos).
- Você **aprova ou corrige antes de gravar**, igual já acontece com as despesas.
- Movimentos iguais aos que já estão gravados são ignorados.

## Etapas (cada uma é um PR)

| Etapa | O que faz | Mexe no banco? |
|---|---|---|
| 4.1 | Migration: tabelas novas, regras de família e a view de saldo | Sim, só tabelas novas (você roda) |
| 4.2 | Telas: Cadastros, Lançar e Estoque, em roxo; sai o código antigo | Não |
| 4.3 | Telas: Vendas, Limites de CPF e Painel | Não |
| 4.4 | Bot: "✈️ Milhas" por print | Não (você publica o bot) |
| 4.5 (opcional) | Remover as tabelas antigas vazias | Sim (você decide) |

## Compra de milhas: como pagar sem duplicar com Finanças

Ao lançar uma **Compra**, você escolhe como pagou:
- **Cartão de crédito:** a parcela já aparece na fatura em Finanças, no centro de custo "Gestão de Milhas". Em milhas **não** gera conta a pagar, para não contar duas vezes.
- **Pix ou boleto à vista:** só registra o custo.
- **Parcelado com fornecedor:** gera as parcelas em **Contas a pagar** de milhas.

## Respostas do dono (24/09/2026)

1. **Sim, vende milhas** → tela de Vendas completa, com lucro por venda.
2. **Custo médio** por média ponderada: **ok**.
3. **Parcelas controladas uma a uma** → **Contas a receber** (vendas) e **Contas a pagar** (compras parceladas com fornecedor).
4. **Programas com tela própria** para criar, editar e apagar. Os mais comuns já vêm cadastrados, e dá para editar ou apagar.

## Para você confirmar (respondido acima)

1. Você **vende milhas / emite passagens para terceiros**? (Se não, a tela Vendas fica mais simples, só com "Uso".)
2. **Custo médio** como no exemplo acima (média ponderada). Ok?
3. Venda **parcelada** (o cliente paga em várias vezes): precisa controlar cada parcela, ou basta "a receber / recebido" com a data prevista?
4. Algum programa além de LATAM, Smiles, Azul, Livelo, Esfera, TAP e Iberia para já vir cadastrado?
