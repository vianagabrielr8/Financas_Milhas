import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle, Package, CalendarClock, DollarSign, ShieldCheck, AlertTriangle, Repeat, CreditCard } from 'lucide-react';
import {
  buscarProgramas, buscarContas, buscarMovimentos, buscarVendas, buscarParcelas, buscarPassageiros, buscarBeneficiarios,
  buscarPassageirosCad, buscarContatos, buscarClubes, buscarCartoesFinancas, situacaoDaConta, calcularLimites, lucroDaVenda,
  milheiro, milhasFmt, brl, dataBR, somaDias, somaMeses, Movimento,
} from '@/lib/milhas';
import { hojeLocal, cn } from '@/lib/utils';
import { Cartao, Indicador, Vazio, Pilulas } from '@/components/milhas/ui';

type Periodo = 'MES' | '3M' | '12M' | 'TUDO';
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const nomeMes = (am: string) => `${MESES[Number(am.slice(5, 7)) - 1]}/${am.slice(2, 4)}`;
const fimDoMes = (am: string) => somaDias(somaMeses(am + '-01', 1), -1);
const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

// Barras simples (sem biblioteca de gráfico): leves e boas no celular.
function Barras({ itens, cor = 'bg-violet-500', formato }: { itens: { rotulo: string; valor: number; extra?: string; cor?: string }[]; cor?: string; formato: (n: number) => string }) {
  const max = Math.max(1, ...itens.map(i => Math.abs(i.valor)));
  return (
    <div className="space-y-1.5">
      {itens.map(i => (
        <div key={i.rotulo} className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 text-zinc-400 truncate">{i.rotulo}</span>
          <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
            <div className={cn('h-full rounded', i.valor < 0 ? 'bg-red-500/70' : (i.cor || cor))} style={{ width: `${(Math.abs(i.valor) / max) * 100}%` }} />
          </div>
          <span className="w-28 shrink-0 text-right font-semibold text-zinc-200 whitespace-nowrap">{formato(i.valor)}{i.extra && <span className="block text-[10px] font-normal text-zinc-500">{i.extra}</span>}</span>
        </div>
      ))}
    </div>
  );
}

