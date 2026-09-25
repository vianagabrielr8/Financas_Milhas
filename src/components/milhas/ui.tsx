// Peças visuais do módulo Milhas (roxo, para não lembrar Finanças).
import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const inputCls = 'w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none transition-colors [color-scheme:dark]';

export function Campo({ rotulo, dica, children, className }: { rotulo: string; dica?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="text-zinc-400 text-[11px] font-bold uppercase block mb-1.5">{rotulo}</span>
      {children}
      {dica && <span className="text-[11px] text-zinc-500 mt-1 block">{dica}</span>}
    </label>
  );
}

export function Pilulas<T extends string>({ opcoes, valor, onChange }: { opcoes: [T, string][]; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 bg-[#1e1e24] border border-white/5 p-1 rounded-xl overflow-x-auto scrollbar-hide">
      {opcoes.map(([v, rotulo]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={cn('px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors shrink-0',
            valor === v ? 'bg-violet-500 text-white' : 'text-zinc-400 hover:text-white')}>
          {rotulo}
        </button>
      ))}
    </div>
  );
}

export function BotaoRoxo({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={cn('bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-xl px-4 h-11 flex items-center justify-center gap-2 transition-colors disabled:opacity-40', className)}>
      {children}
    </button>
  );
}

export function Cartao({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('bg-[#1e1e24] border border-white/5 rounded-2xl p-4', className)}>{children}</div>;
}

export function Indicador({ titulo, valor, sub, destaque }: { titulo: string; valor: string; sub?: string; destaque?: boolean }) {
  return (
    <Cartao className="p-3 md:p-4 min-w-0">
      <p className="text-zinc-400 text-[11px] md:text-xs font-medium mb-1 truncate">{titulo}</p>
      <p className={cn('text-base md:text-xl font-bold truncate', destaque ? 'text-violet-400' : 'text-white')}>{valor}</p>
      {sub && <p className="text-[10px] md:text-[11px] text-zinc-500 mt-0.5 truncate">{sub}</p>}
    </Cartao>
  );
}

/** Janela: tela cheia no celular, caixa central no PC. */
export function Janela({ titulo, aberta, onFechar, children, largura = 'max-w-lg' }: { titulo: string; aberta: boolean; onFechar: () => void; children: ReactNode; largura?: string }) {
  if (!aberta) return null;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4" onClick={onFechar}>
      <div onClick={e => e.stopPropagation()} className={cn('bg-[#1a1a20] w-full border border-white/10 shadow-2xl flex flex-col h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90dvh] rounded-none sm:rounded-2xl', largura)}>
        <div className="px-5 py-4 border-b border-white/10 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-white">{titulo}</h2>
          <button onClick={onFechar} className="p-2 -m-2 text-zinc-500 hover:text-white" aria-label="Fechar"><X size={20} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="text-center text-zinc-500 text-sm border border-dashed border-white/10 rounded-2xl p-8">{children}</div>;
}
