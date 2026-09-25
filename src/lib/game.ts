// ------------------------------------------------------------------
// Contas do jogo (mesmas regras da tela Metas e do "📊 Como Estou?" do bot):
// - 🥉 Quinzena: categoria Ingrid dentro de metade da verba do mês, contando
//   as compras pela DATA (1–15 e 16–fim).
// - 🥈 Mês: gasto da casa dentro da meta do mês. Casa = centros que "contam
//   na meta", só categorias com meta no mês + "Sem categoria". Cartão conta
//   no mês da fatura; conta bancária, no mês da data.
// - 🥇 Trimestre: soma dos meses (com meta) do trimestre dentro da soma das
//   metas; um mês compensa o outro.
// - PAGAMENTO_FATURA e RECEITA nunca contam como gasto.
// Só vale para meses que têm meta cadastrada.
// ------------------------------------------------------------------

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export type TxJogo = { valor: number; tipo: string; centro_custo_id: string | null; categoria_id: string | null; data: string; mes_fatura: string | null; cartao_id: string | null };
export type MetaJogo = { mes: string; categoria_id: string; valor: number };
export type Resultado = 'GANHOU' | 'PERDEU' | 'EM_JOGO';

export type Quinzena = { mes: string; n: 1 | 2; verba: number; gasto: number; resultado: Resultado };
export type MesJogo = { mes: string; meta: number; gasto: number; verbaIngrid: number; gastoIngrid: number; resultado: Resultado; quinzenas: Quinzena[] };
export type Trimestre = { chave: string; nome: string; meses: string[]; meta: number; gasto: number; resultado: Resultado };

export const normalizarTexto = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
export const valorGasto = (t: Pick<TxJogo, 'tipo' | 'valor'>) => (t.tipo === 'ESTORNO' ? -1 : t.tipo === 'DESPESA' ? 1 : 0) * Math.abs(Number(t.valor) || 0);
/** "2026-10-01" -> "Out/2026" (formato do mes_fatura) */
export const rotuloFatura = (mes: string) => `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`;
/** "Out/2026" -> "2026-10-01" */
export function mesDaFatura(rotulo: string | null) {
  const [m, a] = String(rotulo || '').split('/');
  const i = MESES_CURTOS.indexOf(m);
  return i >= 0 && a ? `${a}-${String(i + 1).padStart(2, '0')}-01` : null;
}
const chaveTri = (mes: string) => `${mes.slice(0, 4)}-T${Math.floor((Number(mes.slice(5, 7)) - 1) / 3) + 1}`;

// Sequência atual (do fim para trás) e recorde de vitórias seguidas, só com resultados já fechados.
export function sequencias(resultados: Resultado[]) {
  const fechados = resultados.filter(r => r !== 'EM_JOGO');
  let recorde = 0, corrida = 0;
  for (const r of fechados) { corrida = r === 'GANHOU' ? corrida + 1 : 0; recorde = Math.max(recorde, corrida); }
  return { atual: corrida, recorde };
}

