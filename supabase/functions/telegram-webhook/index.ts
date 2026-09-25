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
async function sendMainMenu(chatId: number, papel?: string) {
  // Ordem e textos pedidos pelo dono. "Milhas por Print" só para o admin.
  const botoes = [
    [{ text: "🧾 Despesas Pessoais por Print", callback_data: "start_upload" }],
    ...(papel === 'admin' ? [[{ text: "✈️ Milhas por Print", callback_data: "milhas_start" }]] : []),
    [{ text: "📊 Como Estou?", callback_data: "como_estou" }]
  ];
  await sendKeyboard(chatId, "👋 Olá, Detetive de Caixa! O que vamos fazer hoje?", botoes);
}

// ------------------------------------------------------------------
// PLACAR DAS METAS (Pacote 3): "📊 Como estou?" e aviso da categoria Ingrid.
// Mesma conta da tela Metas: só centros de custo que contam na meta,
// DESPESA soma, ESTORNO desconta; cartão pelo mês da fatura, conta pela data;
// a casa soma as categorias que têm meta no mês + "sem categoria".
// A quinzena da Ingrid é pela data da compra, com verba = metade da meta do mês.
// ------------------------------------------------------------------
// === PLACAR INICIO ===
const MESES_CURTOS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_LONGOS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const normalizarNome = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const valorGasto = (t: any) => (t.tipo === 'ESTORNO' ? -1 : t.tipo === 'DESPESA' ? 1 : 0) * Math.abs(Number(t.valor) || 0);
const reais = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
const doisDig = (n: number) => String(n).padStart(2, '0');
const chaveDoMes = (ano: number, mes: number) => `${ano}-${doisDig(mes)}-01`; // mes 1..12 (aceita 13 = jan do ano seguinte)
const chaveNormal = (ano: number, mes: number) => mes > 12 ? chaveDoMes(ano + 1, mes - 12) : chaveDoMes(ano, mes);

// "Hoje" no horário de Brasília (o servidor roda em UTC; o Brasil não tem mais horário de verão).
function hojeBrasil() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

// O Supabase devolve no máximo 1000 linhas por vez: busca em páginas.
async function buscarTudoBot(montar: () => any) {
  const todas: any[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await montar().range(i, i + 999);
    if (error) throw error;
    todas.push(...(data || []));
    if (!data || data.length < 1000) return todas;
  }
}

type Placar = {
  hoje: { ano: number; mes: number; dia: number };
  ultimoDia: number;
  primeiraQuinzena: boolean;
  temIngrid: boolean;
  metaIngridMes: number;      // 0 = sem meta neste mês
  gastoIngridMes: number;
  gastoQuinzena: number;
  gastoPrimeiraQuinzena: number;
  lancamentosIngridMes: number;
  metaCasa: number;           // 0 = sem meta neste mês
  gastoCasa: number;
  triMeses: string[];         // ex.: ['Jul','Ago','Set']
  metaTri: number;
  gastoTri: number;
  premios: Record<string, string>; // nível -> 1º desejo ainda não conquistado
};

// Junta os lançamentos já buscados e devolve os números do placar.
function montarPlacar(d: { hoje: { ano: number; mes: number; dia: number }; centros: any[]; categorias: any[]; metas: any[];
  cartao: any[]; conta: any[]; ingrid: any[]; desejos: any[] }): Placar {
  const { ano, mes, dia } = d.hoje;
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const primeiraQuinzena = dia <= 15;
  const idsNaMeta = new Set(d.centros.filter(c => c.conta_na_meta).map(c => c.id));
  const idIngrid = d.categorias.find(c => normalizarNome(c.nome) === 'ingrid')?.id;

  const triIni = Math.floor((mes - 1) / 3) * 3 + 1;
  const triChaves = [0, 1, 2].map(i => chaveDoMes(ano, triIni + i));
  const chaveAtual = chaveDoMes(ano, mes);

  // gasto por mês e categoria ('' = sem categoria)
  const porMes = new Map<string, Map<string, number>>();
  const somar = (chave: string, t: any) => {
    if (!idsNaMeta.has(t.centro_custo_id)) return;
    if (!porMes.has(chave)) porMes.set(chave, new Map());
    const m = porMes.get(chave)!;
    const k = t.categoria_id || '';
    m.set(k, (m.get(k) || 0) + valorGasto(t));
  };
  for (const t of d.cartao) {
    const [mm, aa] = String(t.mes_fatura || '').split('/');
    const idx = MESES_CURTOS.indexOf(mm);
    if (idx >= 0) somar(chaveDoMes(Number(aa), idx + 1), t);
  }
  for (const t of d.conta) somar(String(t.data).slice(0, 7) + '-01', t);

  const metasDe = (chave: string) => new Map(d.metas.filter(m => m.mes === chave).map(m => [m.categoria_id, Number(m.valor)]));
  const casaDe = (chave: string) => {
    const metas = metasDe(chave);
    const metaTotal = Array.from(metas.values()).reduce((s, v) => s + v, 0);
    const gastos = porMes.get(chave) || new Map();
    const gasto = Array.from(gastos.entries()).filter(([k]) => k === '' || metas.has(k)).reduce((s, [, v]) => s + v, 0);
    return { metaTotal, gasto, metas, gastos };
  };

  const atual = casaDe(chaveAtual);
  let metaTri = 0, gastoTri = 0;
  for (const ch of triChaves) {
    const c = casaDe(ch);
    if (c.metaTotal > 0) { metaTri += c.metaTotal; gastoTri += c.gasto; } // mês sem meta não entra no trimestre
  }

  const ingridNoMes = d.ingrid.filter(t => String(t.data).slice(0, 7) === chaveAtual.slice(0, 7));
  const diaDe = (t: any) => Number(String(t.data).slice(8, 10));
  const gastoQuinzena = ingridNoMes.filter(t => primeiraQuinzena ? diaDe(t) <= 15 : diaDe(t) >= 16).reduce((s, t) => s + valorGasto(t), 0);
  const gastoPrimeiraQuinzena = ingridNoMes.filter(t => diaDe(t) <= 15).reduce((s, t) => s + valorGasto(t), 0);

  const premios: Record<string, string> = {};
  for (const w of d.desejos) if (w.situacao === 'DESEJADO' && !premios[w.nivel]) premios[w.nivel] = w.titulo;

  return {
    hoje: d.hoje, ultimoDia, primeiraQuinzena,
    temIngrid: !!idIngrid,
    metaIngridMes: idIngrid ? (atual.metas.get(idIngrid) || 0) : 0,
    gastoIngridMes: idIngrid ? (atual.gastos.get(idIngrid) || 0) : 0,
    gastoQuinzena, gastoPrimeiraQuinzena,
    lancamentosIngridMes: ingridNoMes.length,
    metaCasa: atual.metaTotal, gastoCasa: atual.gasto,
    triMeses: triChaves.map(ch => MESES_CURTOS[Number(ch.slice(5, 7)) - 1]),
    metaTri, gastoTri, premios,
  };
}

