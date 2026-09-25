import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Flame, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MESES_CURTOS, MetaJogo } from '@/lib/game';
import { useJogo } from './PainelGame';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

function Mini({ rotulo, meta, gasto, detalhe }: { rotulo: string; meta: number; gasto: number; detalhe: string }) {
  const livre = meta - gasto;
  const pct = meta > 0 ? (gasto / meta) * 100 : 0;
  const cor = pct <= 70 ? 'bg-emerald-500' : pct <= 100 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[11px] text-zinc-400 truncate">{rotulo}</p>
      <p className={cn('text-base md:text-lg font-bold', livre >= 0 ? 'text-emerald-400' : 'text-red-400')}>{livre >= 0 ? `${brl(livre)} livres` : `${brl(-livre)} acima`}</p>
      <div className="h-1.5 bg-black/40 rounded-full overflow-hidden"><div className={cn('h-full rounded-full', cor)} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
      <p className="text-[10px] text-zinc-500 truncate">{detalhe}</p>
    </div>
  );
}

/** Resumo do jogo (quinzena, casa no mês, trimestre e sequência) para o topo do Dashboard. */
export default function CardGame() {
  const { data: centros = [] } = useQuery({
    queryKey: ['game_centros'],
    queryFn: async () => { const { data, error } = await supabase.from('centro_custo_projeto').select('id, conta_na_meta'); if (error) throw error; return data || []; },
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ['game_categorias'],
    queryFn: async () => { const { data, error } = await supabase.from('categoria_pessoal').select('id, nome'); if (error) throw error; return data || []; },
  });
  const { data: metas = [] } = useQuery({
    queryKey: ['game_metas'],
    queryFn: async () => {
      const todas: MetaJogo[] = [];
      for (let i = 0; ; i += 1000) {
        const { data, error } = await supabase.from('meta_categoria').select('mes, categoria_id, valor').order('id').range(i, i + 999);
        if (error) throw error;
        todas.push(...((data || []) as MetaJogo[]));
        if (!data || data.length < 1000) return todas;
      }
    },
  });
  const { jogo, temJogo, hoje } = useJogo(centros, categorias, metas);
  if (!temJogo || !jogo?.atual) return null; // sem metas no mês: o card não aparece

  const dia = Number(hoje.slice(8, 10));
  const primeiraQ = dia <= 15;
  const q = jogo.atual.quinzenas[primeiraQ ? 0 : 1];
  const mes = MESES_CURTOS[Number(jogo.atual.mes.slice(5, 7)) - 1];
  return (
    <Link to="/financas/metas" className="block bg-[#1e1e24] border border-white/5 hover:border-amber-500/30 rounded-2xl p-3 md:p-5 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-sm font-bold flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /> Game</p>
        <span className="text-[11px] text-zinc-400 flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-orange-400" /> {jogo.seqQuinzenas.atual} quinzena(s) seguida(s) <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5">
        {q && <Mini rotulo={`🥉 ${primeiraQ ? '1ª' : '2ª'} quinzena (Ingrid)`} meta={q.verba} gasto={q.gasto} detalhe={`verba ${brl(q.verba)}`} />}
        <Mini rotulo={`🥈 Casa em ${mes}`} meta={jogo.atual.meta} gasto={jogo.atual.gasto} detalhe={`meta ${brl(jogo.atual.meta)}`} />
        {jogo.triAtual && <Mini rotulo={`🥇 Trimestre ${jogo.triAtual.nome}`} meta={jogo.triAtual.meta} gasto={jogo.triAtual.gasto} detalhe={`soma das metas ${brl(jogo.triAtual.meta)}`} />}
      </div>
    </Link>
  );
}
