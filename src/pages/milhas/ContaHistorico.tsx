import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, CalendarClock, PlusCircle } from 'lucide-react';
import { hojeLocal } from '@/lib/utils';
import { buscarProgramas, buscarContas, buscarMovimentos, buscarClubes, situacaoDaConta, milhasFmt, brl, dataBR } from '@/lib/milhas';
import { Cartao, Indicador } from '@/components/milhas/ui';
import ListaMovimentos from '@/components/milhas/ListaMovimentos';

// Histórico completo de uma carteira (titular x programa): resumo, vencimentos,
// clubes e todos os lançamentos com filtros, editar, apagar e exportar.
export default function ContaHistorico() {
  const { id = '' } = useParams();
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const clubes = useQuery({ queryKey: ['milhas_clubes'], queryFn: buscarClubes });
  const hoje = hojeLocal();

  const conta = contas.data?.find(c => c.id === id);
  const daConta = useMemo(() => (movs.data || []).filter(m => m.conta_id === id), [movs.data, id]);
  const s = useMemo(() => situacaoDaConta(daConta, hoje), [daConta, hoje]);
  const entradasPagas = daConta.filter(m => m.data <= hoje && ['COMPRA', 'CLUBE', 'TRANSF_ENTRADA'].includes(m.tipo));
  const investidoTotal = entradasPagas.reduce((a, m) => a + Number(m.custo), 0);
  const clubesDaConta = (clubes.data || []).filter(c => c.conta_id === id && c.ativo);

  if (!conta) return <p className="text-zinc-400 text-sm">{contas.isLoading ? 'Carregando...' : 'Conta não encontrada.'}</p>;
  const nomeProg = programas.data?.find(p => p.id === conta.programa_id)?.nome || '';

  return (
    <div className="space-y-4 max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-3">
        <Link to="/milhas/estoque" className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase text-violet-300">{nomeProg}</p>
          <p className="font-bold text-lg truncate">{conta.titular}</p>
        </div>
        <Link to="/milhas/lancar" className="text-xs font-bold text-violet-300 flex items-center gap-1"><PlusCircle className="w-4 h-4" /> Lançar</Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Indicador titulo="Saldo" valor={milhasFmt(s.saldo)} destaque sub={s.futuro ? `+${milhasFmt(s.futuro)} programadas` : undefined} />
        <Indicador titulo="Milheiro" valor={brl(s.milheiro)} />
        <Indicador titulo="Em estoque (R$)" valor={brl(s.custo)} />
        <Indicador titulo="Já investido" valor={brl(investidoTotal)} sub="compras, clubes e transferências" />
      </div>
      {(s.lotesComValidade.length > 0 || clubesDaConta.length > 0) && (
        <Cartao className="space-y-2">
          {s.lotesComValidade.filter(l => l.validade >= hoje).slice(0, 5).map(l => (
            <p key={l.validade} className="text-xs flex items-center gap-2 text-amber-300"><CalendarClock className="w-3.5 h-3.5" /> {milhasFmt(l.restante)} milhas vencem em {dataBR(l.validade)}</p>
          ))}
          {clubesDaConta.map(c => <p key={c.id} className="text-xs text-violet-300">Clube ativo: {c.nome_plano} · {milhasFmt(c.pontos_mes)}{c.bonus_mes ? ` + ${milhasFmt(c.bonus_mes)}` : ''}/mês no dia {c.dia_credito}</p>)}
        </Cartao>
      )}
      <ListaMovimentos contaId={id} />
    </div>
  );
}