// Busca tudo o que o placar precisa, SEMPRE filtrando pela família.
async function calcularPlacar(familiaId: string, hoje = hojeBrasil()): Promise<Placar> {
  const { ano, mes } = hoje;
  const triIni = Math.floor((mes - 1) / 3) * 3 + 1;
  const rotulos = [0, 1, 2].map(i => `${MESES_CURTOS[triIni - 1 + i]}/${ano}`);
  const cols = 'valor, tipo, centro_custo_id, categoria_id, data, mes_fatura';

  const [{ data: centros }, { data: categorias }, metas, { data: desejos }] = await Promise.all([
    supabase.from('centro_custo_projeto').select('id, conta_na_meta').eq('familia_id', familiaId),
    supabase.from('categoria_pessoal').select('id, nome').eq('familia_id', familiaId),
    buscarTudoBot(() => supabase.from('meta_categoria').select('mes, categoria_id, valor').eq('familia_id', familiaId)
      .gte('mes', chaveDoMes(ano, triIni)).lt('mes', chaveNormal(ano, triIni + 3)).order('id')),
    supabase.from('desejo').select('titulo, nivel, situacao, criado_em').eq('familia_id', familiaId).order('criado_em'),
  ]);
  const idIngrid = (categorias || []).find((c: any) => normalizarNome(c.nome) === 'ingrid')?.id;

  const [cartao, conta, ingrid] = await Promise.all([
    buscarTudoBot(() => supabase.from('transacao_pessoal').select(cols).eq('familia_id', familiaId)
      .not('cartao_id', 'is', null).in('mes_fatura', rotulos).order('id')),
    buscarTudoBot(() => supabase.from('transacao_pessoal').select(cols).eq('familia_id', familiaId)
      .is('cartao_id', null).gte('data', chaveDoMes(ano, triIni)).lt('data', chaveNormal(ano, triIni + 3)).order('id')),
    idIngrid
      ? buscarTudoBot(() => supabase.from('transacao_pessoal').select(cols).eq('familia_id', familiaId)
          .eq('categoria_id', idIngrid).gte('data', chaveDoMes(ano, mes)).lt('data', chaveNormal(ano, mes + 1)).order('id'))
      : Promise.resolve([]),
  ]);

  return montarPlacar({ hoje, centros: centros || [], categorias: categorias || [], metas: metas || [], cartao, conta, ingrid, desejos: desejos || [] });
}

