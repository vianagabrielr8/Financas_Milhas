import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, Plus, UserMinus } from 'lucide-react';
import { cn, hojeLocal } from '@/lib/utils';
import {
  db, buscarProgramas, buscarContas, buscarMovimentos, buscarPassageiros, buscarBeneficiarios, buscarPassageirosCad,
  calcularLimites, dataBR, somaDias, erroAmigavel, NOME_MODO,
} from '@/lib/milhas';
import { Cartao, Vazio, inputCls } from '@/components/milhas/ui';

export default function LimitesCpf() {
  const qc = useQueryClient();
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const pax = useQuery({ queryKey: ['milhas_passageiros'], queryFn: buscarPassageiros });
  const benef = useQuery({ queryKey: ['milhas_beneficiarios'], queryFn: buscarBeneficiarios });
  const cadastro = useQuery({ queryKey: ['milhas_passageiros_cad'], queryFn: buscarPassageirosCad });
  const [aberto, setAberto] = useState<string | null>(null);
  const [incluir, setIncluir] = useState('');
  const hoje = hojeLocal();

  const limites = useMemo(() => calcularLimites(programas.data || [], (contas.data || []).filter(c => c.ativo), movs.data || [], pax.data || [], hoje, benef.data || [], cadastro.data || [])
    .sort((a, b) => b.usados / b.limite - a.usados / a.limite), [programas.data, contas.data, movs.data, pax.data, hoje, benef.data, cadastro.data]);

  const recarregar = () => qc.invalidateQueries({ queryKey: ['milhas_beneficiarios'] });
  const incluirNaLista = async (contaId: string, limite: number, usados: number) => {
    if (!incluir) return;
    if (usados >= limite) { toast.error('A lista está cheia. Remova alguém antes (respeitando a espera do programa).'); return; }
    const { error } = await db.from('milhas_beneficiario').insert([{ conta_id: contaId, passageiro_id: incluir, incluido_em: hoje }]);
    if (error) toast.error(erroAmigavel(error)); else { setIncluir(''); toast.success('Incluído na lista.'); recarregar(); }
  };
  const removerDaLista = async (id: string, incluidoEm: string, espera: number | null) => {
    if (espera && somaDias(incluidoEm, espera) > hoje && !window.confirm(`O programa pede ${espera} dias antes de trocar (libera em ${dataBR(somaDias(incluidoEm, espera))}). Remover mesmo assim?`)) return;
    const { error } = await db.from('milhas_beneficiario').update({ removido_em: hoje }).eq('id', id);
    if (error) toast.error(erroAmigavel(error)); else { toast.success('Removido da lista.'); recarregar(); }
  };

  if (contas.isLoading || movs.isLoading || pax.isLoading) return <p className="text-sm text-zinc-400">Carregando...</p>;
  return (
    <div className="space-y-3 max-w-3xl mx-auto text-zinc-100">
      <p className="text-xs text-zinc-500">Quanto cada titular já usou do limite de emissão para terceiros em cada programa. O próprio titular não conta. As regras ficam em Programas.</p>
      {limites.length === 0 ? <Vazio>Nenhuma carteira em programa com limite.</Vazio> : limites.map(l => {
        const pct = Math.min(100, (l.usados / l.limite) * 100);
        const cor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-violet-500';
        const livres = l.limite - l.usados;
        const lista = l.unidade === 'beneficiários';
        return (
          <Cartao key={l.conta.id} className="p-0">
            <button onClick={() => setAberto(aberto === l.conta.id ? null : l.conta.id)} className="w-full text-left p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase text-violet-300 truncate">{l.programa.nome}{l.programa.nivel ? ` · ${l.programa.nivel}` : ''}</p>
                  <p className="font-semibold truncate">{l.conta.titular}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold">{l.usados}<span className="text-xs text-zinc-500"> / {l.limite} {l.unidade}</span></p>
                  <p className={cn('text-[11px] font-bold', livres <= 0 ? 'text-red-400' : 'text-zinc-400')}>{livres <= 0 ? 'sem vaga' : `${livres} livre(s)`}</p>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-zinc-500 transition-transform', aberto === l.conta.id && 'rotate-180')} />
              </div>
              <div className="h-2 bg-black/40 rounded-full overflow-hidden mt-3"><div className={cn('h-full rounded-full', cor)} style={{ width: `${pct}%` }} /></div>
              <p className="text-[10px] text-zinc-500 mt-1.5">{NOME_MODO[l.programa.modo_limite]}{lista && l.programa.espera_troca_dias ? ` · troca após ${l.programa.espera_troca_dias} dias` : ''}</p>
            </button>
            {aberto === l.conta.id && (
              <div className="border-t border-white/5 divide-y divide-white/5">
                {l.itens.length === 0 && <p className="px-4 py-3 text-xs text-zinc-500">{lista ? 'Lista vazia.' : 'Nada usado na janela.'}</p>}
                {l.itens.map(i => (
                  <div key={i.chave} className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate"><b>{i.nome}</b> <span className="text-zinc-500">· {i.doc} · {lista ? `desde ${dataBR(i.data)}` : `emitida ${dataBR(i.data)}`}</span></span>
                    {lista
                      ? <button onClick={() => removerDaLista(i.chave, i.data, l.programa.espera_troca_dias)} className="p-1.5 text-zinc-500 hover:text-red-400" title="Remover da lista"><UserMinus className="w-4 h-4" /></button>
                      : <span className="text-zinc-400 whitespace-nowrap">libera {dataBR(i.libera)}</span>}
                  </div>
                ))}
                {lista && <div className="px-4 py-3 flex gap-2">
                  <select className={inputCls} value={incluir} onChange={e => setIncluir(e.target.value)}>
                    <option value="">Incluir passageiro na lista...</option>
                    {(cadastro.data || []).filter(p => p.ativo && !l.itens.some(i => i.doc.endsWith(p.documento))).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                  <button onClick={() => incluirNaLista(l.conta.id, l.limite, l.usados)} disabled={!incluir} className="px-3 rounded-xl bg-violet-500/15 text-violet-300 disabled:opacity-40 shrink-0"><Plus className="w-4 h-4" /></button>
                </div>}
              </div>
            )}
          </Cartao>
        );
      })}
    </div>
  );
}