export default function Painel() {
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const vendas = useQuery({ queryKey: ['milhas_vendas'], queryFn: buscarVendas });
  const parcelas = useQuery({ queryKey: ['milhas_parcelas'], queryFn: buscarParcelas });
  const pax = useQuery({ queryKey: ['milhas_passageiros'], queryFn: buscarPassageiros });
  const benef = useQuery({ queryKey: ['milhas_beneficiarios'], queryFn: buscarBeneficiarios });
  const cadPax = useQuery({ queryKey: ['milhas_passageiros_cad'], queryFn: buscarPassageirosCad });
  const contatos = useQuery({ queryKey: ['milhas_contatos'], queryFn: buscarContatos });
  const clubes = useQuery({ queryKey: ['milhas_clubes'], queryFn: buscarClubes });
  const cartoes = useQuery({ queryKey: ['cartoes_financas'], queryFn: buscarCartoesFinancas });
  const [periodo, setPeriodo] = useState<Periodo>('12M');
  const hoje = hojeLocal(), mesAtual = hoje.slice(0, 7);

  const nomeProg = (id?: string) => programas.data?.find(p => p.id === id)?.nome || '?';
  const contaPorId = useMemo(() => new Map((contas.data || []).map(c => [c.id, c])), [contas.data]);

  // Estoque atual, por programa, e vencimentos
  const estoque = useMemo(() => {
    const porConta = new Map<string, Movimento[]>();
    for (const m of movs.data || []) { if (!porConta.has(m.conta_id)) porConta.set(m.conta_id, []); porConta.get(m.conta_id)!.push(m); }
    const porPrograma = new Map<string, { saldo: number; custo: number }>();
    const vencendo: { conta: string; programa: string; validade: string; restante: number }[] = [];
    let total = 0, custo = 0, futuro = 0;
    for (const c of contas.data || []) {
      const s = situacaoDaConta(porConta.get(c.id) || [], hoje);
      total += s.saldo; custo += s.custo; futuro += s.futuro;
      const p = porPrograma.get(c.programa_id) || { saldo: 0, custo: 0 };
      porPrograma.set(c.programa_id, { saldo: p.saldo + s.saldo, custo: p.custo + s.custo });
      for (const l of s.lotesComValidade) if (l.validade >= hoje && l.validade <= somaDias(hoje, 180)) vencendo.push({ conta: c.titular, programa: c.programa_id, ...l });
    }
    vencendo.sort((a, b) => a.validade.localeCompare(b.validade));
    // evolução: saldo e milheiro no fim de cada um dos últimos 12 meses
    const evolucao = Array.from({ length: 12 }, (_, i) => somaMeses(mesAtual + '-01', i - 11).slice(0, 7)).map(am => {
      const corte = am === mesAtual ? hoje : fimDoMes(am);
      let saldo = 0, c = 0;
      for (const conta of contas.data || []) { const s = situacaoDaConta(porConta.get(conta.id) || [], corte); saldo += s.saldo; c += s.custo; }
      return { am, saldo, milheiro: milheiro(c, saldo) };
    });
    return { total, custo, futuro, porPrograma, vencendo, evolucao };
  }, [contas.data, movs.data, hoje, mesAtual]);

  // Preço de venda recente por programa (últimos 90 dias), para o valor de mercado
  const precoVenda = useMemo(() => {
    const m = new Map<string, { valor: number; milhas: number }>();
    for (const v of vendas.data || []) {
      if (v.data < somaDias(hoje, -90) || !Number(v.milhas)) continue;
      const prog = contaPorId.get(v.conta_id)?.programa_id;
      if (!prog) continue;
      const x = m.get(prog) || { valor: 0, milhas: 0 };
      m.set(prog, { valor: x.valor + Number(v.valor_total) - Number(v.taxa_dinheiro || 0), milhas: x.milhas + Number(v.milhas) });
    }
    return m;
  }, [vendas.data, contaPorId, hoje]);

  const programasEstoque = Array.from(estoque.porPrograma.entries()).filter(([, v]) => v.saldo !== 0).sort((a, b) => b[1].saldo - a[1].saldo)
    .map(([id, v]) => {
      const pv = precoVenda.get(id);
      const milVenda = pv ? milheiro(pv.valor, pv.milhas) : 0;
      return { id, ...v, milCusto: milheiro(v.custo, v.saldo), milVenda, mercado: milVenda ? (v.saldo / 1000) * milVenda : 0 };
    });
  const comPreco = programasEstoque.filter(p => p.milVenda > 0);
  const valorMercado = comPreco.reduce((a, p) => a + p.mercado, 0);
  const lucroPotencial = valorMercado - comPreco.reduce((a, p) => a + p.custo, 0);

  // Vendas no período
  const inicio = periodo === 'MES' ? mesAtual + '-01' : periodo === '3M' ? somaMeses(mesAtual + '-01', -2) : periodo === '12M' ? somaMeses(mesAtual + '-01', -11) : '0000-00-00';
  const vendasPer = (vendas.data || []).filter(v => v.data >= inicio && v.data <= hoje);
  const vendido = vendasPer.reduce((a, v) => a + Number(v.valor_total), 0);
  const lucro = vendasPer.reduce((a, v) => a + lucroDaVenda(v), 0);
  const milhasVendidas = vendasPer.reduce((a, v) => a + Number(v.milhas), 0);
  const porMes = Array.from({ length: 12 }, (_, i) => somaMeses(mesAtual + '-01', i - 11).slice(0, 7)).map(am => {
    const vs = (vendas.data || []).filter(v => v.data.startsWith(am));
    return { am, vendido: vs.reduce((a, v) => a + Number(v.valor_total), 0), lucro: vs.reduce((a, v) => a + lucroDaVenda(v), 0), n: vs.length };
  });
  const topClientes = useMemo(() => {
    const m = new Map<string, { n: number; total: number; lucro: number }>();
    for (const v of vendasPer) {
      const k = v.contato_id || '';
      const x = m.get(k) || { n: 0, total: 0, lucro: 0 };
      m.set(k, { n: x.n + 1, total: x.total + Number(v.valor_total), lucro: x.lucro + lucroDaVenda(v) });
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
      .map(([id, x]) => ({ nome: contatos.data?.find(c => c.id === id)?.nome || 'Sem cliente', ...x }));
  }, [vendasPer, contatos.data]);

  // Dinheiro a receber / a pagar nos próximos meses
  const abertas = (parcelas.data || []).filter(p => p.situacao === 'ABERTA');
  const soma = (l: { valor: number }[]) => l.reduce((a, p) => a + Number(p.valor), 0);
  const atrasadoRec = abertas.filter(p => p.tipo === 'RECEBER' && p.vencimento < hoje);
  const atrasadoPag = abertas.filter(p => p.tipo === 'PAGAR' && !p.cartao_id && p.vencimento < hoje);
  const proximos = Array.from({ length: 4 }, (_, i) => somaMeses(mesAtual + '-01', i).slice(0, 7)).map(am => {
    // no mês atual entra também o que está atrasado (menos cartão: esse vai na fatura do seu mês)
    const doMes = abertas.filter(p => p.vencimento.startsWith(am) || (am === mesAtual && !p.cartao_id && p.vencimento < hoje));
    return {
      am, receber: soma(doMes.filter(p => p.tipo === 'RECEBER')),
      pagar: soma(doMes.filter(p => p.tipo === 'PAGAR' && !p.cartao_id)),
      cartao: soma(doMes.filter(p => p.tipo === 'PAGAR' && p.cartao_id)),
    };
  });
  const cartoesMes = (cartoes.data || []).map(k => ({ k, valor: soma(abertas.filter(p => p.cartao_id === k.id && p.vencimento.startsWith(mesAtual))) })).filter(x => x.valor > 0);

  // Clubes ativos e próximos créditos
  const clubesAtivos = (clubes.data || []).filter(c => c.ativo).map(c => {
    const prox = (movs.data || []).filter(m => m.clube_id === c.id && m.data > hoje).map(m => m.data).sort()[0];
    return { c, prox };
  });

  const limitesApertados = useMemo(() => calcularLimites(programas.data || [], (contas.data || []).filter(c => c.ativo), movs.data || [], pax.data || [], hoje, benef.data || [], cadPax.data || [])
    .filter(l => l.limite > 0 && l.usados / l.limite >= 0.8), [programas.data, contas.data, movs.data, pax.data, hoje, benef.data, cadPax.data]);

  if (contas.isLoading || movs.isLoading) return <p className="text-zinc-400 text-sm">Carregando...</p>;
  const venc30 = estoque.vencendo.filter(v => v.validade <= somaDias(hoje, 30));
  const venc90 = estoque.vencendo.filter(v => v.validade <= somaDias(hoje, 90)).reduce((a, v) => a + v.restante, 0);
  const maxEvol = Math.max(1, ...estoque.evolucao.map(e => e.saldo));

  return (
    <div className="space-y-4 max-w-5xl mx-auto text-zinc-100">
      {/* Estoque */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Indicador titulo="Milhas em estoque" valor={milhasFmt(estoque.total)} destaque sub={estoque.futuro ? `+${milhasFmt(estoque.futuro)} programadas` : undefined} />
        <Indicador titulo="Valor investido" valor={brl(estoque.custo)} sub={`milheiro ${brl(milheiro(estoque.custo, estoque.total))}`} />
        <Indicador titulo="Valor de mercado" valor={comPreco.length ? brl(valorMercado) : '—'} sub={comPreco.length ? `lucro possível ${brl(lucroPotencial)}` : 'precisa de vendas nos últimos 90 dias'} />
        <Indicador titulo="Vencem em 90 dias" valor={milhasFmt(venc90)} sub={venc90 > 0 ? 'use ou venda antes' : undefined} />
      </div>

      {/* Alertas */}
      {(atrasadoRec.length > 0 || atrasadoPag.length > 0 || venc30.length > 0 || limitesApertados.length > 0) && (
        <Cartao className="border-amber-500/30 space-y-1.5">
          <p className="text-sm font-bold text-amber-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Atenção</p>
          {atrasadoRec.length > 0 && <Link to="/milhas/receber-pagar" className="block text-xs text-zinc-300">💸 {brl(soma(atrasadoRec))} a receber atrasado ({atrasadoRec.length} parcela(s))</Link>}
          {atrasadoPag.length > 0 && <Link to="/milhas/receber-pagar" className="block text-xs text-zinc-300">🧾 {brl(soma(atrasadoPag))} a pagar atrasado ({atrasadoPag.length} parcela(s))</Link>}
          {venc30.map((v, i) => <Link key={i} to="/milhas/estoque" className="block text-xs text-zinc-300">⏳ {milhasFmt(v.restante)} milhas de {v.conta} – {nomeProg(v.programa)} vencem em {dataBR(v.validade)}</Link>)}
          {limitesApertados.map(l => <Link key={l.conta.id} to="/milhas/limites-cpf" className="flex items-center gap-1 text-xs text-zinc-300"><ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Limite quase no fim: {l.conta.titular} – {l.programa.nome} ({l.usados} de {l.limite} {l.unidade})</Link>)}
        </Cartao>
      )}

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Link to="/milhas/vendas"><Cartao className="flex items-center gap-3 hover:border-violet-500/50"><DollarSign className="w-5 h-5 text-violet-400" /><span className="font-semibold text-sm">Vender</span></Cartao></Link>
        <Link to="/milhas/lancar"><Cartao className="flex items-center gap-3 hover:border-violet-500/50"><PlusCircle className="w-5 h-5 text-violet-400" /><span className="font-semibold text-sm">Lançar</span></Cartao></Link>
        <Link to="/milhas/estoque"><Cartao className="flex items-center gap-3 hover:border-violet-500/50"><Package className="w-5 h-5 text-violet-400" /><span className="font-semibold text-sm">Estoque</span></Cartao></Link>
      </div>

      {/* Vendas */}
      <Cartao className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold">Vendas</p>
          <Pilulas<Periodo> valor={periodo} onChange={setPeriodo} opcoes={[['MES', 'Este mês'], ['3M', '3 meses'], ['12M', '12 meses'], ['TUDO', 'Tudo']]} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Indicador titulo="Vendido" valor={brl(vendido)} sub={`${vendasPer.length} venda(s) · ${milhasFmt(milhasVendidas)} milhas`} />
          <Indicador titulo="Lucro" valor={brl(lucro)} destaque sub={vendido ? `margem ${pct(lucro / vendido)}` : undefined} />
          <Indicador titulo="Ticket médio" valor={brl(vendasPer.length ? vendido / vendasPer.length : 0)} sub={vendasPer.length ? `lucro médio ${brl(lucro / vendasPer.length)}` : undefined} />
          <Indicador titulo="Milheiro de venda" valor={brl(milheiro(vendido - vendasPer.reduce((a, v) => a + Number(v.taxa_dinheiro || 0), 0), milhasVendidas))} sub="já tirando as taxas" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-zinc-400 mb-2">Lucro por mês (últimos 12 meses)</p>
            {porMes.every(m => m.n === 0) ? <p className="text-sm text-zinc-500">Nenhuma venda nos últimos 12 meses.</p>
              : <Barras formato={brl} itens={porMes.slice(porMes.findIndex(m => m.n > 0)).map(m => ({ rotulo: nomeMes(m.am), valor: m.lucro, extra: m.n ? `${m.n} venda(s) · ${brl(m.vendido)}` : undefined }))} />}
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-2">Melhores clientes no período</p>
            {topClientes.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma venda no período.</p> : (
              <div className="space-y-2">
                {topClientes.map((c, i) => (
                  <div key={i} className="flex justify-between gap-2 text-sm">
                    <span className="text-zinc-300 truncate">{i + 1}. {c.nome} <span className="text-[11px] text-zinc-500">· {c.n} venda(s)</span></span>
                    <span className="font-semibold whitespace-nowrap">{brl(c.total)} <span className="text-[11px] text-emerald-400">+{brl(c.lucro)}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Cartao>

      {/* Estoque por programa e evolução */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Cartao>
          <p className="text-sm font-bold mb-3">Por programa</p>
          {programasEstoque.length === 0 ? <Vazio>Nada em estoque ainda.</Vazio> : (
            <div className="space-y-3">
              {programasEstoque.map(p => (
                <div key={p.id} className="text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-zinc-200 font-medium truncate">{nomeProg(p.id)}</span>
                    <span className="font-semibold whitespace-nowrap">{milhasFmt(p.saldo)}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded mt-1 overflow-hidden"><div className="h-full bg-violet-500 rounded" style={{ width: `${(Math.max(p.saldo, 0) / Math.max(1, programasEstoque[0].saldo)) * 100}%` }} /></div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    custo {brl(p.milCusto)}/mil · investido {brl(p.custo)}
                    {p.milVenda > 0 ? <> · venda {brl(p.milVenda)}/mil · <span className={p.milVenda >= p.milCusto ? 'text-emerald-400' : 'text-red-400'}>vale {brl(p.mercado)}</span></> : ' · sem venda recente'}
                  </p>
                </div>
              ))}
              <p className="text-[10px] text-zinc-600">"Venda/mil" = média das suas vendas desse programa nos últimos 90 dias, já tirando as taxas.</p>
            </div>
          )}
        </Cartao>
        <Cartao>
          <p className="text-sm font-bold mb-3">Estoque no fim de cada mês</p>
          <div className="flex items-end gap-1 h-36">
            {estoque.evolucao.map(e => (
              <div key={e.am} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${nomeMes(e.am)}: ${milhasFmt(e.saldo)} milhas · milheiro ${brl(e.milheiro)}`}>
                <div className={cn('w-full rounded-t', e.am === mesAtual ? 'bg-violet-400' : 'bg-violet-500/50')} style={{ height: `${(Math.max(e.saldo, 0) / maxEvol) * 100}%`, minHeight: e.saldo > 0 ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="flex gap-1 mt-1">{estoque.evolucao.map(e => <span key={e.am} className="flex-1 text-center text-[9px] text-zinc-500 truncate">{MESES[Number(e.am.slice(5, 7)) - 1]}</span>)}</div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center text-[11px]">
            {[estoque.evolucao[0], estoque.evolucao[6], estoque.evolucao[11]].map(e => (
              <div key={e.am} className="bg-white/5 rounded-lg p-2">
                <p className="text-zinc-500">{nomeMes(e.am)}</p>
                <p className="font-semibold text-zinc-200">{milhasFmt(e.saldo)}</p>
                <p className="text-zinc-500">{brl(e.milheiro)}/mil</p>
              </div>
            ))}
          </div>
        </Cartao>
      </div>

      {/* Dinheiro dos próximos meses */}
      <Cartao>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold">Próximos meses</p>
          <Link to="/milhas/receber-pagar" className="text-xs text-violet-300">ver parcelas</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[340px]">
            <thead><tr className="text-[11px] text-zinc-500 text-left"><th className="font-medium pb-2">Mês</th><th className="font-medium pb-2 text-right">A receber</th><th className="font-medium pb-2 text-right">A pagar</th><th className="font-medium pb-2 text-right">Nos cartões</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {proximos.map(m => (
                <tr key={m.am}>
                  <td className="py-2 text-zinc-300">{nomeMes(m.am)}{m.am === mesAtual && <span className="text-[10px] text-zinc-500"> (+atrasado)</span>}</td>
                  <td className="py-2 text-right text-emerald-400 font-semibold">{brl(m.receber)}</td>
                  <td className="py-2 text-right text-zinc-200">{brl(m.pagar)}</td>
                  <td className="py-2 text-right text-zinc-400">{brl(m.cartao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cartoesMes.length > 0 && (
          <Link to="/milhas/cartoes" className="block mt-3 text-[11px] text-zinc-400">
            <CreditCard className="w-3.5 h-3.5 inline mr-1 text-violet-400" />Faturas deste mês: {cartoesMes.map(x => `${x.k.nome} ${brl(x.valor)}`).join(' · ')}
          </Link>
        )}
      </Cartao>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Cartao>
          <p className="text-sm font-bold mb-3 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-amber-400" /> Vencendo nos próximos 6 meses</p>
          {estoque.vencendo.length === 0 ? <p className="text-sm text-zinc-500">Nada vencendo. 👍</p> : (
            <div className="space-y-2">
              {estoque.vencendo.slice(0, 8).map((v, i) => (
                <div key={i} className="flex justify-between text-sm gap-2">
                  <span className="text-zinc-300 truncate">{v.conta} – {nomeProg(v.programa)}</span>
                  <span className={cn('font-semibold whitespace-nowrap', v.validade <= somaDias(hoje, 90) ? 'text-amber-400' : 'text-zinc-400')}>{milhasFmt(v.restante)} em {dataBR(v.validade)}</span>
                </div>
              ))}
            </div>
          )}
        </Cartao>
        <Cartao>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold flex items-center gap-2"><Repeat className="w-4 h-4 text-violet-400" /> Clubes ativos</p>
            <Link to="/milhas/clubes" className="text-xs text-violet-300">ver clubes</Link>
          </div>
          {clubesAtivos.length === 0 ? <p className="text-sm text-zinc-500">Nenhum clube ativo.</p> : (
            <div className="space-y-2">
              {clubesAtivos.map(({ c, prox }) => {
                const conta = contaPorId.get(c.conta_id);
                return (
                  <div key={c.id} className="flex justify-between text-sm gap-2">
                    <span className="text-zinc-300 truncate">{c.nome_plano} <span className="text-[11px] text-zinc-500">· {conta?.titular} – {nomeProg(conta?.programa_id)}</span></span>
                    <span className="whitespace-nowrap text-violet-300 font-semibold">{prox ? `${milhasFmt(c.pontos_mes + (c.bonus_mes || 0))} em ${dataBR(prox)}` : 'sem créditos programados'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Cartao>
      </div>
    </div>
  );
}