// ---------- mensagens ----------
// Cada faixa tem várias frases. {livre} {acima} {dias} {porDia} {fim} {proxima} são trocados pelos números.
const FRASES: Record<'verde' | 'amarelo' | 'vermelho', string[]> = {
  verde: [
    '🌿 Tranquilo por aqui! Ainda tem {livre} livres na sua quinzena.',
    '✨ Tá indo lindo: {livre} livres e {dias} dias pela frente.',
    '💚 Folga boa: dá pra usar uns {porDia} por dia até o dia {fim} sem sair do combinado.',
    '😎 Quinzena sob controle. Sobram {livre}.',
    '🌸 Suas escolhas estão jogando a favor: {livre} livres.',
    '🎯 No alvo! {livre} ainda disponíveis nesta quinzena.',
    '🙌 Mandou bem. Ainda cabem {livre} até o dia {fim}.',
    '🧘 Zen financeiro: {livre} livres, sem pressa.',
    '🏅 Do jeito que está, o prêmio da quinzena vem. Livres: {livre}.',
    '🌞 Céu limpo na quinzena: {livre} livres.',
  ],
  amarelo: [
    '🟡 Atenção carinhosa: restam {livre} para os próximos {dias} dias (uns {porDia} por dia).',
    '⏳ Tá chegando perto: {livre} livres até o dia {fim}. Vale segurar o que puder esperar.',
    '💡 Dica: antes da próxima compra, pensa se ela pode ficar para a quinzena que vem. Livres: {livre}.',
    '🟡 Ainda dá! São {livre} livres, e dá para fechar a quinzena no verde.',
    '🧭 Hora de pilotar com cuidado: {livre} livres, {dias} dias.',
    '🍃 Tá apertando, mas está sob controle: {livre} livres.',
    '🛒 Dica: lista antes de sair ajuda a não levar extra. Ainda livres: {livre}.',
    '🎯 Reta final da quinzena: {livre} livres. O prêmio ainda está na mão!',
  ],
  vermelho: [
    '❤️ Passou {acima} da quinzena. Acontece! A próxima começa no dia {proxima}, zerada.',
    '🫶 Essa quinzena passou {acima} do combinado. Sem drama: segurar um pouco agora ajuda o mês da casa.',
    '🔴 {acima} acima da quinzena. Respira: cada compra que ficar para depois conta a favor.',
    '🌧️ Quinzena {acima} acima. O mês ainda pode fechar bem se a gente segurar junto.',
    '🤝 Passou {acima}, mas o placar do mês da casa ainda está em jogo.',
    '🌱 Essa passou {acima}. No dia {proxima} começa uma quinzena nova, e prêmio novo.',
  ],
};

function faixaDe(gasto: number, meta: number): 'verde' | 'amarelo' | 'vermelho' {
  if (gasto > meta) return 'vermelho';
  return gasto <= meta * 0.7 ? 'verde' : 'amarelo';
}
const bolinha = (f: string) => f === 'verde' ? '🟢' : f === 'amarelo' ? '🟡' : '🔴';

function barrinha(gasto: number, meta: number) {
  const pct = meta > 0 ? gasto / meta : 0;
  const cheios = Math.max(0, Math.min(10, Math.round(pct * 10)));
  return '▓'.repeat(cheios) + '░'.repeat(10 - cheios) + ` ${Math.round(pct * 100)}%`;
}

function linhaLivre(gasto: number, meta: number) {
  const livre = meta - gasto;
  return livre >= 0
    ? `${bolinha(faixaDe(gasto, meta))} <b>${reais(livre)} livres</b> de ${reais(meta)}`
    : `🔴 <b>${reais(-livre)} acima</b> de ${reais(meta)}`;
}

// Frase da quinzena. "sorteio" escolhe a frase: no aviso usamos o nº de
// lançamentos do mês, assim dois avisos seguidos nunca repetem a frase.
function fraseQuinzena(p: Placar, sorteio: number) {
  const verba = p.metaIngridMes / 2;
  const fim = p.primeiraQuinzena ? 15 : p.ultimoDia;
  const dias = fim - p.hoje.dia + 1;
  const livre = verba - p.gastoQuinzena;
  const faixa = faixaDe(p.gastoQuinzena, verba);
  const lista = FRASES[faixa];
  const proxima = p.primeiraQuinzena ? `16/${doisDig(p.hoje.mes)}` : `1º/${doisDig(p.hoje.mes === 12 ? 1 : p.hoje.mes + 1)}`;
  return lista[((sorteio % lista.length) + lista.length) % lista.length]
    .replaceAll('{livre}', reais(Math.max(livre, 0)))
    .replaceAll('{acima}', reais(Math.max(-livre, 0)))
    .replaceAll('{dias}', String(dias))
    .replaceAll('{porDia}', reais(Math.max(livre, 0) / Math.max(dias, 1)))
    .replaceAll('{fim}', String(fim))
    .replaceAll('{proxima}', proxima);
}

