# Pacote 5: Milhas v2, Metas & Game e Dashboard (plano)

> Lista de pedidos do dono em 25/09/2026, organizada em etapas. Cada etapa vira um PR.

## Decisões do dono
- **Cartões em Milhas:** usar os cartões de **Finanças** (só leitura). Não tem cadastro duplicado, e Milhas nunca grava em Finanças.
- **Titular separado:** a **pessoa** (nome e CPF) é cadastrada uma vez; os **programas** também, em outra tela. No lançamento você escolhe pessoa + programa, e o saldo daquela pessoa naquele programa (a "carteira") é criado sozinho.
- **Clube de assinatura:** no cadastro você informa a **data de início** e o **dia do crédito**. O app programa os créditos de cada mês, que entram no saldo quando a data chega. Pontos do plano e bônus do clube ficam **separados**, porque o extrato do programa costuma mostrar assim. O **bot** também reconhece essas linhas no print.

## Regras de limite de CPF (pesquisa em 25/09/2026)

| Programa | Regra | Como o app conta | Confiança |
|---|---|---|---|
| LATAM Pass | 25 **emissões** para terceiros em 12 meses corridos. Estourar leva a bloqueio | Conta **passagens** dos últimos 12 meses; cada uma libera 12 meses depois | média-alta |
| Smiles | 25 **pessoas diferentes** por **ano civil** (zera em 1º de janeiro) | Conta pessoas no ano | média-alta |
| Azul Fidelidade | **Lista fixa** de beneficiários por nível: Básico 5, Topázio 6, Safira 7, Diamante 8, Diamante Unique 15, Azul One 20. Troca com espera de 30 dias | Lista cadastrada, com limite pelo nível | média |
| TAP Miles&Go | 10 beneficiários por **ano civil**. A lista **não pode ser trocada** | Conta pessoas no ano | média-alta |
| Iberia Club | Lista fixa, com troca livre. O número não foi confirmado (fala-se em cerca de 10) | Lista, com limite editável | baixa |
| Qatar / British (Avios) | Listas familiares: Qatar "My List" 4 adultos (mudou em 06/2026 e 09/2026); BA 5 pessoas de fora de casa | Lista, com limite editável | média |
| Livelo / Esfera | **Bancos de pontos:** não emitem passagem e não têm limite. Só transferem para o **mesmo CPF** | Sem limite | média-alta |

**Como vai ficar no app:** cada programa tem um **"modo de contagem"** (passagens em 12 meses / pessoas no ano civil / lista fixa / sem limite) e um **limite editável**. As regras mudam com frequência, então nada fica fixo no código.

## Etapas

### 5.1 Banco de Milhas v2 (SQL, você roda)
- `milhas_titular` (nome, CPF). `milhas_conta` passa a ser a "carteira" titular × programa. As contas atuais são convertidas sozinhas.
- `milhas_passageiro`: nome, **CPF ou passaporte**, nascimento, telefone e observação. As vendas e os usos passam a escolher daqui.
- `milhas_clube`: titular, programa, nome do plano, valor, periodicidade (mensal / anual / parcelado), forma de pagamento (cartão de Finanças / Pix / boleto), data de início, dia do crédito, pontos do plano por mês, bônus por mês e duração.
- Tipos novos de movimento: **CLUBE** (pontos do plano) e **CLUBE_BONUS**.
- Programas ganham: modo de contagem, limite, espera para trocar a lista e nível (Azul).
- Parcelas a pagar ganham `cartao_id`, que aponta para um cartão de Finanças e só serve para mostrar em Milhas quanto vai cair em cada cartão.

### 5.2 Telas de cadastro separadas (menu MILHAS)
- **Titulares (CPFs)**, **Programas**, **Passageiros**, **Clientes e fornecedores** e **Clubes**, cada um no seu item de menu, com criar, editar e apagar.
- Lançar e Vendas passam a pedir **titular + programa**, e o passageiro sai do cadastro.
- Compra e clube pagos **no cartão**: você escolhe o cartão de Finanças, e as parcelas caem no mês certo pelo fechamento e vencimento dele.
- Nova tela **"Cartões"** em Milhas: quanto vai cair em cada cartão por mês (compras e clubes).

### 5.3 Estoque avançado (como no app antigo)
- Filtros por titular, programa, tipo de movimento e período, e busca.
- **Histórico completo** da conta, com editar e apagar.
- Resumo da conta: saldo, milheiro, investido, vencimentos, créditos futuros do clube e limite de CPF.
- Exportar CSV.

### 5.4 Painel de Milhas mais completo
- Estoque por programa (gráfico), evolução do saldo e do milheiro mês a mês.
- Vendas e lucro por mês (gráfico), margem, ticket médio e melhores clientes.
- A receber e a pagar nos próximos meses, e o total por cartão.
- Vencimentos (linha do tempo), limites de CPF, clubes ativos e próximos créditos.
- **"Valor de mercado"** do estoque: você informa o milheiro de venda de cada programa.

### 5.5 Clubes na prática + bot
- Os créditos programados entram sozinhos na data.
- Tela do clube: quanto já pagou, milhas recebidas e **milheiro final**.
- **Bot (print de milhas):** separa "pontos do plano" e "bônus do clube" e liga as linhas ao clube cadastrado, sem duplicar.

### 5.6 Metas → "Metas & Game"
- O menu passa a se chamar **Metas & Game**.
- Placar do jogo (igual ao "Como estou?" do bot): quinzena atual (livre, dias restantes, faixa verde, amarela ou vermelha), mês, trimestre e **prêmios em jogo**.
- **Histórico:** quinzenas e meses batidos ou não, **sequência de vitórias** e prêmios conquistados e entregues.

### 5.7 Dashboard de Finanças revisado
- Card do **Game** no topo: quinzena, casa no mês e trimestre.
- Indicadores que dependem do filtro. Exemplo: "Peso de empréstimos e juros" com o filtro "Familiar" dá sempre 0, porque os juros ficam no centro Dívidas. Esses passam a olhar **todos os centros** ou somem quando não fazem sentido. Vou revisar card por card.

## Outras melhorias que sugiro
- **Bot atualizado sozinho** a cada merge (GitHub Actions), sem copiar e colar no Supabase.
- **Contas a pagar de Finanças:** parcelas futuras por cartão (compromissos dos próximos meses) num lugar só.
- **Alerta de fatura:** o bot avisa você 3 dias antes do vencimento de cada cartão, com o valor.
- **Backup semanal** dos dados de Milhas e Finanças num arquivo que você baixa.

## Ordem sugerida
5.1 → 5.2 → 5.3 → 5.5 → 5.4 → 5.6 → 5.7. Milhas primeiro, porque você vai começar a lançar; depois Game e Dashboard.