export function calcularJogo(d: {
  hoje: string; // AAAA-MM-DD
  centros: { id: string; conta_na_meta: boolean | null }[];
  categorias: { id: string; nome: string }[];
  metas: MetaJogo[];
  transacoes: TxJogo[]; // cartão pelo mês da fatura + conta pela data, dos meses do jogo
  ingrid: TxJogo[];     // categoria Ingrid pela data da compra, dos meses do jogo
}) {
  const mesAtual = d.hoje.slice(0, 7) + '-01';
  const dia = Number(d.hoje.slice(8, 10));
  const idsNaMeta = new Set(d.centros.filter(c => c.conta_na_meta).map(c => c.id));
  const idIngrid = d.categorias.find(c => normalizarTexto(c.nome) === 'ingrid')?.id;

  // gasto por mês e categoria ('' = sem categoria)
  const porMes = new Map<string, Map<string, number>>();
  for (const t of d.transacoes) {
    if (!t.centro_custo_id || !idsNaMeta.has(t.centro_custo_id)) continue;
    const chave = t.cartao_id ? mesDaFatura(t.mes_fatura) : String(t.data).slice(0, 7) + '-01';
    if (!chave) continue;
    if (!porMes.has(chave)) porMes.set(chave, new Map());
    const m = porMes.get(chave)!;
    const k = t.categoria_id || '';
    m.set(k, (m.get(k) || 0) + valorGasto(t));
  }
  // Ingrid por data de compra (para as quinzenas)
  const ingrid = idIngrid ? d.ingrid.filter(t => t.categoria_id === idIngrid) : [];

  const mesesComMeta = Array.from(new Set(d.metas.map(m => m.mes))).filter(m => m <= mesAtual).sort();
  const meses: MesJogo[] = mesesComMeta.map(mes => {
    const metas = new Map(d.metas.filter(m => m.mes === mes).map(m => [m.categoria_id, Number(m.valor)]));
    const meta = Array.from(metas.values()).reduce((s, v) => s + v, 0);
    const gastos = porMes.get(mes) || new Map<string, number>();
    const gasto = Array.from(gastos.entries()).filter(([k]) => k === '' || metas.has(k)).reduce((s, [, v]) => s + v, 0);
    const passado = mes < mesAtual;
    const verbaIngrid = idIngrid ? metas.get(idIngrid) || 0 : 0;
    const doMes = ingrid.filter(t => String(t.data).slice(0, 7) === mes.slice(0, 7));
    const q = (n: 1 | 2): Quinzena => {
      const gastoQ = doMes.filter(t => (n === 1 ? Number(t.data.slice(8, 10)) <= 15 : Number(t.data.slice(8, 10)) >= 16)).reduce((s, t) => s + valorGasto(t), 0);
      const fechada = passado || (n === 1 && dia > 15);
      return { mes, n, verba: verbaIngrid / 2, gasto: gastoQ, resultado: !fechada ? 'EM_JOGO' : gastoQ <= verbaIngrid / 2 + 0.005 ? 'GANHOU' : 'PERDEU' };
    };
    return {
      mes, meta, gasto, verbaIngrid, gastoIngrid: idIngrid ? gastos.get(idIngrid) || 0 : 0,
      resultado: !passado ? 'EM_JOGO' : gasto <= meta + 0.005 ? 'GANHOU' : 'PERDEU',
      quinzenas: verbaIngrid > 0 ? [q(1), q(2)] : [],
    };
  });

  // Trimestres: soma dos meses com meta; fecha quando os 3 meses do calendário passaram.
  const grupos = new Map<string, MesJogo[]>();
  for (const m of meses) { const k = chaveTri(m.mes); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k)!.push(m); }
  const trimestres: Trimestre[] = Array.from(grupos.entries()).map(([chave, ms]) => {
    const ano = Number(chave.slice(0, 4)), t = Number(chave.slice(6));
    const ultimoMes = `${ano}-${String(t * 3).padStart(2, '0')}-01`;
    const meta = ms.reduce((s, m) => s + m.meta, 0), gasto = ms.reduce((s, m) => s + m.gasto, 0);
    const nomes = [0, 1, 2].map(i => MESES_CURTOS[(t - 1) * 3 + i]);
    return { chave, nome: `${nomes.join('/')} ${ano}`, meses: ms.map(m => m.mes), meta, gasto, resultado: ultimoMes >= mesAtual ? 'EM_JOGO' : gasto <= meta + 0.005 ? 'GANHOU' : 'PERDEU' };
  });

  const quinzenas = meses.flatMap(m => m.quinzenas);
  return {
    temIngrid: !!idIngrid, meses, trimestres, quinzenas,
    atual: meses.find(m => m.mes === mesAtual),
    triAtual: trimestres.find(t => t.chave === chaveTri(mesAtual)),
    seqQuinzenas: sequencias(quinzenas.map(q => q.resultado)),
    seqMeses: sequencias(meses.map(m => m.resultado)),
  };
}