// Texto do botão "📊 Como estou?". souMembro = quem pergunta é a própria Ingrid.
function textoComoEstou(p: Placar, souMembro: boolean, sorteio: number) {
  const { dia, mes, ano } = p.hoje;
  const nomeMes = MESES_LONGOS[mes - 1];
  let t = `📊 <b>Como estou — ${doisDig(dia)}/${doisDig(mes)}</b>\n\n`;

  if (p.temIngrid && p.metaIngridMes > 0) {
    const verba = p.metaIngridMes / 2;
    const ini = p.primeiraQuinzena ? 1 : 16;
    const fim = p.primeiraQuinzena ? 15 : p.ultimoDia;
    const dias = fim - dia + 1;
    t += `<i>${fraseQuinzena(p, sorteio)}</i>\n\n`;
    t += `👛 <b>${souMembro ? 'Sua quinzena' : 'Quinzena da Ingrid'}</b> (${ini} a ${fim}/${doisDig(mes)})\n`;
    t += `${linhaLivre(p.gastoQuinzena, verba)}\n`;
    t += `Gasto: ${reais(p.gastoQuinzena)} · ${dias === 1 ? 'último dia' : `faltam ${dias} dias`}\n`;
    t += `<code>${barrinha(p.gastoQuinzena, verba)}</code>\n`;
    if (!p.primeiraQuinzena) {
      t += p.gastoPrimeiraQuinzena <= verba
        ? `✅ 1ª quinzena: batida (${reais(p.gastoPrimeiraQuinzena)} de ${reais(verba)})!\n`
        : `❌ 1ª quinzena: passou ${reais(p.gastoPrimeiraQuinzena - verba)}.\n`;
    }
    t += `\n👛 <b>${souMembro ? 'Sua categoria' : 'Categoria Ingrid'} em ${nomeMes}</b>\n${linhaLivre(p.gastoIngridMes, p.metaIngridMes)}\n\n`;
  } else if (p.temIngrid) {
    t += `👛 Ainda não tem meta da categoria Ingrid para ${nomeMes}.\n\n`;
  }

  if (p.metaCasa > 0) {
    t += `🏠 <b>Casa em ${nomeMes}</b>\n${linhaLivre(p.gastoCasa, p.metaCasa)}\n<code>${barrinha(p.gastoCasa, p.metaCasa)}</code>\n\n`;
  } else {
    t += `🏠 Ainda não tem meta da casa para ${nomeMes}.\n\n`;
  }

  if (p.metaTri > 0) {
    t += `🥇 <b>Trimestre ${p.triMeses.join('/')} ${ano}</b>\n${linhaLivre(p.gastoTri, p.metaTri)}\n<i>Um mês bom compensa um mês ruim.</i>\n\n`;
  }

  const premios = [['QUINZENA', '🥉 Quinzena'], ['MES', '🥈 Mês'], ['TRIMESTRE', '🥇 Trimestre']]
    .filter(([n]) => p.premios[n]).map(([n, rot]) => `${rot}: ${p.premios[n]}`);
  if (premios.length) t += `🎁 <b>Prêmios em jogo</b>\n${premios.join('\n')}\n\n`;

  t += `<i>Os números são os mesmos da tela Metas do app.</i>`;
  return t;
}

// Aviso enviado quando entra lançamento na categoria Ingrid.
function textoAviso(p: Placar, novos: { descricao: string; valor: number }[]) {
  const verba = p.metaIngridMes / 2;
  let t = '🛍️ <b>Novo lançamento na sua categoria</b>\n';
  for (const n of novos.slice(0, 5)) t += `• ${n.descricao}: ${reais(n.valor)}\n`;
  if (novos.length > 5) t += `• e mais ${novos.length - 5}\n`;
  t += `\n<i>${fraseQuinzena(p, p.lancamentosIngridMes)}</i>\n\n`;
  t += `👛 Quinzena: ${linhaLivre(p.gastoQuinzena, verba)}\n`;
  t += `👛 Mês: ${linhaLivre(p.gastoIngridMes, p.metaIngridMes)}\n`;
  if (p.metaCasa > 0) t += `🏠 Casa: ${linhaLivre(p.gastoCasa, p.metaCasa)}\n`;
  return t;
}

// Manda o aviso para quem é "membro" da família e tem Telegram conectado
// (hoje, só a Ingrid). O admin (dono) não recebe.
async function avisarCategoriaIngrid(familiaId: string, novos: { descricao: string; valor: number }[]) {
  if (novos.length === 0) return;
  const p = await calcularPlacar(familiaId);
  if (!p.temIngrid || p.metaIngridMes <= 0) return; // sem meta no mês: não tem o que comparar
  const { data: membros } = await supabase.from('familia_membro').select('user_id').eq('familia_id', familiaId).eq('papel', 'membro');
  const ids = (membros || []).map((m: any) => m.user_id);
  if (ids.length === 0) return;
  const { data: vinculos } = await supabase.from('telegram_vinculo').select('telegram_user_id')
    .eq('familia_id', familiaId).in('user_id', ids);
  const texto = textoAviso(p, novos);
  for (const v of vinculos || []) await sendMessage(v.telegram_user_id, texto);
}

async function responderComoEstou(pessoa: Pessoa) {
  const p = await calcularPlacar(pessoa.familiaId);
  await sendMessage(pessoa.chatId, textoComoEstou(p, pessoa.papel === 'membro', Math.floor(Math.random() * 1000)));
}
// === PLACAR FIM ===

