import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { buscarProgramas, buscarContas, buscarMovimentos, situacaoDaConta, milhasFmt, brl, dataBR, somaDias } from '@/lib/milhas';
import { hojeLocal } from '@/lib/utils';
import { Cartao, Indicador, Vazio, inputCls } from '@/components/milhas/ui';

export default function Estoque() {
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const [filtroProg, setFiltroProg] = useState('');
  const [mostrarInativas, setMostrarInativas] = useState(false);

  const nomeProg = (id: string) => programas.data?.find(p => p.id === id)?.nome || '?';
  const hoje = hojeLocal(), limite90 = somaDias(hoje, 90);

  const linhas = useMemo(() => {
    const porConta = new Map<string, any[]>();
    for (const m of movs.data || []) { if (!porConta.has(m.conta_id)) porConta.set(m.conta_id, []); porConta.get(m.conta_id)!.push(m); }
    return (contas.data || [])
      .filter(c => (mostrarInativas || c.ativo) && (!filtroProg || c.programa_id === filtroProg))
      .map(c => {
        const s = situacaoDaConta(porConta.get(c.id) || []);
        const proximo = s.lotesComValidade.filter(l => l.validade >= hoje)[0];
        const vence90 = s.lotesComValidade.filter(l => l.validade >= hoje && l.validade <= limite90).reduce((a, l) => a + l.restante, 0);
        return { c, s, proximo, vence90 };
      })
      .sort((a, b) => b.s.saldo - a.s.saldo);
  }, [contas.data, movs.data, filtroProg, mostrarInativas, hoje, limite90]);

  const total = linhas.reduce((a, l) => a + l.s.saldo, 0);
  const custo = linhas.reduce((a, l) => a + l.s.custo, 0);
  const vence90 = linhas.reduce((a, l) => a + l.vence90, 0);

  if (contas.isLoading || movs.isLoading) return <p className="text-zinc-400 text-sm">Carregando...</p>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto text-zinc-100">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Indicador titulo="Milhas em estoque" valor={milhasFmt(total)} destaque />
        <Indicador titulo="Valor investido" valor={brl(custo)} />
        <Indicador titulo="Milheiro médio" valor={brl(total > 0 ? custo / total * 1000 : 0)} />
        <Indicador titulo="Vencem em 90 dias" valor={milhasFmt(vence90)} sub={vence90 > 0 ? 'use ou venda antes' : undefined} />
      </div>

      <div className="flex gap-2 items-center">
        <select className={inputCls + ' max-w-xs'} value={filtroProg} onChange={e => setFiltroProg(e.target.value)}>
          <option value="">Todos os programas</option>
          {(programas.data || []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <label className="text-xs text-zinc-400 flex items-center gap-2 shrink-0">
          <input type="checkbox" className="accent-violet-500 w-4 h-4" checked={mostrarInativas} onChange={e => setMostrarInativas(e.target.checked)} /> inativas
        </label>
      </div>

      {linhas.length === 0 ? (
        <Vazio>Nenhuma conta. Cadastre em <Link to="/milhas/titulares" className="text-violet-300 underline">Titulares</Link> e lance em <Link to="/milhas/lancar" className="text-violet-300 underline">Lançar</Link>.</Vazio>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {linhas.map(({ c, s, proximo, vence90 }) => (
            <Link key={c.id} to={`/milhas/estoque/${c.id}`}>
              <Cartao className="hover:border-violet-500/50 transition-colors h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase text-violet-300 truncate">{nomeProg(c.programa_id)}</p>
                    <p className="font-semibold text-white truncate">{c.titular}{!c.ativo && <span className="text-zinc-500 text-xs"> (inativa)</span>}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 mt-1" />
                </div>
                <p className="text-2xl font-bold text-white mt-2">{milhasFmt(s.saldo)} <span className="text-xs text-zinc-500 font-medium">milhas</span></p>
                <p className="text-xs text-zinc-400 mt-1">Milheiro {brl(s.milheiro)} · investido {brl(s.custo)}</p>
                {s.futuro > 0 && <p className="text-[11px] text-violet-300 mt-1">+{milhasFmt(s.futuro)} programadas (clube)</p>}
                {proximo && (
                  <p className={'text-[11px] mt-2 flex items-center gap-1 ' + (vence90 > 0 ? 'text-amber-400' : 'text-zinc-500')}>
                    <CalendarClock className="w-3.5 h-3.5" /> {milhasFmt(proximo.restante)} vencem em {dataBR(proximo.validade)}
                  </p>
                )}
              </Cartao>
            </Link>
          ))}
        </div>
      )}
      <p className="text-[11px] text-zinc-500">Vencimentos: o app considera que as milhas usadas saem primeiro das que vencem antes. Confira no programa quando estiver perto.</p>
    </div>
  );
}
