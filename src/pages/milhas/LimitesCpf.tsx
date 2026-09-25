import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { cn, hojeLocal } from '@/lib/utils';
import { buscarProgramas, buscarContas, buscarMovimentos, buscarPassageiros, calcularLimites, dataBR } from '@/lib/milhas';
import { Cartao, Vazio } from '@/components/milhas/ui';

export default function LimitesCpf() {
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const pax = useQuery({ queryKey: ['milhas_passageiros'], queryFn: buscarPassageiros });
  const [aberto, setAberto] = useState<string | null>(null);
  const hoje = hojeLocal();

  const limites = useMemo(() => calcularLimites(programas.data || [], (contas.data || []).filter(c => c.ativo), movs.data || [], pax.data || [], hoje)
    .sort((a, b) => b.usados / b.limite - a.usados / a.limite), [programas.data, contas.data, movs.data, pax.data, hoje]);

  if (contas.isLoading || movs.isLoading || pax.isLoading) return <p className="text-sm text-zinc-400">Carregando...</p>;
  return (
    <div className="space-y-3 max-w-3xl mx-auto text-zinc-100">
      <p className="text-xs text-zinc-500">Quantos CPFs diferentes cada conta já usou na janela do programa. O CPF do próprio titular não conta. As regras (limite e renovação) ficam em Cadastros → Programas.</p>
      {limites.length === 0 ? <Vazio>Nenhuma conta em programa com limite de CPF.</Vazio> : limites.map(l => {
        const pct = Math.min(100, (l.usados / l.limite) * 100);
        const cor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-violet-500';
        const livres = l.limite - l.usados;
        return (
          <Cartao key={l.conta.id} className="p-0">
            <button onClick={() => setAberto(aberto === l.conta.id ? null : l.conta.id)} className="w-full text-left p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase text-violet-300 truncate">{l.programa.nome}</p>
                  <p className="font-semibold truncate">{l.conta.titular}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold">{l.usados}<span className="text-xs text-zinc-500"> / {l.limite}</span></p>
                  <p className={cn('text-[11px] font-bold', livres <= 0 ? 'text-red-400' : 'text-zinc-400')}>{livres <= 0 ? 'sem CPF livre' : `${livres} livre(s)`}</p>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-zinc-500 transition-transform', aberto === l.conta.id && 'rotate-180')} />
              </div>
              <div className="h-2 bg-black/40 rounded-full overflow-hidden mt-3"><div className={cn('h-full rounded-full', cor)} style={{ width: `${pct}%` }} /></div>
              <p className="text-[10px] text-zinc-500 mt-1.5">{l.programa.renovacao_cpf === '12_MESES' ? 'Cada CPF libera 12 meses depois da última emissão' : 'Todos liberam em 1º de janeiro'}</p>
            </button>
            {aberto === l.conta.id && (
              <div className="border-t border-white/5 divide-y divide-white/5">
                {l.cpfs.length === 0 ? <p className="px-4 py-3 text-xs text-zinc-500">Nenhum CPF usado na janela.</p> : l.cpfs.map(c => (
                  <div key={c.cpf} className="px-4 py-2.5 flex justify-between gap-2 text-xs">
                    <span className="truncate"><b>{c.nome}</b> <span className="text-zinc-500">· {c.cpf}</span></span>
                    <span className="text-zinc-400 whitespace-nowrap">libera {dataBR(c.libera)}</span>
                  </div>
                ))}
              </div>
            )}
          </Cartao>
        );
      })}
    </div>
  );
}
