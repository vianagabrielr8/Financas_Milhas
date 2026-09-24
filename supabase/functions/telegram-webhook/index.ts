import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TELEGRAM_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

// TRAVA DE ACESSO: senha do webhook (Secret do Supabase)
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';

const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

// ------------------------------------------------------------------
// QUEM ESTÁ FALANDO: só atende contas do Telegram vinculadas no app
// (tabela telegram_vinculo). Tudo que o bot lê ou grava fica restrito
// à família dessa pessoa, e a triagem (open_finance_staging) ao chat dela.
// ------------------------------------------------------------------
type Pessoa = { chatId: number; userId: string; familiaId: string; papel: 'admin' | 'membro' };

async function obterPessoa(telegramId: number): Promise<Pessoa | null> {
  const { data: vinculo } = await supabase.from('telegram_vinculo')
    .select('user_id, familia_id').eq('telegram_user_id', telegramId).maybeSingle();
  if (!vinculo) return null;
  // Confere se a pessoa ainda é da família (pode ter sido removida no app).
  const { data: membro } = await supabase.from('familia_membro')
    .select('familia_id, papel').eq('user_id', vinculo.user_id).maybeSingle();
  if (!membro || membro.familia_id !== vinculo.familia_id) return null;
  return { chatId: telegramId, userId: vinculo.user_id, familiaId: vinculo.familia_id, papel: membro.papel };
}

// Confere se um id (conta, cartão...) é mesmo da família da pessoa.
async function daFamilia(tabela: string, id: string, familiaId: string) {
  const { data } = await supabase.from(tabela).select('id').eq('id', id).eq('familia_id', familiaId).maybeSingle();
  return !!data;
}

// /vincular 123456 -> liga esta conta do Telegram ao usuário que gerou o código no app.
async function vincularTelegram(telegramId: number, codigo: string) {
  const { data: cod } = await supabase.from('telegram_codigo_vinculo')
    .select('user_id, expira_em').eq('codigo', codigo).maybeSingle();
  if (!cod || new Date(cod.expira_em) < new Date()) {
    await sendMessage(telegramId, "❌ Código inválido ou vencido. Gere um novo no app (menu Telegram).");
    return;
  }
  const { data: membro } = await supabase.from('familia_membro')
    .select('familia_id').eq('user_id', cod.user_id).maybeSingle();
  if (!membro) {
    await sendMessage(telegramId, "❌ Sua conta do app ainda não tem família.");
    return;
  }
  // Um Telegram por pessoa: remove vínculos antigos deste Telegram ou deste usuário.
  await supabase.from('telegram_vinculo').delete().eq('telegram_user_id', telegramId);
  await supabase.from('telegram_vinculo').delete().eq('user_id', cod.user_id);
  const { error } = await supabase.from('telegram_vinculo')
    .insert({ telegram_user_id: telegramId, user_id: cod.user_id, familia_id: membro.familia_id });
  await supabase.from('telegram_codigo_vinculo').delete().eq('codigo', codigo);
  if (error) {
    await sendMessage(telegramId, "❌ Não consegui conectar. Gere um novo código e tente de novo.");
    return;
  }
  await sendMessage(telegramId, "✅ Telegram conectado! Tudo que você lançar aqui vai para a sua família.");
  await sendMainMenu(telegramId);
}
const URL_PUBLICA = 'https://tdatvduchifakmocywhq.supabase.co/functions/v1/telegram-webhook';

function chunkArray(array: any[], size: number) {
  const result = [];
  for (let i = 0; i < array.length; i += size) { result.push(array.slice(i, i + size)); }
  return result;
}

function addMonthsToFatura(fatura: string, add: number) {
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const [mesStr, anoStr] = fatura.split('/');
  let mesIdx = meses.indexOf(mesStr);
  let ano = parseInt(anoStr);
  mesIdx += add;
  while(mesIdx > 11) { mesIdx -= 12; ano++; }
  return `${meses[mesIdx]}/${ano}`;
}

// ------------------------------------------------------------------
// MENU PRINCIPAL INTERATIVO
// ------------------------------------------------------------------
async function sendMainMenu(chatId: number) {
  const botoes = [
    [{ text: "📸 Lançar Despesas por Print", callback_data: "start_upload" }]
  ];
  await sendKeyboard(chatId, "👋 Olá, Detetive de Caixa! O que vamos fazer hoje?", botoes);
}