// ------------------------------------------------------------------
// MILHAS POR PRINT (Pacote 4.4): "✈️ Milhas" -> escolhe a conta ->
// manda o print do extrato -> revisa -> "✅ Gravar". Só admin (igual ao app).
// Tabelas: milhas_sessao_bot (conta escolhida) e milhas_staging (revisão).
// Tudo filtrado por familia_id e por chat_id.
// ------------------------------------------------------------------
// === MILHAS INICIO ===
const MILHAS_ENTRADA = ['COMPRA', 'BONUS', 'TRANSF_ENTRADA', 'AJUSTE_MAIS'];
const NOME_TIPO_MILHAS: Record<string, string> = {
  COMPRA: 'Compra', BONUS: 'Bônus', TRANSF_ENTRADA: 'Transferência (entrou)', AJUSTE_MAIS: 'Ajuste (+)',
  TRANSF_SAIDA: 'Transferência (saiu)', USO: 'Uso/resgate', EXPIROU: 'Expirou', AJUSTE_MENOS: 'Ajuste (−)',
};
const milhasBR = (n: number) => Math.round(n).toLocaleString('pt-BR');
const dataCurta = (d: string) => d ? d.slice(0, 10).split('-').reverse().join('/') : '';

// Palavra digitada -> tipo, respeitando se o lançamento entra ou sai.
function tipoPorPalavra(palavra: string, entra: boolean): string | null {
  const w = normalizarNome(palavra);
  if (w.startsWith('compra')) return 'COMPRA';
  if (w.startsWith('bonus') || w.startsWith('acumulo') || w.startsWith('ganho')) return 'BONUS';
  if (w.startsWith('transf')) return entra ? 'TRANSF_ENTRADA' : 'TRANSF_SAIDA';
  if (w.startsWith('ajuste')) return entra ? 'AJUSTE_MAIS' : 'AJUSTE_MENOS';
  if (w.startsWith('uso') || w.startsWith('resgate') || w.startsWith('emiss')) return 'USO';
  if (w.startsWith('expir') || w.startsWith('venc')) return 'EXPIROU';
  return null;
}
function tipoDoGemini(tipo: string, pontos: number): string {
  const t = String(tipo || '').toUpperCase();
  const entra = pontos > 0;
  if (t === 'COMPRA' || t === 'BONUS' || t === 'TRANSF_ENTRADA') return entra ? t : (t === 'COMPRA' ? 'AJUSTE_MENOS' : 'TRANSF_SAIDA');
  if (t === 'TRANSF_SAIDA' || t === 'USO' || t === 'EXPIROU') return entra ? 'AJUSTE_MAIS' : t;
  return entra ? 'AJUSTE_MAIS' : 'AJUSTE_MENOS';
}
function lerValor(txt: string) {
  const t = txt.trim();
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
  if (/^\d+\.\d{1,2}$/.test(t)) return Number(t) || 0;
  return Number(t.replace(/\./g, '')) || 0;
}
function lerData(txt: string): string | null {
  const m = txt.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const ano = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

async function nomeContaMilhas(familiaId: string, contaId: string) {
  const { data: c } = await supabase.from('milhas_conta').select('titular, programa_id').eq('id', contaId).eq('familia_id', familiaId).maybeSingle();
  if (!c) return '?';
  const { data: p } = await supabase.from('milhas_programa').select('nome').eq('id', c.programa_id).eq('familia_id', familiaId).maybeSingle();
  return `${c.titular} – ${p?.nome || '?'}`;
}

async function menuMilhas(p: Pessoa) {
  const [{ data: contas }, { data: progs }] = await Promise.all([
    supabase.from('milhas_conta').select('id, titular, programa_id').eq('familia_id', p.familiaId).eq('ativo', true).order('titular'),
    supabase.from('milhas_programa').select('id, nome').eq('familia_id', p.familiaId),
  ]);
  if (!contas || contas.length === 0) {
    await sendMessage(p.chatId, "✈️ Nenhuma conta de milhas cadastrada. Cadastre no app: Milhas → Cadastros → Contas (CPFs).");
    return;
  }
  const nome = (id: string) => progs?.find((x: any) => x.id === id)?.nome || '?';
  await sendKeyboard(p.chatId, "✈️ De qual conta é o extrato?", chunkArray(contas.map((c: any) => ({ text: `${c.titular} – ${nome(c.programa_id)}`, callback_data: `mconta_${c.id}` })), 1));
}

async function escolherContaMilhas(p: Pessoa, contaId: string) {
  if (!(await daFamilia('milhas_conta', contaId, p.familiaId))) return;
  // Não mistura contas na mesma revisão.
  const { data: pendente } = await supabase.from('milhas_staging').select('conta_id').eq('chat_id', p.chatId).eq('familia_id', p.familiaId).limit(1);
  if (pendente && pendente.length > 0 && pendente[0].conta_id !== contaId) {
    await sendMessage(p.chatId, `⚠️ Ainda há uma revisão aberta de <b>${await nomeContaMilhas(p.familiaId, pendente[0].conta_id)}</b>. Grave ou cancele antes de trocar de conta.`);
    await exibirResumoMilhas(p);
    return;
  }
  await supabase.from('milhas_sessao_bot').upsert({ chat_id: p.chatId, familia_id: p.familiaId, conta_id: contaId, atualizado_em: new Date().toISOString() });
  await sendMessage(p.chatId, `✈️ Conta <b>${await nomeContaMilhas(p.familiaId, contaId)}</b> selecionada.\n\n📸 Mande o print do extrato do programa (pode mandar mais de um).`);
}

async function processarPrintMilhas(p: Pessoa, fileId: string, contaId: string) {
  const chatId = p.chatId;
  try {
    const resFile = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await resFile.json();
    if (!fileData.ok) throw new Error("Erro ao acessar imagem.");
    const resImg = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileData.result.file_path}`);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(await resImg.arrayBuffer())));

    const hoje = new Date().toLocaleDateString('pt-BR');
    const prompt = `Este é o print de um EXTRATO de programa de fidelidade (milhas ou pontos: LATAM Pass, Smiles, TudoAzul, Livelo, Esfera etc.).
Extraia CADA lançamento. Ignore saldos, totais e propagandas.
Responda em JSON puro: [{"data":"YYYY-MM-DD","descricao":"texto curto","pontos":1234,"tipo":"...","validade":"YYYY-MM-DD ou null"}]
- "pontos": positivo quando ENTRA na conta, negativo quando SAI.
- "tipo": COMPRA (compra de pontos/milhas), BONUS (acúmulo por cartão, compras, parceiros, promoções, bônus), TRANSF_ENTRADA (recebido de outro programa), TRANSF_SAIDA (enviado para outro programa), USO (resgate, emissão de passagem, troca por produto), EXPIROU (pontos vencidos), AJUSTE (qualquer outro).
- "validade": data de vencimento dos pontos, se aparecer; senão null.
Hoje é ${hoje}.`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }] }) });
    if (!response.ok) throw new Error('Google API recusou.');
    const gem = await response.json();
    const lidos = JSON.parse(gem.candidates[0].content.parts[0].text.trim().replace(/```json/g, '').replace(/```/g, '').trim());
    const validos = (Array.isArray(lidos) ? lidos : []).filter((l: any) => /^\d{4}-\d{2}-\d{2}$/.test(l.data) && Number(l.pontos));
    if (validos.length === 0) { await sendMessage(chatId, "🤔 Não encontrei lançamentos nesse print. Tente um print mais nítido do extrato."); return; }

    // Barra repetidos: já gravados na conta ou já na revisão deste chat (mesma data, quantidade e direção).
    const [gravados, revisao] = await Promise.all([
      supabase.from('milhas_movimento').select('data, quantidade, tipo').eq('familia_id', p.familiaId).eq('conta_id', contaId).gte('data', validos.map((v: any) => v.data).sort()[0]),
      supabase.from('milhas_staging').select('data, quantidade, tipo').eq('chat_id', chatId).eq('conta_id', contaId),
    ]);
    const chave = (d: string, q: number, entra: boolean) => `${d}|${q}|${entra ? '+' : '-'}`;
    const existentes = new Set([...(gravados.data || []), ...(revisao.data || [])].map((m: any) => chave(String(m.data).slice(0, 10), Number(m.quantidade), MILHAS_ENTRADA.includes(m.tipo))));
    const novos: any[] = [];
    let repetidos = 0;
    for (const l of validos) {
      const pts = Math.round(Number(l.pontos));
      const k = chave(l.data, Math.abs(pts), pts > 0);
      if (existentes.has(k)) { repetidos++; continue; }
      existentes.add(k);
      novos.push({
        familia_id: p.familiaId, chat_id: chatId, conta_id: contaId, data: l.data, descricao: String(l.descricao || '').slice(0, 120),
        tipo: tipoDoGemini(l.tipo, pts), quantidade: Math.abs(pts),
        validade: /^\d{4}-\d{2}-\d{2}$/.test(l.validade || '') && pts > 0 ? l.validade : null,
      });
    }
    if (novos.length > 0) {
      const { error } = await supabase.from('milhas_staging').insert(novos);
      if (error) throw error;
    }
    await sendMessage(chatId, `✅ Li <b>${validos.length}</b> lançamento(s)${repetidos ? ` (🛡️ ${repetidos} já estavam no app e foram ignorados)` : ''}.`);
    await exibirResumoMilhas(p);
  } catch (err) { console.error(err); await sendMessage(chatId, "❌ Falha ao ler o print de milhas."); }
}

async function exibirResumoMilhas(p: Pessoa) {
  const { data: itens } = await supabase.from('milhas_staging').select('*').eq('chat_id', p.chatId).eq('familia_id', p.familiaId).order('data').order('id');
  if (!itens || itens.length === 0) { await sendMessage(p.chatId, "Nada para revisar."); return; }
  const conta = await nomeContaMilhas(p.familiaId, itens[0].conta_id);
  let t = `✈️ <b>Revisão – ${conta}</b>\n\n`;
  itens.forEach((m: any, i: number) => {
    const entra = MILHAS_ENTRADA.includes(m.tipo);
    t += `[${i + 1}] ${dataCurta(m.data)} <b>${entra ? '+' : '−'}${milhasBR(m.quantidade)}</b> ${NOME_TIPO_MILHAS[m.tipo]}`;
    if (Number(m.custo) > 0) t += ` · R$ ${Number(m.custo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (m.validade) t += ` · vence ${dataCurta(m.validade)}`;
    if (m.descricao) t += `\n     <i>${m.descricao}</i>`;
    t += '\n';
  });
  t += `\n💡 <b>Para corrigir, escreva:</b>\n<code>apagar 2</code>\n<code>2 bonus</code> (compra, bonus, transf, uso, expirou, ajuste)\n<code>1 custo 350,00</code> (quanto pagou numa compra)\n<code>1 vence 31/12/2027</code>`;
  await sendKeyboard(p.chatId, t, [
    [{ text: "✅ Gravar no estoque", callback_data: "mgravar" }],
    [{ text: "🗑️ Cancelar", callback_data: "mcancelar" }],
  ]);
}

// Correções digitadas na revisão. Várias linhas de uma vez são aceitas.
async function editarRevisaoMilhas(p: Pessoa, texto: string) {
  const { data: itens } = await supabase.from('milhas_staging').select('*').eq('chat_id', p.chatId).eq('familia_id', p.familiaId).order('data').order('id');
  if (!itens || itens.length === 0) return;
  const erros: string[] = [];
  let feitos = 0;
  for (const linha of texto.split(/\n|;/).map(l => l.trim()).filter(Boolean)) {
    let m = linha.match(/^(?:apagar|excluir|remover)\s+(\d+)$/i);
    if (m) {
      const item = itens[Number(m[1]) - 1];
      if (!item) { erros.push(`não existe o item ${m[1]}`); continue; }
      await supabase.from('milhas_staging').delete().eq('id', item.id).eq('chat_id', p.chatId);
      feitos++; continue;
    }
    m = linha.match(/^(\d+)\s+(.+)$/);
    const item = m ? itens[Number(m[1]) - 1] : null;
    if (!m || !item) { erros.push(`não entendi "${linha}"`); continue; }
    const resto = m[2].trim();
    const entra = MILHAS_ENTRADA.includes(item.tipo);
    let mudanca: any = null;
    const mc = resto.match(/^custo\s+(?:r\$\s*)?([\d.,]+)$/i);
    const mv = resto.match(/^vence\s+(\S+)$/i);
    if (mc) mudanca = entra ? { custo: lerValor(mc[1]) } : null;
    else if (mv) mudanca = entra && lerData(mv[1]) ? { validade: lerData(mv[1]) } : null;
    else { const tipo = tipoPorPalavra(resto, entra); if (tipo) mudanca = { tipo, ...(MILHAS_ENTRADA.includes(tipo) ? {} : { custo: 0, validade: null }) }; }
    if (!mudanca) { erros.push(`não entendi "${linha}"${(mc || mv) && !entra ? ' (custo e vencimento só em entradas)' : ''}`); continue; }
    await supabase.from('milhas_staging').update(mudanca).eq('id', item.id).eq('chat_id', p.chatId);
    feitos++;
  }
  if (erros.length) await sendMessage(p.chatId, `⚠️ ${erros.join('; ')}.`);
  if (feitos) await exibirResumoMilhas(p);
}

// Grava no estoque. Saídas levam o custo médio do momento (mesma regra do app).
async function gravarMilhas(p: Pessoa) {
  const { data: itens } = await supabase.from('milhas_staging').select('*').eq('chat_id', p.chatId).eq('familia_id', p.familiaId).order('data').order('id');
  if (!itens || itens.length === 0) { await sendMessage(p.chatId, "Nada para gravar."); return; }
  const contaId = itens[0].conta_id;
  // saldo e custo atuais da conta (em páginas de 1000)
  let saldo = 0, custo = 0;
  for (let i = 0; ; i += 1000) {
    const { data: movs } = await supabase.from('milhas_movimento').select('tipo, quantidade, custo').eq('familia_id', p.familiaId).eq('conta_id', contaId).order('id').range(i, i + 999);
    for (const m of movs || []) {
      const s = MILHAS_ENTRADA.includes(m.tipo) ? 1 : -1;
      saldo += s * Number(m.quantidade); custo += s * Number(m.custo);
    }
    if (!movs || movs.length < 1000) break;
  }
  const linhas = itens.map((m: any) => {
    const entra = MILHAS_ENTRADA.includes(m.tipo);
    const q = Number(m.quantidade);
    const c = entra ? Number(m.custo) || 0 : (saldo > 0 ? Math.round((custo / saldo) * q * 100) / 100 : 0);
    saldo += entra ? q : -q; custo += entra ? c : -c;
    return {
      familia_id: p.familiaId, conta_id: m.conta_id, tipo: m.tipo, quantidade: q, custo: Math.max(c, 0), data: m.data,
      validade: entra ? m.validade : null, forma_pagamento: m.tipo === 'COMPRA' ? 'A_VISTA' : null,
      observacao: m.descricao ? `Print: ${m.descricao}` : 'Lançado pelo print', criado_por: p.userId,
    };
  });
  const { error } = await supabase.from('milhas_movimento').insert(linhas);
  if (error) { console.error(error); await sendMessage(p.chatId, "❌ Não consegui gravar. Nada foi alterado; tente de novo."); return; }
  await supabase.from('milhas_staging').delete().eq('chat_id', p.chatId).eq('familia_id', p.familiaId);
  const aviso = linhas.some((l: any) => l.tipo === 'USO') ? '\nℹ️ Usos pelo print entram sem passageiros: para o limite de CPF, lance as emissões pelo app.' : '';
  await sendMessage(p.chatId, `🎉 <b>${linhas.length}</b> lançamento(s) gravado(s) em <b>${await nomeContaMilhas(p.familiaId, contaId)}</b>.\nSaldo agora: <b>${milhasBR(saldo)}</b> milhas.${aviso}`);
}
// === MILHAS FIM ===

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
    const idCatIngrid = catData?.find(c => normalizarNome(c.nome) === 'ingrid')?.id;
    const novosIngrid: { descricao: string; valor: number }[] = [];

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
        // parcelado: avisa a compra uma vez, com o valor da 1ª parcela
        if (idCatIngrid && matchCat?.id === idCatIngrid) novosIngrid.push({ descricao: descLimpa, valor: rowsInsert[0].valor });
      }
    }
    if (sucessoCount > 0) await sendMessage(chatId, `🎉 <b>${sucessoCount}</b> linhas foram projetadas no sistema!`);
    // Aviso para a Ingrid (se entrou algo na categoria dela). Erro aqui não atrapalha a gravação.
    try { await avisarCategoriaIngrid(p.familiaId, novosIngrid); } catch (e) { console.error('aviso Ingrid', e); }
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

        const { data: sessaoMilhas } = await supabase.from('milhas_sessao_bot').select('conta_id').eq('chat_id', chatId).eq('familia_id', pessoa.familiaId).maybeSingle();
        if (sessaoMilhas && pessoa.papel === 'admin') {
          await sendMessage(chatId, "✈️ Lendo o extrato de milhas...");
          EdgeRuntime.waitUntil(processarPrintMilhas(pessoa, fileId, sessaoMilhas.conta_id));
          return new Response("OK", { status: 200 });
        }
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

        // 3. PLACAR DAS METAS
        if (['/status', 'status', 'como estou', 'como estou?', '/comoestou'].includes(textoLower)) {
          await responderComoEstou(pessoa);
          return new Response("OK", { status: 200 });
        }

        // 4. MENU DIRETO
        const isMenuCommand = ['/start', 'menu', 'oi', 'olá', 'ola'].includes(textoLower);
        if (isMenuCommand) {
            await sendMainMenu(chatId, pessoa.papel);
            return new Response("OK", { status: 200 });
        }

        // 5. CORREÇÕES NA REVISÃO DE MILHAS
        if (!texto.startsWith('/') && pessoa.papel === 'admin') {
          const { count: qtdMilhas } = await supabase.from('milhas_staging').select('*', { count: 'exact', head: true }).eq('chat_id', chatId).eq('familia_id', pessoa.familiaId);
          if (qtdMilhas && qtdMilhas > 0) {
            await editarRevisaoMilhas(pessoa, texto);
            return new Response("OK", { status: 200 });
          }
        }

        // 6. EDIÇÃO DE TEXTO NO LOTE
        const { count } = await supabase.from('open_finance_staging').select('*', { count: 'exact', head: true }).eq('chat_id', chatId);

        if (count && count > 0 && !texto.startsWith('/')) {
             await sendMessage(chatId, "🧠 Processando suas edições em lote...");
             EdgeRuntime.waitUntil(fetch(URL_PUBLICA, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}`, 'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET }, body: JSON.stringify({ internal_task: 'edit_ai', chatId: chatId, texto: texto }) }).catch(console.error));
             return new Response("OK", { status: 200 });
        } else {
             // Fallback para texto solto
             await sendMainMenu(chatId, pessoa.papel);
        }
      }

      else if (payload.callback_query) {
        const chatId = payload.callback_query.message.chat.id;
        const action = payload.callback_query.data;
        const messageId = payload.callback_query.message.message_id;

        if (action === 'como_estou') {
          await responderComoEstou(pessoa);
        }
        else if (['milhas_start', 'mgravar', 'mcancelar'].includes(action) || action.startsWith('mconta_')) {
          if (pessoa.papel !== 'admin') return new Response("OK", { status: 200 });
          await removeKeyboard(chatId, messageId);
          if (action === 'milhas_start') await menuMilhas(pessoa);
          else if (action.startsWith('mconta_')) await escolherContaMilhas(pessoa, action.replace('mconta_', ''));
          else if (action === 'mgravar') await gravarMilhas(pessoa);
          else {
            await supabase.from('milhas_staging').delete().eq('chat_id', chatId).eq('familia_id', pessoa.familiaId);
            await supabase.from('milhas_sessao_bot').delete().eq('chat_id', chatId);
            await sendMessage(chatId, "🗑️ Revisão de milhas cancelada.");
          }
        }
        else if (action === 'start_upload') {
          await removeKeyboard(chatId, messageId);
          await supabase.from('milhas_sessao_bot').delete().eq('chat_id', chatId);
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
