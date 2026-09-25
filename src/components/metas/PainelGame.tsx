import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Flame, Gift, ChevronDown } from 'lucide-react';
import { cn, hojeLocal } from '@/lib/utils';
import { calcularJogo, rotuloFatura, normalizarTexto, MESES_CURTOS, Resultado, MetaJogo, TxJogo } from '@/lib/game';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const nomeMes = (mes: string) => `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const COLS = 'valor, tipo, centro_custo_id, categoria_id, data, mes_fatura, cartao_id';

type Pagina = PromiseLike<{ data: TxJogo[] | null; error: unknown }>;
type Consulta = { range: (a: number, z: number) => Pagina };
type Desejo = { titulo: string; nivel: string; situacao: string };

async function buscarTudo(montar: () => Consulta) {
  const todas: TxJogo[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await montar().range(i, i + 999);
    if (error) throw error;
    todas.push(...(data || []));
    if (!data || data.length < 1000) return todas;
  }
}
const somaMes = (mes: string, n: number) => { const [a, m] = mes.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return d.toISOString().slice(0, 10); };

function Selo({ r }: { r: Resultado }) {
  if (r === 'GANHOU') return <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 rounded px-1.5 py-0.5">🏆 ganhou</span>;
  if (r === 'PERDEU') return <span className="text-[10px] font-bold text-red-300 bg-red-500/10 rounded px-1.5 py-0.5">não foi</span>;
  return <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 rounded px-1.5 py-0.5">em jogo</span>;
}

// Barra de "quanto já usou" com as mesmas faixas do bot: 🟢 até 70%, 🟡 até 100%, 🔴 acima.
function Uso({ gasto, meta }: { gasto: number; meta: number }) {
  const pct = meta > 0 ? (gasto / meta) * 100 : 0;
  const cor = pct <= 70 ? 'bg-emerald-500' : pct <= 100 ? 'bg-amber-500' : 'bg-red-500';
  return <div className="h-2 bg-black/40 rounded-full overflow-hidden"><div className={cn('h-full rounded-full', cor)} style={{ width: `${Math.min(pct, 100)}%` }} /></div>;
}

function Placar({ nivel, titulo, livre, gasto, meta, detalhe, premio }: { nivel: string; titulo: string; livre: number; gasto: number; meta: number; detalhe: string; premio?: string }) {
  return (
    <div className="bg-[#141417] border border-white/5 rounded-xl p-4 space-y-2 min-w-0">
      <p className="text-xs text-zinc-400 font-medium">{nivel} {titulo}</p>
      <p className={cn('text-xl font-bold', livre >= 0 ? 'text-emerald-400' : 'text-red-400')}>{livre >= 0 ? `${brl(livre)} livres` : `${brl(-livre)} acima`}</p>
      <Uso gasto={gasto} meta={meta} />
      <p className="text-[11px] text-zinc-500">{detalhe}</p>
      {premio && <p className="text-[11px] text-pink-300 flex items-center gap-1 truncate"><Gift className="w-3.5 h-3.5 shrink-0" /> em jogo: {premio}</p>}
    </div>
  );
}

type Centro = { id: string; conta_na_meta: boolean | null };
type Categoria = { id: string; nome: string };

/** Busca os lançamentos dos meses do jogo e calcula o placar (usado aqui e no card do Dashboard). */
export function useJogo(centros: Centro[], categorias: Categoria[], metas: MetaJogo[]) {
  const hoje = hojeLocal();
  const mesAtual = hoje.slice(0, 7) + '-01';
  const idIngrid = useMemo(() => categorias.find(c => normalizarTexto(c.nome) === 'ingrid')?.id, [categorias]);
  // meses do jogo: do 1º mês com meta até o mês atual
  const primeiro = useMemo(() => metas.map(m => m.mes).filter(m => m <= mesAtual).sort()[0], [metas, mesAtual]);

  const { data: tx, isLoading } = useQuery({
    queryKey: ['game_transacoes', primeiro, mesAtual, idIngrid],
    enabled: !!primeiro,
    queryFn: async () => {
      const rotulos: string[] = [];
      for (let m = primeiro!; m <= mesAtual; m = somaMes(m, 1)) rotulos.push(rotuloFatura(m));
      const fim = somaMes(mesAtual, 1);
      const [cartao, conta, ingrid]: TxJogo[][] = await Promise.all([
        buscarTudo(() => supabase.from('transacao_pessoal').select(COLS).not('cartao_id', 'is', null).in('mes_fatura', rotulos).order('id')),
        buscarTudo(() => supabase.from('transacao_pessoal').select(COLS).is('cartao_id', null).gte('data', primeiro!).lt('data', fim).order('id')),
        idIngrid ? buscarTudo(() => supabase.from('transacao_pessoal').select(COLS).eq('categoria_id', idIngrid).gte('data', primeiro!).lt('data', fim).order('id')) : Promise.resolve([]),
      ]);
      return { transacoes: [...cartao, ...conta], ingrid };
    },
  });

  const jogo = useMemo(() => tx ? calcularJogo({ hoje, centros, categorias, metas, transacoes: tx.transacoes, ingrid: tx.ingrid }) : null, [tx, hoje, centros, categorias, metas]);
  return { jogo, isLoading, temJogo: !!primeiro, hoje, mesAtual };
}

export default function PainelGame({ centros, categorias, metas, desejos }: { centros: Centro[]; categorias: Categoria[]; metas: MetaJogo[]; desejos: Desejo[] }) {
  const { jogo, isLoading, temJogo, hoje, mesAtual } = useJogo(centros, categorias, metas);
  const dia = Number(hoje.slice(8, 10));
  const [verTudo, setVerTudo] = useState(false);
  const premioEmJogo = (nivel: string) => desejos.find(d => d.nivel === nivel && d.situacao === 'DESEJADO')?.titulo;
  const aEntregar = desejos.filter(d => d.situacao === 'CONQUISTADO');
  const entregues = desejos.filter(d => d.situacao === 'ENTREGUE');

  if (!temJogo) return (
    <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 text-sm text-zinc-400">
      <p className="font-bold text-white flex items-center gap-2 mb-1"><Trophy className="w-5 h-5 text-amber-400" /> Game</p>
      O jogo começa no primeiro mês com metas cadastradas. Cadastre as metas do mês abaixo.
    </div>
  );
  if (isLoading || !jogo) return <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 text-sm text-zinc-400">Carregando o placar...</div>;

  const { atual, triAtual } = jogo;
  const primeiraQ = dia <= 15;
  const ultimoDia = new Date(Number(hoje.slice(0, 4)), Number(hoje.slice(5, 7)), 0).getDate();
  const qAtual = atual?.quinzenas[primeiraQ ? 0 : 1];
  const diasQ = (primeiraQ ? 15 : ultimoDia) - dia + 1;
  const ganhos = (l: { resultado: Resultado }[]) => l.filter(x => x.resultado === 'GANHOU').length;
  const fechados = (l: { resultado: Resultado }[]) => l.filter(x => x.resultado !== 'EM_JOGO').length;
  const mesesHist = [...jogo.meses].reverse();

  return (
    <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-4 md:p-6 space-y-5">
      <h2 className="font-bold flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-400" /> Game</h2>

      {/* Placar de agora */}
      {atual ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {qAtual && <Placar nivel="🥉" titulo={`${primeiraQ ? '1ª' : '2ª'} quinzena (Ingrid)`} livre={qAtual.verba - qAtual.gasto} gasto={qAtual.gasto} meta={qAtual.verba}
            detalhe={`${diasQ} dia(s) até o dia ${primeiraQ ? 15 : ultimoDia} · verba ${brl(qAtual.verba)}`} premio={premioEmJogo('QUINZENA')} />}
          <Placar nivel="🥈" titulo={`Casa em ${nomeMes(atual.mes)}`} livre={atual.meta - atual.gasto} gasto={atual.gasto} meta={atual.meta}
            detalhe={`meta ${brl(atual.meta)}${atual.verbaIngrid ? ` · Ingrid ${brl(atual.gastoIngrid)} de ${brl(atual.verbaIngrid)}` : ''}`} premio={premioEmJogo('MES')} />
          {triAtual && <Placar nivel="🥇" titulo={`Trimestre ${triAtual.nome}`} livre={triAtual.meta - triAtual.gasto} gasto={triAtual.gasto} meta={triAtual.meta}
            detalhe={`soma das metas ${brl(triAtual.meta)} · um mês compensa o outro`} premio={premioEmJogo('TRIMESTRE')} />}
        </div>
      ) : <p className="text-sm text-zinc-400">{nomeMes(mesAtual)} ainda não tem metas: o placar do mês aparece quando elas forem cadastradas.</p>}

      {/* Conquistas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#141417] border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-zinc-400 flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-orange-400" /> Sequência de quinzenas</p>
          <p className="text-xl font-bold text-orange-300">{jogo.seqQuinzenas.atual}</p>
          <p className="text-[10px] text-zinc-500">recorde {jogo.seqQuinzenas.recorde}</p>
        </div>
        <div className="bg-[#141417] border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-zinc-400">🥉 Quinzenas ganhas</p>
          <p className="text-xl font-bold">{ganhos(jogo.quinzenas)} <span className="text-xs text-zinc-500 font-medium">de {fechados(jogo.quinzenas)}</span></p>
        </div>
        <div className="bg-[#141417] border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-zinc-400">🥈 Meses · 🥇 Trimestres</p>
          <p className="text-xl font-bold">{ganhos(jogo.meses)}<span className="text-xs text-zinc-500 font-medium">/{fechados(jogo.meses)}</span> · {ganhos(jogo.trimestres)}<span className="text-xs text-zinc-500 font-medium">/{fechados(jogo.trimestres)}</span></p>
          <p className="text-[10px] text-zinc-500">sequência de meses {jogo.seqMeses.atual} · recorde {jogo.seqMeses.recorde}</p>
        </div>
        <div className="bg-[#141417] border border-white/5 rounded-xl p-3">
          <p className="text-[11px] text-zinc-400 flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-pink-400" /> Prêmios</p>
          <p className="text-xl font-bold">{aEntregar.length} <span className="text-xs text-zinc-500 font-medium">a entregar</span></p>
          <p className="text-[10px] text-zinc-500">{entregues.length} já entregue(s)</p>
        </div>
      </div>
      {aEntregar.length > 0 && <p className="text-xs text-pink-300">🎁 A entregar: {aEntregar.map(d => d.titulo).join(' · ')}</p>}

      {/* Histórico */}
      <div>
        <p className="text-sm font-bold mb-2">Histórico</p>
        <div className="divide-y divide-white/5">
          {jogo.trimestres.filter(t => t.resultado !== 'EM_JOGO').reverse().map(t => (
            <div key={t.chave} className="py-2 flex items-center justify-between gap-2 text-sm">
              <span>🥇 Trimestre {t.nome} <span className="text-[11px] text-zinc-500">· {brl(t.gasto)} de {brl(t.meta)}</span></span>
              <Selo r={t.resultado} />
            </div>
          ))}
          {(verTudo ? mesesHist : mesesHist.slice(0, 3)).map(m => (
            <div key={m.mes} className="py-2 space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>🥈 {nomeMes(m.mes)} <span className="text-[11px] text-zinc-500">· casa {brl(m.gasto)} de {brl(m.meta)}</span></span>
                <Selo r={m.resultado} />
              </div>
              {m.quinzenas.map(q => (
                <div key={q.n} className="flex items-center justify-between gap-2 text-xs pl-5 text-zinc-400">
                  <span>🥉 {q.n}ª quinzena <span className="text-zinc-500">· Ingrid {brl(q.gasto)} de {brl(q.verba)}</span></span>
                  <Selo r={q.resultado} />
                </div>
              ))}
            </div>
          ))}
        </div>
        {mesesHist.length > 3 && (
          <button onClick={() => setVerTudo(v => !v)} className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', verTudo && 'rotate-180')} /> {verTudo ? 'mostrar menos' : `ver todos os ${mesesHist.length} meses`}
          </button>
        )}
      </div>
    </div>
  );
}
