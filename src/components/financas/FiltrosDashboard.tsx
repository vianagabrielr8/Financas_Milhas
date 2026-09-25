import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Layers, Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const somar = (chave: string, n: number) => {
  const [a, m] = chave.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const botao = 'h-10 flex items-center gap-2 rounded-lg bg-[#1a1a20] border border-white/10 hover:border-white/20 text-sm text-white transition-colors';

/** Mês: setas para voltar/avançar e, no meio, uma grade com os 12 meses do ano. */
export function SeletorMes({ valor, onChange, hoje }: { valor: string; onChange: (v: string) => void; hoje: string }) {
  const [aberto, setAberto] = useState(false);
  const [ano, setAno] = useState(Number(valor.slice(0, 4)));
  const [a, m] = valor.split('-').map(Number);
  return (
    <div className={cn(botao, 'gap-0 px-1')}>
      <button onClick={() => onChange(somar(valor, -1))} className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/5" title="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
      <Popover open={aberto} onOpenChange={(v) => { setAberto(v); if (v) setAno(a); }}>
        <PopoverTrigger asChild>
          <button className="h-8 px-2 flex-1 flex items-center justify-center gap-2 rounded-md hover:bg-white/5 font-semibold whitespace-nowrap min-w-[140px]">
            <CalendarDays className="w-4 h-4 text-emerald-400" /> {MESES_LONGOS[m - 1]} {a}
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-64 bg-[#1a1a20] border-white/10 p-3 text-white">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setAno(ano - 1)} className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/5"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-bold text-sm">{ano}</span>
            <button onClick={() => setAno(ano + 1)} className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/5"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {MESES.map((nome, i) => {
              const chave = `${ano}-${String(i + 1).padStart(2, '0')}`;
              return (
                <button key={nome} onClick={() => { onChange(chave); setAberto(false); }}
                  className={cn('h-9 rounded-md text-xs font-semibold transition-colors',
                    chave === valor ? 'bg-emerald-500 text-black' : chave === hoje ? 'border border-emerald-500/50 text-emerald-300 hover:bg-white/5' : 'text-zinc-300 hover:bg-white/5')}>
                  {nome}
                </button>
              );
            })}
          </div>
          {valor !== hoje && <button onClick={() => { onChange(hoje); setAberto(false); }} className="w-full mt-2 h-8 rounded-md text-xs text-emerald-300 hover:bg-white/5">Voltar para o mês atual</button>}
        </PopoverContent>
      </Popover>
      <button onClick={() => onChange(somar(valor, 1))} className="h-8 w-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/5" title="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
    </div>
  );
}

/** Centros de custo: marca um ou vários. Lista vazia = todos. */
export function SeletorCentros({ centros, valor, onChange }: { centros: string[]; valor: string[]; onChange: (v: string[]) => void }) {
  const todos = valor.length === 0;
  const rotulo = todos ? 'Todos os centros' : valor.length === 1 ? valor[0] : `${valor.length} centros`;
  const alternar = (nome: string) => {
    const novo = valor.includes(nome) ? valor.filter((x) => x !== nome) : [...valor, nome];
    onChange(novo.length === centros.length ? [] : novo);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(botao, 'px-3 min-w-0')}>
          <Layers className="w-4 h-4 text-zinc-400 shrink-0" />
          <span className="font-semibold truncate">{rotulo}</span>
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0 ml-auto" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 bg-[#1a1a20] border-white/10 p-1.5 text-white">
        <button onClick={() => onChange([])} className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-sm hover:bg-white/5">
          <span className={cn('w-4 h-4 rounded border flex items-center justify-center', todos ? 'bg-emerald-500 border-emerald-500' : 'border-white/20')}>{todos && <Check className="w-3 h-3 text-black" />}</span>
          <b>Todos os centros</b>
        </button>
        <div className="h-px bg-white/5 my-1" />
        <div className="max-h-72 overflow-y-auto">
          {centros.map((nome) => {
            const marcado = !todos && valor.includes(nome);
            return (
              <button key={nome} onClick={() => alternar(nome)} className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-sm hover:bg-white/5 text-left">
                <span className={cn('w-4 h-4 shrink-0 rounded border flex items-center justify-center', marcado ? 'bg-emerald-500 border-emerald-500' : 'border-white/20')}>{marcado && <Check className="w-3 h-3 text-black" />}</span>
                <span className="truncate">{nome}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-zinc-500 px-2.5 pt-1.5 pb-1">Marque um ou mais. A escolha fica salva neste aparelho.</p>
      </PopoverContent>
    </Popover>
  );
}

/** Botões lado a lado (um escolhido). */
export function Segmentos<T extends string>({ opcoes, valor, onChange, largura }: { opcoes: [T, string][]; valor: T; onChange: (v: T) => void; largura?: boolean }) {
  return (
    <div className={cn('h-10 flex items-center gap-1 rounded-lg bg-[#1a1a20] border border-white/10 p-1 overflow-x-auto scrollbar-hide', largura && 'w-full sm:w-auto')}>
      {opcoes.map(([v, rotulo]) => (
        <button key={v} onClick={() => onChange(v)}
          className={cn('h-full px-2.5 sm:px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-colors', largura && 'flex-1 sm:flex-none', valor === v ? 'bg-emerald-500 text-black' : 'text-zinc-400 hover:text-white')}>
          {rotulo}
        </button>
      ))}
    </div>
  );
}
