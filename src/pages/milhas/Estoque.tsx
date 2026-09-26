import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { buscarProgramas, buscarContas, buscarTitulares, buscarMovimentos, situacaoDaConta, milhasFmt, brl, dataBR, somaDias } from '@/lib/milhas';
import { hojeLocal } from '@/lib/utils';
import { Cartao, Indicador, Vazio, Pilulas, inputCls } from '@/components/milhas/ui';
import ListaMovimentos from '@/components/milhas/ListaMovimentos';

type Aba = 'CARTEIRAS' | 'MOVIMENTOS';
type Ordem = 'SALDO' | 'MILHEIRO' | 'VENCE' | 'NOME';

export default function Estoque() {
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const titulares = useQuery({ queryKey: ['milhas_titulares'], queryFn: buscarTitulares });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const [aba, setAba] = useState<Aba>('CARTEIRAS');
  const [filtroProg, setFiltroProg] = useState('');
  const [filtroTit, setFiltroTit] = useState('');
  const [soComSaldo, setSoComSaldo] = useState(true);
  const [ordem, setOrdem] = useState<Ordem>('SALDO');

  const nomeProg = (id: string) => programas.data?.find(p => p.id === id)?.nome || '?';
  const hoje = hojeLocal(), limite90 = somaDias(hoje, 90);

  const linhas = useMemo(() => {
    const porConta = new Map<string, any[]>();
    for (const m of movs.data || []) { if (!porConta.has(m.conta_id)) porConta.set(m.conta_id, []); porConta.get(m.conta_id)!.push(m); }
    const l = (contas.data || [])
      .filter(c => (!filtroProg || c.programa_id === filtroProg) && (!filtroTit || c.titular_id === filtroTit))
      .map(c => {
        const s = situacaoDaConta(porConta.get(c.id) || []);
        const proximo = s.lotesComValidade.filter(x => x.validade >= hoje)[0];
        const vence90 = s.lotesComValidade.filter(x => x.validade >= hoje && x.validade <= limite90).reduce((a, x) => a + x.restante, 0);
        const ultimo = (porConta.get(c.id) || []).filter(m => m.data <= hoje).at(-1)?.data;
        return { c, s, proximo, vence90, ultimo };
      })
      .filter(x => !soComSaldo || x.s.saldo !== 0 || x.s.futuro > 0);
    const cmp: Record<Ordem, (a: any, b: any) => number> = {
      SALDO: (a, b) => b.s.saldo - a.s.saldo,
      MILHEIRO: (a, b) => a.s.milheiro - b.s.milheiro,
      VENCE: (a, b) => (a.proximo?.validade ?? '9999').localeCompare(b.proximo?.validade ?? '9999'),
      NOME: (a, b) => a.c.titular.localeCompare(b.c.titular) || nomeProg(a.c.programa_id).localeCompare(nomeProg(b.c.programa_id)),
    };
    return l.sort(cmp[ordem]);
  }, [contas.data, movs.data, filtroProg, filtroTit, soComSaldo, ordem, hoje, limite90, programas.data]);

  const total = linhas.reduce((a, l) => a + l.s.saldo, 0);
  const custo = linhas.reduce((a, l) => a + l.s.custo, 0);
  const vence90 = linhas.reduce((a, l) => a + l.vence90, 0);
  const futuro = linhas.reduce((a, l) => a + l.s.futuro, 0);

  if (contas.isLoading || movs.isLoading) return <p className="text-zinc-400 text-sm">Carregando...</p>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto text-zinc-100">
      <Pilulas<Aba> valor={aba} onChange={setAba} opcoes={[['CARTEIRAS', 'Carteiras'], ['MOVIMENTOS', 'Todos os movimentos']]} />
      {aba === 'MOVIMENTOS' ? <ListaMovimentos /> : <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <Indicador titulo="Milhas em estoque" valor={milhasFmt(total)} destaque sub={futuro ? `+${milhasFmt(futuro)} programadas` : undefined} />
          <Indicador titulo="Valor investido" valor={brl(custo)} />
          <Indicador titulo="Milheiro médio" valor={brl(total > 0 ? custo / total * 1000 : 0)} />
          <Indicador titulo="Vencem em 90 dias" valor={milhasFmt(vence90)} sub={vence90 > 0 ? 'use ou venda antes' : undefined} />
        </div>

        <Cartao className="p-3 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <select className={inputCls} value={filtroTit} onChange={e => setFiltroTit(e.target.value)}><option value="">Todos os titulares</option>{(titulares.data || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
            <select className={inputCls} value={filtroProg} onChange={e => setFiltroProg(e.target.value)}><option value="">Todos os programas</option>{(programas.data || []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
            <select className={inputCls + ' col-span-2 md:col-span-1'} value={ordem} onChange={e => setOrdem(e.target.value as Ordem)}>
              <option value="SALDO">Ordenar: maior saldo</option><option value="MILHEIRO">Ordenar: menor milheiro</option>
              <option value="VENCE">Ordenar: vence primeiro</option><option value="NOME">Ordenar: titular</option>
            </select>
          </div>
          <label className="text-xs text-zinc-400 flex items-center gap-2"><input type="checkbox" className="accent-violet-500 w-4 h-4" checked={soComSaldo} onChange={e => setSoComSaldo(e.target.checked)} /> só carteiras com saldo</label>
        </Cartao>

        {linhas.length === 0 ? (
          <Vazio>Nada por aqui. Cadastre <Link to="/milhas/titulares" className="text-violet-300 underline">titulares</Link> e lance em <Link to="/milhas/lancar" className="text-violet-300 underline">Lançar</Link>.</Vazio>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {linhas.map(({ c, s, proximo, vence90, ultimo }) => (
              <Link key={c.id} to={`/milhas/estoque/${c.id}`}>
                <Cartao className="hover:border-violet-500/50 transition-colors h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase text-violet-300 truncate">{c.titular}{!c.ativo && <span className="text-zinc-500 normal-case font-normal"> (inativa)</span>}</p>
                      <p className="font-bold text-lg text-white truncate">{nomeProg(c.programa_id)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0 mt-1" />
                  </div>
                  <p className="text-2xl font-bold text-white mt-2">{milhasFmt(s.saldo)} <span className="text-xs text-zinc-500 font-medium">milhas</span></p>
                  <p className="text-xs text-zinc-400 mt-1">Milheiro {brl(s.milheiro)} · investido {brl(s.custo)}</p>
                  {s.futuro > 0 && <p className="text-[11px] text-violet-300 mt-1">+{milhasFmt(s.futuro)} programadas (clube)</p>}
                  {proximo && <p className={'text-[11px] mt-1 flex items-center gap-1 ' + (vence90 > 0 ? 'text-amber-400' : 'text-zinc-500')}><CalendarClock className="w-3.5 h-3.5" /> {milhasFmt(proximo.restante)} vencem em {dataBR(proximo.validade)}</p>}
                  {ultimo && <p className="text-[10px] text-zinc-600 mt-1">último lançamento {dataBR(ultimo)}</p>}
                </Cartao>
              </Link>
            ))}
          </div>
        )}
        <p className="text-[11px] text-zinc-500">Vencimentos: o app considera que as milhas usadas saem primeiro das que vencem antes. Confira no programa quando estiver perto.</p>
      </>}
    </div>
  );
}
