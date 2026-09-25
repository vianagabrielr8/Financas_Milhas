import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PlusCircle, Package, CalendarClock, DollarSign, ShieldCheck } from 'lucide-react';
import { buscarProgramas, buscarContas, buscarMovimentos, buscarVendas, buscarParcelas, buscarPassageiros, situacaoDaConta, calcularLimites, lucroDaVenda, milhasFmt, brl, dataBR, somaDias } from '@/lib/milhas';
import { hojeLocal } from '@/lib/utils';
import { Cartao, Indicador, Vazio } from '@/components/milhas/ui';

export default function Painel() {
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const vendas = useQuery({ queryKey: ['milhas_vendas'], queryFn: buscarVendas });
  const parcelas = useQuery({ queryKey: ['milhas_parcelas'], queryFn: buscarParcelas });
  const pax = useQuery({ queryKey: ['milhas_passageiros'], queryFn: buscarPassageiros });
  const hoje = hojeLocal(), limite90 = somaDias(hoje, 90), mes = hoje.slice(0, 7);

  const vendasMes = (vendas.data || []).filter(v => v.data.startsWith(mes));
  const abertas = (parcelas.data || []).filter(p => p.situacao === 'ABERTA');
  const aReceber = abertas.filter(p => p.tipo === 'RECEBER'), aPagar = abertas.filter(p => p.tipo === 'PAGAR');
  const soma = (l: any[]) => l.reduce((a, p) => a + Number(p.valor), 0);
  const atrasado = abertas.filter(p => p.tipo === 'RECEBER' && p.vencimento < hoje);
  const limitesApertados = useMemo(() => calcularLimites(programas.data || [], (contas.data || []).filter(c => c.ativo), movs.data || [], pax.data || [], hoje)
    .filter(l => l.usados / l.limite >= 0.8), [programas.data, contas.data, movs.data, pax.data, hoje]);

  const dados = useMemo(() => {
    const porConta = new Map<string, any[]>();
    for (const m of movs.data || []) { if (!porConta.has(m.conta_id)) porConta.set(m.conta_id, []); porConta.get(m.conta_id)!.push(m); }
    const porPrograma = new Map<string, { saldo: number; custo: number }>();
    const vencendo: { conta: string; programa: string; validade: string; restante: number }[] = [];
    let total = 0, custo = 0;
    for (const c of contas.data || []) {
      const s = situacaoDaConta(porConta.get(c.id) || []);
      total += s.saldo; custo += s.custo;
      const p = porPrograma.get(c.programa_id) || { saldo: 0, custo: 0 };
      porPrograma.set(c.programa_id, { saldo: p.saldo + s.saldo, custo: p.custo + s.custo });
      for (const l of s.lotesComValidade) if (l.validade >= hoje && l.validade <= limite90) vencendo.push({ conta: c.titular, programa: c.programa_id, ...l });
    }
    vencendo.sort((a, b) => a.validade.localeCompare(b.validade));
    return { total, custo, porPrograma: Array.from(porPrograma.entries()).filter(([, v]) => v.saldo !== 0).sort((a, b) => b[1].saldo - a[1].saldo), vencendo };
  }, [contas.data, movs.data, hoje, limite90]);

  const nomeProg = (id: string) => programas.data?.find(p => p.id === id)?.nome || '?';
  if (contas.isLoading || movs.isLoading) return <p className="text-zinc-400 text-sm">Carregando...</p>;

  return (
    <div className="space-y-4 max-w-5xl mx-auto text-zinc-100">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Indicador titulo="Milhas em estoque" valor={milhasFmt(dados.total)} destaque />
        <Indicador titulo="Valor investido" valor={brl(dados.custo)} />
        <Indicador titulo="Milheiro médio" valor={brl(dados.total > 0 ? dados.custo / dados.total * 1000 : 0)} />
        <Indicador titulo="Vencem em 90 dias" valor={milhasFmt(dados.vencendo.reduce((a, v) => a + v.restante, 0))} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <Indicador titulo="Vendido no mês" valor={brl(vendasMes.reduce((a, v) => a + Number(v.valor_total), 0))} sub={`${vendasMes.length} venda(s)`} />
        <Indicador titulo="Lucro no mês" valor={brl(vendasMes.reduce((a, v) => a + lucroDaVenda(v), 0))} destaque />
        <Link to="/milhas/receber-pagar"><Indicador titulo="A receber" valor={brl(soma(aReceber))} sub={atrasado.length ? `${brl(soma(atrasado))} atrasado` : undefined} /></Link>
        <Link to="/milhas/receber-pagar"><Indicador titulo="A pagar" valor={brl(soma(aPagar))} /></Link>
      </div>

      {limitesApertados.length > 0 && (
        <Link to="/milhas/limites-cpf">
          <Cartao className="border-amber-500/30 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-sm">
              <p className="font-bold text-amber-300">Limite de CPF quase no fim</p>
              {limitesApertados.map(l => <p key={l.conta.id} className="text-xs text-zinc-400">{l.conta.titular} – {l.programa.nome}: {l.usados} de {l.limite}</p>)}
            </div>
          </Cartao>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Link to="/milhas/vendas"><Cartao className="flex items-center gap-3 hover:border-violet-500/50"><DollarSign className="w-5 h-5 text-violet-400" /><span className="font-semibold text-sm">Vender</span></Cartao></Link>
        <Link to="/milhas/lancar"><Cartao className="flex items-center gap-3 hover:border-violet-500/50"><PlusCircle className="w-5 h-5 text-violet-400" /><span className="font-semibold text-sm">Lançar</span></Cartao></Link>
        <Link to="/milhas/estoque"><Cartao className="flex items-center gap-3 hover:border-violet-500/50"><Package className="w-5 h-5 text-violet-400" /><span className="font-semibold text-sm">Estoque</span></Cartao></Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Cartao>
          <p className="text-sm font-bold mb-3">Por programa</p>
          {dados.porPrograma.length === 0 ? <Vazio>Nada em estoque ainda.</Vazio> : (
            <div className="space-y-2">
              {dados.porPrograma.map(([id, v]) => (
                <div key={id} className="flex justify-between text-sm">
                  <span className="text-zinc-300">{nomeProg(id)}</span>
                  <span className="font-semibold">{milhasFmt(v.saldo)} <span className="text-[11px] text-zinc-500">· {brl(v.saldo > 0 ? v.custo / v.saldo * 1000 : 0)}/mil</span></span>
                </div>
              ))}
            </div>
          )}
        </Cartao>
        <Cartao>
          <p className="text-sm font-bold mb-3 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-amber-400" /> Vencendo nos próximos 90 dias</p>
          {dados.vencendo.length === 0 ? <p className="text-sm text-zinc-500">Nada vencendo. 👍</p> : (
            <div className="space-y-2">
              {dados.vencendo.map((v, i) => (
                <div key={i} className="flex justify-between text-sm gap-2">
                  <span className="text-zinc-300 truncate">{v.conta} – {nomeProg(v.programa)}</span>
                  <span className="font-semibold text-amber-400 whitespace-nowrap">{milhasFmt(v.restante)} em {dataBR(v.validade)}</span>
                </div>
              ))}
            </div>
          )}
        </Cartao>
      </div>
    </div>
  );
}