// ------------------------------------------------------------------
// MOTOR 1: OCR
// ------------------------------------------------------------------
async function processarImagem(p: Pessoa, fileId: string) {
  const chatId = p.chatId;
  try {
    const { data: sessao } = await supabase.from('sessao_bot').select('conta_id, cartao_ativo_id, cartao_principal_id').eq('chat_id', chatId).single();

    // Se não escolheu a origem ainda, barra e volta pro início
    if (!sessao || (!sessao.cartao_ativo_id && !sessao.cartao_principal_id && !sessao.conta_id)) {
      await sendKeyboard(chatId, "⚠️ Ops! Você enviou a imagem, mas esqueceu de escolher a origem.\nDe onde saiu o dinheiro?", [
        [{ text: "🏦 Débito / Pix (Contas)", callback_data: "choose_type_conta" }],
        [{ text: "💳 Cartão de Crédito", callback_data: "choose_type_cartao" }]
      ]);
      return;
    }

    const resFile = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await resFile.json();
    if (!fileData.ok) throw new Error("Erro ao acessar imagem.");

    const imgUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileData.result.file_path}`;
    const resImg = await fetch(imgUrl);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(await resImg.arrayBuffer())));

    const dataHoje = new Date().toLocaleDateString('pt-BR');
    const prompt = `Extraia todas as transações (compras, pagamentos) desta imagem.
Regras OBRIGATÓRIAS:
1. Responda em JSON puro: [{"data": "YYYY-MM-DD", "descricao": "Nome", "valor": -50.00}]
2. Despesas são negativas. Entradas são positivas. (Use ponto para decimais).
3. O ano vigente é 2026 (hoje é ${dataHoje}).`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }] }) });
    if (!response.ok) throw new Error(`Google API recusou.`);

    const geminiData = await response.json();
    const transacoes = JSON.parse(geminiData.candidates[0].content.parts[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim());
    if (!transacoes || transacoes.length === 0) return;

    let stagingQuery = supabase.from('open_finance_staging').select('descricao, valor, data').eq('familia_id', p.familiaId);
    let consolidadasQuery = supabase.from('transacao_pessoal').select('descricao, valor, data').eq('familia_id', p.familiaId);

    if (sessao.conta_id) {
        stagingQuery = stagingQuery.eq('conta_id', sessao.conta_id);
        consolidadasQuery = consolidadasQuery.eq('conta_id', sessao.conta_id);
    } else if (sessao.cartao_ativo_id) {
        stagingQuery = stagingQuery.eq('cartao_vinculado_id', sessao.cartao_ativo_id);
        consolidadasQuery = consolidadasQuery.eq('cartao_vinculado_id', sessao.cartao_ativo_id);
    } else {
        stagingQuery = stagingQuery.is('cartao_vinculado_id', null).eq('cartao_principal_id', sessao.cartao_principal_id);
        consolidadasQuery = consolidadasQuery.is('cartao_vinculado_id', null).eq('cartao_id', sessao.cartao_principal_id);
    }

    const [{ data: stagingDB }, { data: consolidadasDB }] = await Promise.all([stagingQuery, consolidadasQuery]);
    const historicoCompleto = [...(stagingDB || []), ...(consolidadasDB || [])];

    const transacoesNovas = [];
    let ignoradas = 0;

    for (const t of transacoes) {
       const valorT = Math.abs(Number(t.valor)).toFixed(2);
       const dataT = t.data;
       const descT = t.descricao.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 5);
       const isDuplicada = historicoCompleto.some(dbTx => {
          const valDB = Math.abs(Number(dbTx.valor)).toFixed(2);
          const dataDB = dbTx.data ? dbTx.data.split('T')[0] : '';
          const descDB = dbTx.descricao ? dbTx.descricao.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
          return (valDB === valorT && dataDB === dataT && descDB.includes(descT));
       });
       if (isDuplicada) ignoradas++; else transacoesNovas.push(t);
    }

    if (transacoesNovas.length === 0) {
       await sendMessage(chatId, `🛡️ A IA leu ${transacoes.length} transações, mas todas já estão no banco. Ignoradas.`);
       return;
    }

    const payloadInsert = transacoesNovas.map((t: any, idx: number) => ({
      data: t.data,
      descricao: t.descricao,
      valor: t.valor,
      tipo_ativo: sessao.conta_id ? 'CONTA' : 'CARTAO',
      pluggy_transaction_id: 'print_' + Date.now() + '_' + idx,
      cartao_vinculado_id: sessao.cartao_ativo_id,
      cartao_principal_id: sessao.cartao_principal_id,
      conta_id: sessao.conta_id,
      chat_id: chatId,
      familia_id: p.familiaId
    }));

    await supabase.from('open_finance_staging').insert(payloadInsert);
    const { count } = await supabase.from('open_finance_staging').select('*', { count: 'exact', head: true }).eq('chat_id', chatId);

    let msg = `✅ <b>${transacoesNovas.length}</b> salvas. `;
    if (ignoradas > 0) msg += `(🛡️ ${ignoradas} repetidas barradas). `;
    msg += `\n📦 Total acumulado no lote: <b>${count || transacoesNovas.length}</b>`;

    await sendKeyboard(chatId, msg, [[{ text: "🧠 Iniciar Categorização", callback_data: "start_ai" }]]);

  } catch (err) { await sendMessage(chatId, "❌ Falha ao processar a imagem."); }
}

// ------------------------------------------------------------------
// GERADORES DE CONTEXTO E ÁRVORE
// ------------------------------------------------------------------
async function montarArvoreCategorias(p: Pessoa) {
    const { data: catData } = await supabase.from('categoria_pessoal').select('id, nome, centro_custo_id').eq('familia_id', p.familiaId);
    const { data: subData } = await supabase.from('subcategoria_pessoal').select('id, nome, categoria_id').eq('familia_id', p.familiaId);
    const { data: ccData } = await supabase.from('centro_custo_projeto').select('id, nome').eq('familia_id', p.familiaId);

    let arvore = "";
    if (ccData && catData) {
      for(const cc of ccData) {
        const catsDoCC = catData.filter(c => c.centro_custo_id === cc.id);
        let tags = [];
        for(const cat of catsDoCC) {
          tags.push(cat.nome);
          const subs = subData?.filter(s => s.categoria_id === cat.id) || [];
          for(const sub of subs) tags.push(`${cat.nome} • ${sub.nome}`);
        }
        if(tags.length > 0) arvore += `[Centro de Custo: ${cc.nome}] -> Categorias permitidas: ${tags.join(', ')}\n`;
      }
    }
    return arvore;
}

async function obterRegraCartaoSessao(p: Pessoa) {
    const { data: sessao } = await supabase.from('sessao_bot').select('cartao_principal_id').eq('chat_id', p.chatId).single();
    if (sessao && sessao.cartao_principal_id) {
        const { data: cartao } = await supabase.from('cartao_pessoal').select('tipo_leitura_parcela').eq('id', sessao.cartao_principal_id).eq('familia_id', p.familiaId).single();
        if (cartao && cartao.tipo_leitura_parcela === 'TOTAL') {
            return "VALOR_TOTAL";
        }
    }
    return "VALOR_PARCELA";
}

// ------------------------------------------------------------------
// MOTOR 2: CATEGORIZAÇÃO IA EM LOTE
// ------------------------------------------------------------------
async function executarTarefaIA(p: Pessoa) {
  const chatId = p.chatId;
  try {
    const arvoreCategorias = await montarArvoreCategorias(p);
    const { data: stagingData } = await supabase.from('open_finance_staging').select('*').eq('chat_id', chatId).order('data').order('id');
    if (!stagingData || stagingData.length === 0) return;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;
    const listaCompras = stagingData.map(tx => `ID: ${tx.id} | Descrição: ${tx.descricao}`).join('\n');

    const prompt = `Você é um assistente financeiro. Aqui está a árvore OBRIGATÓRIA. Cada Centro de Custo possui categorias exclusivas:
${arvoreCategorias}
REGRA DE OURO: NUNCA atribua uma Categoria a um Centro de Custo diferente do mapeado. Se não houver categoria clara, pode deixar null.
Transações:\n${listaCompras}\n
Responda APENAS em JSON: [{"id": "id-da-tx", "categoria": "Cat • Sub", "centro_custo": "Nome CC"}]`;

    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    if (response.ok) {
        const data = await response.json();
        const resultadosIA = JSON.parse(data.candidates[0].content.parts[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim());

        for (const tx of stagingData) {
          const match = resultadosIA.find((r: any) => r.id === tx.id);
          await supabase.from('open_finance_staging').update({
            sugestao_ia: match && match.categoria !== "null" ? match.categoria : "Sem Categoria",
            sugestao_cc: match && match.centro_custo !== "null" ? match.centro_custo : "Pendente"
          }).eq('id', tx.id);
        }
    }
    await exibirResumo(p);
  } catch (err) { await sendMessage(chatId, "❌ Falha no processamento da IA."); }
}

// ------------------------------------------------------------------
// MOTOR 3: IA BLINDADA COM PROJEÇÃO VIRTUAL DE PARCELAS
// ------------------------------------------------------------------
async function processarEdicaoTexto(p: Pessoa, textoUsuario: string) {
    const chatId = p.chatId;
    try {
        const arvoreCategorias = await montarArvoreCategorias(p);
        const regraCartao = await obterRegraCartaoSessao(p);
        const { data: stagingData } = await supabase.from('open_finance_staging').select('*').eq('chat_id', chatId).order('data').order('id');
        if (!stagingData || stagingData.length === 0) return;

        let contextoTriagem = "";
        for (let i = 0; i < stagingData.length; i++) {
            contextoTriagem += `[Item ${i + 1}] (ID_INTERNO: ${stagingData[i].id}) -> ${stagingData[i].descricao} | R$ ${Math.abs(stagingData[i].valor).toFixed(2)} | Cat Atual: ${stagingData[i].sugestao_ia} | CC Atual: ${stagingData[i].sugestao_cc}\n`;
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;
        const prompt = `Você é um robô de banco de dados financeiro. Converta o texto do usuário em JSON.
Árvore Válida:
${arvoreCategorias}

Estado atual da triagem:
${contextoTriagem}

Pedido do usuário: "${textoUsuario}"

DIRETRIZES:
1. Ações permitidas: "EXCLUIR", "ATUALIZAR", "DIVIDIR".
2. Mapeie rigorosamente para o "ID_INTERNO".
3. Se pedir para "cancelar" ou "apagar", a ação é "EXCLUIR".
4. Se pedir para PARCELAR (ex: parcela em 5x), a ação é "ATUALIZAR" (ou "DIVIDIR" se houve rateio junto), e você deve incluir a chave "parcelas_totais" com o número de parcelas.
5. "Sem categoria" = "nova_categoria": "Sem Categoria".
6. MATEMÁTICA DA "valor_atualizado":
   - Se for cartão com REGRA: ${regraCartao}, e pedir pra parcelar, e a regra for VALOR_TOTAL, divida o valor original pelo número de parcelas.
   - Se pedir DIVISÃO percentual, aplique a porcentagem com base no valor ajustado.

FORMATO EXATO DE SAÍDA:
{
  "operacoes": [
    { "id_original": "id", "acao": "EXCLUIR" },
    { "id_original": "id", "acao": "ATUALIZAR", "nova_categoria": "...", "novo_cc": "...", "parcelas_totais": 5, "valor_atualizado": 10.50 },
    { "id_original": "id", "acao": "DIVIDIR", "fracoes": [
        { "valor_atualizado": 4.50, "nova_categoria": "...", "novo_cc": "...", "parcelas_totais": 2 }
    ] }
  ]
}`;

        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
        const data = await response.json();
        const textoResp = data.candidates[0].content.parts[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
        const instrucoes = JSON.parse(textoResp);

        let alterado = false;
        let falhas = 0;

        if (instrucoes.operacoes && instrucoes.operacoes.length > 0) {
            for (const op of instrucoes.operacoes) {
                const txOrig = stagingData.find(t => t.id === op.id_original);
                if (!txOrig) continue;

                try {
                    if (op.acao === 'EXCLUIR') {
                        const { error } = await supabase.from('open_finance_staging').delete().eq('id', txOrig.id);
                        if (!error) alterado = true; else falhas++;
                    }
                    else if (op.acao === 'ATUALIZAR') {
                        const cleanDesc = txOrig.descricao.replace(/\s*⏳ \[Parcelar em \d+x\]/g, '');
                        let finalDesc = cleanDesc;
                        if (op.parcelas_totais && op.parcelas_totais > 1) {
                            finalDesc += ` ⏳ [Parcelar em ${op.parcelas_totais}x]`;
                        }

                        const val = op.valor_atualizado || Math.abs(txOrig.valor);

                        const { error } = await supabase.from('open_finance_staging').update({
                            descricao: finalDesc,
                            valor: txOrig.valor < 0 ? -val : val,
                            sugestao_ia: op.nova_categoria || txOrig.sugestao_ia,
                            sugestao_cc: op.novo_cc || txOrig.sugestao_cc
                        }).eq('id', txOrig.id);
                        if (!error) alterado = true; else falhas++;
                    }
                    else if (op.acao === 'DIVIDIR') {
                        const fracoes = op.fracoes || [];
                        const novasLinhas = [];
                        let part = 1;
                        const cleanDesc = txOrig.descricao.replace(/\s*⏳ \[Parcelar em \d+x\]/g, '');

                        for (const f of fracoes) {
                            let finalDesc = `${cleanDesc} (Split ${part++}/${fracoes.length})`;
                            if (f.parcelas_totais && f.parcelas_totais > 1) {
                                finalDesc += ` ⏳ [Parcelar em ${f.parcelas_totais}x]`;
                            }

                            const val = f.valor_atualizado || (Math.abs(txOrig.valor) / fracoes.length);
                            const payload = { ...txOrig };
                            delete payload.id; delete payload.criado_em; delete payload.created_at;

                            payload.descricao = finalDesc;
                            payload.valor = txOrig.valor < 0 ? -val : val;
                            payload.sugestao_ia = f.nova_categoria || txOrig.sugestao_ia;
                            payload.sugestao_cc = f.novo_cc || txOrig.sugestao_cc;
                            payload.pluggy_transaction_id = `${txOrig.pluggy_transaction_id}_s${part}_${Date.now()}`;
                            novasLinhas.push(payload);
                        }

                        const { error } = await supabase.from('open_finance_staging').insert(novasLinhas);
                        if (!error) {
                            await supabase.from('open_finance_staging').delete().eq('id', txOrig.id);
                            alterado = true;
                        } else falhas++;
                    }
                } catch(e) { falhas++; }
            }
        }

        if (falhas > 0) await sendMessage(chatId, `⚠️ ${falhas} falhas no processamento. Tentativa segura preservada.`);
        else if (alterado) await sendMessage(chatId, "✅ Atualizações registradas com sucesso.");
        else await sendMessage(chatId, "⚠️ Não consegui validar a alteração. Tente novamente.");

        await exibirResumo(p);

    } catch (error) {
        console.error(error);
        await sendMessage(chatId, "❌ Falha crítica ao processar edição por texto.");
    }
}

// ------------------------------------------------------------------
// UX E GRAVAÇÃO
// ------------------------------------------------------------------
async function removeKeyboard(chatId: number, messageId: number) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageReplyMarkup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }) });
}

async function obterTextoResumo(p: Pessoa) {
  const { data: stagingData } = await supabase.from('open_finance_staging').select('*').eq('chat_id', p.chatId).order('data').order('id');
  if (!stagingData || stagingData.length === 0) return null;

  let resumo = "📋 <b>Resumo da Classificação:</b>\n<i>💡 Mande os ajustes (Ex: A 2 é CC Familiar)</i>\n\n";
  for (let i = 0; i < stagingData.length; i++) {
    const tx = stagingData[i];
    const valorDisplay = Math.abs(tx.valor).toFixed(2).replace('.', ',');
    const partesData = tx.data ? tx.data.split('-') : [];
    const dataDisplay = partesData.length === 3 ? `${partesData[2]}/${partesData[1]}` : tx.data;

    let icone = tx.conta_id ? "🏦" : "💳";
    let catDisplay = tx.sugestao_ia || "Sem Categoria";
    resumo += `[ ${i + 1} ] ${icone} <b>${tx.descricao}</b> (${dataDisplay} | R$ ${valorDisplay})\n🏷️ Cat: <b>${catDisplay}</b>\n🏢 CC: <b>${tx.sugestao_cc || "Pendente"}</b>\n\n`;
  }
  return resumo;
}

async function exibirResumo(p: Pessoa) {
  const resumo = await obterTextoResumo(p);
  if (!resumo) return;
  await sendKeyboard(p.chatId, resumo, [
    [{ text: "✅ Aprovar e Salvar Lote", callback_data: "confirm_ai" }],
    [{ text: "📝 Editar via Texto (Copiar)", callback_data: "get_edit_template" }],
    [{ text: "🗑️ Cancelar Lote", callback_data: "cancel_ai" }]
  ]);
}

async function executarTarefaGravacao(p: Pessoa, mesFaturaEscolhida: string | null) {
  const chatId = p.chatId;
  try {
    const { data: stagingData } = await supabase.from('open_finance_staging').select('*').eq('chat_id', chatId).not('sugestao_ia', 'is', null);
    if (!stagingData || stagingData.length === 0) return;

    const { data: catData } = await supabase.from('categoria_pessoal').select('id, nome').eq('familia_id', p.familiaId);
    const { data: subData } = await supabase.from('subcategoria_pessoal').select('id, nome, categoria_id').eq('familia_id', p.familiaId);
    const { data: ccData } = await supabase.from('centro_custo_projeto').select('id, nome').eq('familia_id', p.familiaId);
    const { data: cartoesVinculados } = await supabase.from('cartao_vinculado').select('id, cartao_pessoal_id').eq('familia_id', p.familiaId);

    let sucessoCount = 0;

    for (const tx of stagingData) {
      let matchCat = null;
      let matchSubId = null;

      if (tx.sugestao_ia && tx.sugestao_ia !== "Sem Categoria") {
          const nomeCatSplit = tx.sugestao_ia.split(' • ');
          const strCat = nomeCatSplit.length > 0 ? nomeCatSplit[0].trim().toLowerCase() : '';
          const strSub = nomeCatSplit.length > 1 ? nomeCatSplit[1].trim().toLowerCase() : '';

          matchCat = catData?.find(c => c.nome.toLowerCase() === strCat);
          if (matchCat && strSub) {
              const matchSub = subData?.find(s => s.categoria_id === matchCat.id && s.nome.toLowerCase() === strSub);
              if (matchSub) matchSubId = matchSub.id;
          }
      }

      const matchCC = ccData?.find(c => c.nome.toLowerCase() === tx.sugestao_cc?.toLowerCase());

      let cartaoPrincipalId = tx.cartao_principal_id || null;
      if (tx.cartao_vinculado_id) {
        const matchVinculo = cartoesVinculados?.find(v => v.id === tx.cartao_vinculado_id);
        if (matchVinculo) cartaoPrincipalId = matchVinculo.cartao_pessoal_id;
      }

      let qtdParcelas = 1;
      let descLimpa = tx.descricao;
      const matchTag = tx.descricao.match(/⏳ \[Parcelar em (\d+)x\]/);

      if (matchTag) {
          qtdParcelas = parseInt(matchTag[1], 10);
          descLimpa = tx.descricao.replace(/\s*⏳ \[Parcelar em \d+x\]/, '').trim();
      }

      const rowsInsert = [];
      for (let i = 1; i <= qtdParcelas; i++) {

          let mesFaturaFinal = mesFaturaEscolhida;
          if (tx.conta_id) mesFaturaFinal = null;
          else if (i > 1 && mesFaturaEscolhida) mesFaturaFinal = addMonthsToFatura(mesFaturaEscolhida, i - 1);

          let descFinal = descLimpa;
          if (qtdParcelas > 1) descFinal = `${descLimpa} [Parc ${i}/${qtdParcelas}]`;

          const dataObj = new Date(tx.data + 'T12:00:00Z');
          if (tx.conta_id && qtdParcelas > 1) {
              dataObj.setUTCMonth(dataObj.getUTCMonth() + (i - 1));
          } else if (tx.cartao_principal_id || tx.cartao_vinculado_id) {
              dataObj.setUTCMonth(dataObj.getUTCMonth() + (i - 1));
          }

          rowsInsert.push({
            data: dataObj.toISOString().split('T')[0],
            descricao: descFinal,
            tipo: 'DESPESA',
            valor: Math.abs(tx.valor),
            situacao: tx.conta_id && i === 1 ? 'PAGO' : 'PENDENTE',
            pluggy_transaction_id: qtdParcelas > 1 ? `${tx.pluggy_transaction_id}_p${i}` : tx.pluggy_transaction_id,
            categoria_id: matchCat ? matchCat.id : null,
            subcategoria_id: matchSubId,
            centro_custo_id: matchCC ? matchCC.id : null,
            cartao_id: cartaoPrincipalId,
            cartao_vinculado_id: tx.cartao_vinculado_id,
            conta_id: tx.conta_id,
            observacao: "Extraído via Lupa Bot",
            mes_fatura: mesFaturaFinal,
            user_id: p.userId,          // quem lançou (pessoa vinculada)
            familia_id: p.familiaId
          });
      }

      const { data: insertedData, error: insertError } = await supabase.from('transacao_pessoal').insert(rowsInsert).select();
      if (!insertError && insertedData) {
        await supabase.from('open_finance_staging').delete().eq('id', tx.id);
        sucessoCount += rowsInsert.length;
      }
    }
    if (sucessoCount > 0) await sendMessage(chatId, `🎉 <b>${sucessoCount}</b> linhas foram projetadas no sistema!`);
  } catch (err: any) { console.error(err); }
}

// ------------------------------------------------------------------
// ROTEADOR WEBHOOK
// ------------------------------------------------------------------
serve(async (req) => {
  // TRAVA 1: só aceita chamadas com a senha secreta (o Telegram manda no cabeçalho).
  // Sem a senha configurada, recusa tudo.
  if (!WEBHOOK_SECRET || req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method === 'POST') {
    try {
      const payload = await req.json();

      // TRAVA 2: só conversa privada; quem fala tem que estar vinculado.
      // Sem vínculo, o bot só aceita "/vincular 123456" e ignora o resto.
      const chatDaMensagem = payload.message?.chat ?? payload.callback_query?.message?.chat;
      if (!payload.internal_task && chatDaMensagem?.type !== 'private') return new Response("OK", { status: 200 });
      const telegramId = payload.internal_task ? payload.chatId : chatDaMensagem?.id;

      const textoVincular = (payload.message?.text ?? '').trim().match(/^\/vincular\s+(\d{6})$/i);
      if (!payload.internal_task && textoVincular) {
        await vincularTelegram(telegramId, textoVincular[1]);
        return new Response("OK", { status: 200 });
      }

      const pessoa = await obterPessoa(telegramId);
      if (!pessoa) return new Response("OK", { status: 200 });

      if (payload.internal_task === 'run_ai') { await executarTarefaIA(pessoa); return new Response("OK", { status: 200 }); }
      if (payload.internal_task === 'edit_ai') { await processarEdicaoTexto(pessoa, payload.texto); return new Response("OK", { status: 200 }); }

      if (payload.message && payload.message.photo) {
        const chatId = payload.message.chat.id;
        const photos = payload.message.photo;
        const fileId = photos[photos.length - 1].file_id;

        await sendMessage(chatId, "👀 Lendo a imagem com a lupa...");
        EdgeRuntime.waitUntil(processarImagem(pessoa, fileId));
        return new Response("OK", { status: 200 });
      }

      if (payload.message && payload.message.text) {
        const chatId = payload.message.chat.id;
        const texto = payload.message.text.trim();
        const textoLower = texto.toLowerCase();

        // 1. LIMPAR LOTE
        if (textoLower === 'limpar' || textoLower === '/limpar') {
            await supabase.from('open_finance_staging').delete().eq('chat_id', chatId);
            await sendMessage(chatId, "🗑️ Triagem limpa com sucesso!");
            return new Response("OK", { status: 200 });
        }

        // 2. PADRÕES DE LEITURA DO CARTÃO: agora ficam no cadastro do cartão, no app.
        if (textoLower === '/config' || textoLower === 'config') {
          await sendMessage(chatId, "⚙️ A leitura de parcelas agora se configura no app: Cartões → editar o cartão → \"No print/extrato, compra parcelada aparece com\".");
          return new Response("OK", { status: 200 });
        }

        // 3. MENU DIRETO
        const isMenuCommand = ['/start', 'menu', 'oi', 'olá', 'ola'].includes(textoLower);
        if (isMenuCommand) {
            await sendMainMenu(chatId);
            return new Response("OK", { status: 200 });
        }

        // 4. EDIÇÃO DE TEXTO NO LOTE
        const { count } = await supabase.from('open_finance_staging').select('*', { count: 'exact', head: true }).eq('chat_id', chatId);

        if (count && count > 0 && !texto.startsWith('/')) {
             await sendMessage(chatId, "🧠 Processando suas edições em lote...");
             EdgeRuntime.waitUntil(fetch(URL_PUBLICA, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET }, body: JSON.stringify({ internal_task: 'edit_ai', chatId: chatId, texto: texto }) }).catch(console.error));
             return new Response("OK", { status: 200 });
        } else {
             // Fallback para texto solto
             await sendMainMenu(chatId);
        }
      }

      else if (payload.callback_query) {
        const chatId = payload.callback_query.message.chat.id;
        const action = payload.callback_query.data;
        const messageId = payload.callback_query.message.message_id;

        if (action === 'start_upload') {
          await removeKeyboard(chatId, messageId);
          await sendKeyboard(chatId, "De onde saiu o dinheiro?", [
            [{ text: "🏦 Débito / Pix (Contas)", callback_data: "choose_type_conta" }],
            [{ text: "💳 Cartão de Crédito", callback_data: "choose_type_cartao" }]
          ]);
        }
        else if (action === 'choose_type_conta') {
          await removeKeyboard(chatId, messageId);
          const { data: contas } = await supabase.from('conta_financeira_pessoal').select('id, nome').eq('familia_id', pessoa.familiaId).order('nome');
          const botoes = [];
          if (contas && contas.length > 0) {
             botoes.push(...chunkArray(contas.map(c => ({ text: `🏦 ${c.nome}`, callback_data: `set_up_conta_${c.id}` })), 2));
          } else {
             botoes.push([{ text: "Voltar", callback_data: "back_to_origin" }]);
          }
          await sendKeyboard(chatId, "Selecione a Conta Bancária:", botoes);
        }
        else if (action === 'choose_type_cartao') {
          await removeKeyboard(chatId, messageId);
          const { data: cartoesP } = await supabase.from('cartao_pessoal').select('id, nome').eq('familia_id', pessoa.familiaId).order('nome');
          const botoes = [];
          if (cartoesP && cartoesP.length > 0) {
             botoes.push(...chunkArray(cartoesP.map(c => ({ text: `💳 ${c.nome}`, callback_data: `sel_main_card_${c.id}` })), 2));
          } else {
             botoes.push([{ text: "Voltar", callback_data: "back_to_origin" }]);
          }
          await sendKeyboard(chatId, "Selecione o Cartão de Crédito:", botoes);
        }
        else if (action === 'back_to_origin') {
          await removeKeyboard(chatId, messageId);
          await sendKeyboard(chatId, "De onde saiu o dinheiro?", [
            [{ text: "🏦 Débito / Pix (Contas)", callback_data: "choose_type_conta" }],
            [{ text: "💳 Cartão de Crédito", callback_data: "choose_type_cartao" }]
          ]);
        }
        else if (action.startsWith('set_up_conta_')) {
          await removeKeyboard(chatId, messageId);
          const contaId = action.replace('set_up_conta_', '');
          if (!(await daFamilia('conta_financeira_pessoal', contaId, pessoa.familiaId))) return new Response("OK", { status: 200 });
          await supabase.from('sessao_bot').upsert({ chat_id: chatId, conta_id: contaId, cartao_ativo_id: null, cartao_principal_id: null, atualizado_em: new Date().toISOString(), familia_id: pessoa.familiaId });
          await sendMessage(chatId, "🏦 Conta Bancária selecionada!\n\n📸 Pode mandar as fotos dos recibos e prints de tela.");
        }
        else if (action.startsWith('sel_main_card_')) {
          await removeKeyboard(chatId, messageId);
          const mainId = action.replace('sel_main_card_', '');
          if (!(await daFamilia('cartao_pessoal', mainId, pessoa.familiaId))) return new Response("OK", { status: 200 });
          const { data: vinculados } = await supabase.from('cartao_vinculado').select('id, nome_impresso').eq('cartao_pessoal_id', mainId).eq('familia_id', pessoa.familiaId);
          const botoes = [[{ text: "⭐ Titular", callback_data: `set_up_main_${mainId}` }]];
          if (vinculados && vinculados.length > 0) {
            botoes.push(...chunkArray(vinculados.map(c => ({ text: `🔹 ${c.nome_impresso}`, callback_data: `set_up_card_${c.id}` })), 2));
          }
          await sendKeyboard(chatId, "🔹 Quem efetuou a compra?", botoes);
        }
        else if (action.startsWith('set_up_main_')) {
          await removeKeyboard(chatId, messageId);
          const cartaoId = action.replace('set_up_main_', '');
          if (!(await daFamilia('cartao_pessoal', cartaoId, pessoa.familiaId))) return new Response("OK", { status: 200 });
          await supabase.from('sessao_bot').upsert({ chat_id: chatId, conta_id: null, cartao_ativo_id: null, cartao_principal_id: cartaoId, atualizado_em: new Date().toISOString(), familia_id: pessoa.familiaId });
          await sendMessage(chatId, "💳 Cartão Titular selecionado!\n\n📸 Pode mandar as fotos e prints da fatura.");
        }
        else if (action.startsWith('set_up_card_')) {
          await removeKeyboard(chatId, messageId);
          const vinculadoId = action.replace('set_up_card_', '');
          if (!(await daFamilia('cartao_vinculado', vinculadoId, pessoa.familiaId))) return new Response("OK", { status: 200 });
          await supabase.from('sessao_bot').upsert({ chat_id: chatId, conta_id: null, cartao_ativo_id: vinculadoId, cartao_principal_id: null, atualizado_em: new Date().toISOString(), familia_id: pessoa.familiaId });
          await sendMessage(chatId, "💳 Cartão Adicional selecionado!\n\n📸 Pode mandar as fotos e prints da fatura.");
        }
        else if (action.startsWith('config_card_')) {
          await removeKeyboard(chatId, messageId);
          const cardId = action.replace('config_card_', '');
          if (pessoa.papel !== 'admin' || !(await daFamilia('cartao_pessoal', cardId, pessoa.familiaId))) return new Response("OK", { status: 200 });
          await sendKeyboard(chatId, "Como este cartão mostra compras parceladas no extrato?", [
              [{ text: "➗ Mostra o valor de 1 Parcela", callback_data: `set_read_${cardId}_PARCELA` }],
              [{ text: "💰 Mostra o valor Total da compra", callback_data: `set_read_${cardId}_TOTAL` }]
          ]);
        }
        else if (action.startsWith('set_read_')) {
          await removeKeyboard(chatId, messageId);
          const parts = action.split('_');
          const tipo = parts.pop();
          const cardId = parts.slice(2).join('_');
          if (pessoa.papel !== 'admin' || !(await daFamilia('cartao_pessoal', cardId, pessoa.familiaId))) return new Response("OK", { status: 200 });
          await supabase.from('cartao_pessoal').update({ tipo_leitura_parcela: tipo }).eq('id', cardId).eq('familia_id', pessoa.familiaId);
          await sendMessage(chatId, `✅ Configuração salva! O padrão agora é: ${tipo}`);
        }
        else if (action === 'start_ai') {
          await removeKeyboard(chatId, messageId);
          await sendMessage(chatId, "🧠 Analisando lote completo...");
          EdgeRuntime.waitUntil(fetch(URL_PUBLICA, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET }, body: JSON.stringify({ internal_task: 'run_ai', chatId: chatId }) }).catch(console.error));
        }
        else if (action === 'get_edit_template') {
          const { data: stagingData } = await supabase.from('open_finance_staging').select('*').eq('chat_id', chatId).order('data').order('id');
          if (stagingData && stagingData.length > 0) {
            let copyBlock = "";
            for (let i = 0; i < stagingData.length; i++) {
              copyBlock += `[Item ${i + 1}] -> CC: ${stagingData[i].sugestao_cc || ""} / Cat: ${stagingData[i].sugestao_ia || ""}\n`;
            }
            await sendMessage(chatId, `👇 <b>Toque no texto abaixo para copiar:</b>\n\n<code>${copyBlock.trim()}</code>`);
          }
        }
        else if (action === 'confirm_ai') {
          await removeKeyboard(chatId, messageId);
          const { data: checkData } = await supabase.from('open_finance_staging').select('conta_id, cartao_principal_id, cartao_vinculado_id').eq('chat_id', chatId).limit(1).single();

          if (checkData && checkData.conta_id) {
             await sendMessage(chatId, `💾 Gravando despesa direto na Conta Bancária (Como Pago)...`);
             await executarTarefaGravacao(pessoa, null);
          } else {
             await sendKeyboard(chatId, "📅 Escolha a fatura de destino (Mês 1):", chunkArray([
               { text: "Jul/2026", callback_data: "save_to_Jul_2026" }, { text: "Ago/2026", callback_data: "save_to_Ago_2026" },
               { text: "Set/2026", callback_data: "save_to_Set_2026" }, { text: "Out/2026", callback_data: "save_to_Out_2026" },
               { text: "Nov/2026", callback_data: "save_to_Nov_2026" }, { text: "Dez/2026", callback_data: "save_to_Dez_2026" }
             ], 2));
          }
        }
        else if (action.startsWith('save_to_')) {
          await removeKeyboard(chatId, messageId);
          const mes = action.replace('save_to_', '').replace('_', '/');
          await sendMessage(chatId, `💾 Gravando no Cartão (a partir de ${mes})...`);
          await executarTarefaGravacao(pessoa, mes);
        }
        else if (action === 'cancel_ai') {
          await removeKeyboard(chatId, messageId);
          await supabase.from('open_finance_staging').delete().eq('chat_id', chatId);
          await sendMessage(chatId, "🗑️ Lote cancelado e triagem limpa!");
          await sendKeyboard(chatId, "De onde saiu o dinheiro?", [
            [{ text: "🏦 Débito / Pix (Contas)", callback_data: "choose_type_conta" }],
            [{ text: "💳 Cartão de Crédito", callback_data: "choose_type_cartao" }]
          ]);
        }
      }
      return new Response("OK", { status: 200 });
    } catch (error) { return new Response("Error", { status: 500 }); }
  }
  return new Response("Method not allowed", { status: 405 });
});

async function sendMessage(chatId: number, text: string) { await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }) }); }
async function sendKeyboard(chatId: number, text: string, keyboard: any[]) { await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }) }); }
