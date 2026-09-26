import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, CalendarDays, ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Página aberta por quem recebeu o link (sem login). Só lê o que a função
// extrato_compartilhado devolve: os lançamentos de UMA categoria e os totais.
type Lanc = { data: string; descricao: string; valor: number; tipo: string; situacao: string; cartao: string | null; conta: string | null; mes_fatura: string | null; vencimento: string };
type Extrato = { titulo: string; total_lancado: number; total_pago: number; periodo_lancado: number; periodo_pago: number; primeiro_mes: string | null; ultimo_mes: string | null; lancamentos: Lanc[] };

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (d: string) => d.slice(0, 10).split('-').reverse().join('/');
const rotulo = (am: string) => `${MESES[Number(am.slice(5, 7)) - 1]}/${am.slice(2, 4)}`;
const somar = (am: string, n: number) => { const d = new Date(Number(am.slice(0, 4)), Number(am.slice(5, 7)) - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function ExtratoCompartilhado() {
  const { codigo = '' } = useParams();
  const mesAtual = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const [mes, setMesEstado] = useState<string | null>(null); // null = ainda não escolhido (abre no 1º mês com algo a pagar); '' = todos
  const [venc, setVenc] = useState<string>(''); // dia de vencimento ('' = todos)
  const [verPagos, setVerPagos] = useState(false);
  const setMes = (m: string) => { setMesEstado(m); setVenc(''); };
  const [dados, setDados] = useState<Extrato | null>(null);
  const [estado, setEstado] = useState<'CARREGANDO' | 'OK' | 'INVALIDO' | 'ERRO'>('CARREGANDO');

  // busca tudo de uma vez (é pouca coisa por pessoa) e filtra aqui
  useEffect(() => {
    let vivo = true;
    (supabase as any).rpc('extrato_compartilhado', { p_codigo: codigo, p_de: null, p_ate: null })
      .then(({ data, error }: { data: Extrato | null; error: unknown }) => {
        if (!vivo) return;
        if (error) { setEstado('ERRO'); return; }
        if (!data) { setEstado('INVALIDO'); return; }
        setDados(data); setEstado('OK');
        document.title = `Contas – ${data.titulo}`;
      });
    return () => { vivo = false; };
  }, [codigo]);

  // "A pagar" = o que a pessoa ainda não te pagou. Cada compra fica com o que ainda falta.
  const todos = dados?.lancamentos || [];
  const falta = useMemo(() => {
    const m = new Map<Lanc, number>();
    // compra de fatura JÁ PAGA (situação "Pago") conta como acertada;
    // os Pix da pessoa (Receitas) e os estornos pendentes quitam as pendentes, da mais antiga para a mais nova
    for (const l of todos) if (l.tipo === 'DESPESA' && l.situacao === 'PAGO') m.set(l, 0);
    let credito = todos.filter((l) => l.tipo === 'RECEITA' || (l.tipo === 'ESTORNO' && l.situacao !== 'PAGO')).reduce((a, l) => a + Number(l.valor), 0);
    for (const l of [...todos].filter((l) => l.tipo === 'DESPESA' && l.situacao !== 'PAGO').sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.data.localeCompare(b.data))) {
      const usa = Math.min(credito, Number(l.valor));
      credito -= usa;
      m.set(l, Math.round((Number(l.valor) - usa) * 100) / 100);
    }
    return m;
  }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  const aPagar = (l: Lanc) => l.tipo === 'DESPESA' && (falta.get(l) ?? 0) > 0.004;
  const valorDe = (l: Lanc) => falta.get(l) ?? 0;
  const mesDe = (l: Lanc) => l.vencimento.slice(0, 7);
  const pendentes = todos.filter(aPagar);
  const totalAPagar = pendentes.reduce((a, l) => a + valorDe(l), 0);
  const proximo = useMemo(() => {
    const d = pendentes.map((l) => l.vencimento).sort()[0];
    return d ? { data: d, valor: pendentes.filter((l) => l.vencimento === d).reduce((a, l) => a + valorDe(l), 0) } : null;
  }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps
  // abre no 1º mês que tem algo a pagar; sem nada pendente, no mês atual
  const mesEscolhido = mes ?? (proximo ? proximo.data.slice(0, 7) : mesAtual);

  // meses que têm lançamento (e o atual), do mais novo ao mais antigo
  const meses = useMemo(() => Array.from(new Set([...todos.map(mesDe), mesAtual])).sort().reverse(), [dados, mesAtual]); // eslint-disable-line react-hooks/exhaustive-deps
  const doMes = todos.filter((l) => !mesEscolhido || mesDe(l) === mesEscolhido).filter((l) => verPagos || aPagar(l));
  const vencimentos = Array.from(new Set(doMes.filter((l) => l.cartao && l.tipo !== 'RECEITA').map((l) => l.vencimento))).sort();
  const lista = doMes.filter((l) => !venc || (l.cartao && l.vencimento === venc));
  const somaLista = lista.filter(aPagar).reduce((a, l) => a + valorDe(l), 0);
  // próximo vencimento dentro do que está selecionado
  const proximoSel = (() => {
    const pend = lista.filter(aPagar);
    const d = pend.map((l) => l.vencimento).sort()[0];
    return d ? { data: d, valor: pend.filter((l) => l.vencimento === d).reduce((a, l) => a + valorDe(l), 0) } : null;
  })();
  const pagosNoMes = todos.filter((l) => (!mesEscolhido || mesDe(l) === mesEscolhido) && !aPagar(l)).length;
  // grupos por dia de vencimento, do mais próximo ao mais distante
  const grupos = (() => {
    const m = new Map<string, { data: string; cartao: boolean; total: number; itens: Lanc[] }>();
    for (const l of lista) {
      const g = m.get(l.vencimento) || { data: l.vencimento, cartao: false, total: 0, itens: [] };
      g.cartao = g.cartao || !!l.cartao;
      if (aPagar(l)) g.total += valorDe(l);
      g.itens.push(l);
      m.set(l.vencimento, g);
    }
    return Array.from(m.values()).sort((a, b) => a.data.localeCompare(b.data));
  })();

  if (estado === 'CARREGANDO' && !dados) return <Tela><p className="text-zinc-400 text-sm">Carregando...</p></Tela>;
  if (estado === 'INVALIDO') return <Tela><p className="text-zinc-300">Este link não existe ou foi desativado.</p><p className="text-zinc-500 text-sm mt-1">Peça um link novo para quem te enviou.</p></Tela>;
  if (estado === 'ERRO' || !dados) return <Tela><p className="text-zinc-300">Não consegui carregar agora. Tente de novo em instantes.</p></Tela>;

  const nomeMes = (m: string) => `${MESES_LONGOS[Number(m.slice(5, 7)) - 1]}`;
  return (
    <Tela>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Contas a pagar</p>
          <h1 className="text-2xl font-bold text-white">{dados.titulo}</h1>
        </div>

        {/* Filtros: mês e vencimento, cada um abre sua lista */}
        <div className="grid grid-cols-2 gap-2">
          <Filtro icone={<CalendarDays className="w-4 h-4" />} rotulo="Mês" valor={mesEscolhido ? rotulo(mesEscolhido) : 'Todos'}
            opcoes={[['', 'Todos'], ...meses.map((m) => [m, `${nomeMes(m)} ${m.slice(0, 4)}`] as [string, string])]}
            escolhido={mesEscolhido} onEscolher={setMes} />
          <Filtro icone={<CreditCard className="w-4 h-4" />} rotulo="Vencimento" valor={venc ? `dia ${dataBR(venc).slice(0, 5)}` : 'Todos'}
            opcoes={[['', 'Todos'], ...vencimentos.map((v) => [v, `Vence ${dataBR(v)}`] as [string, string])]}
            escolhido={venc} onEscolher={setVenc} vazio="Nada a pagar no cartão neste mês"
            bloqueado={!mesEscolhido ? 'Escolha um mês primeiro' : undefined} />
        </div>

        {/* Total do que está selecionado nos filtros */}
        <div className={cn('rounded-2xl p-5 border', somaLista > 0.004 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30')}>
          <p className="text-sm text-zinc-300">{venc ? `A pagar no dia ${dataBR(venc).slice(0, 5)}` : mesEscolhido ? `A pagar em ${nomeMes(mesEscolhido).toLowerCase()} de ${mesEscolhido.slice(0, 4)}` : 'A pagar (todos os meses)'}</p>
          <p className={cn('text-3xl font-bold mt-1', somaLista > 0.004 ? 'text-amber-300' : 'text-emerald-300')}>{somaLista > 0.004 ? brl(somaLista) : 'Nada a pagar 🎉'}</p>
          {!venc && proximoSel && new Set(lista.filter(aPagar).map((l) => l.vencimento)).size > 1 && <p className="text-xs text-zinc-300 mt-2">Próximo vencimento: <b>{dataBR(proximoSel.data)}</b> · {brl(proximoSel.valor)}</p>}
          {pagosNoMes > 0 && <button onClick={() => setVerPagos(!verPagos)} className="text-xs text-emerald-400 font-semibold mt-2">{verPagos ? 'Esconder pagos' : `Ver pagos (${pagosNoMes})`}</button>}
        </div>

        {lista.length === 0 && <p className="p-4 text-sm text-zinc-500 bg-[#1a1a20] border border-white/5 rounded-2xl">Nada a pagar neste período. 🎉</p>}
        {/* Agrupado por vencimento: um título com o total de cada dia, as compras embaixo */}
        {grupos.map((g) => (
          <div key={g.data} className="bg-[#1a1a20] border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
              <p className="text-xs font-bold text-zinc-300">{g.cartao ? 'Vence' : 'Em'} {dataBR(g.data)}</p>
              <p className={cn('text-sm font-bold', g.total < 0 ? 'text-emerald-300' : 'text-white')}>{g.total < 0 ? `−${brl(-g.total)}` : brl(g.total)}</p>
            </div>
            <div className="divide-y divide-white/5">
              {g.itens.map((l, i) => {
                const pagamento = l.tipo === 'RECEITA', estorno = l.tipo === 'ESTORNO', pago = l.tipo === 'DESPESA' && !aPagar(l);
                const parcial = aPagar(l) && valorDe(l) < Number(l.valor) - 0.004;
                return (
                  <div key={i} className={cn('px-4 py-3 flex items-center gap-3', pago && 'opacity-50')}>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm break-words', pagamento ? 'text-emerald-300 font-semibold' : 'text-zinc-100')}>{pagamento ? `Pagamento recebido${l.descricao ? ` · ${l.descricao}` : ''}` : l.descricao}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{l.cartao ? `compra em ${dataBR(l.data)}` : (l.conta || '')}{estorno ? ' · estorno' : ''}{pago ? ' · ✓ pago' : ''}{parcial ? ` · falta ${brl(valorDe(l))}` : ''}</p>
                    </div>
                    <p className={cn('text-sm font-semibold whitespace-nowrap', pagamento || estorno ? 'text-emerald-300' : 'text-zinc-100')}>{pagamento || estorno ? '−' : ''}{brl(l.valor)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-[11px] text-zinc-600 text-center">Compras no cartão aparecem no mês em que a fatura vence. Link somente para consulta.</p>
      </div>
    </Tela>
  );
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f0f12] text-zinc-100">
      <div className="max-w-xl mx-auto px-4 py-6">
        <p className="text-sm font-bold mb-5 text-white">Milheiro<span className="text-emerald-400">Smart</span></p>
        {children}
      </div>
    </div>
  );
}

function Filtro({ icone, rotulo, valor, opcoes, escolhido, onEscolher, vazio, bloqueado }: {
  icone: React.ReactNode; rotulo: string; valor: string; opcoes: [string, string][]; escolhido: string; onEscolher: (v: string) => void; vazio?: string; bloqueado?: string;
}) {
  const [aberto, setAberto] = useState(false);
  // desabilitado (ex.: vencimento sem mês escolhido): mostra o motivo no lugar do valor
  if (bloqueado) return (
    <div className="h-12 w-full flex items-center gap-2 px-3 rounded-xl border border-white/5 bg-[#1a1a20]/50 opacity-60 cursor-not-allowed" title={bloqueado}>
      <span className="text-zinc-500">{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] uppercase tracking-wider text-zinc-600 font-bold leading-none">{rotulo}</span>
        <span className="block text-xs text-zinc-500 truncate mt-1">{bloqueado}</span>
      </span>
    </div>
  );
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button className={cn('h-12 w-full flex items-center gap-2 px-3 rounded-xl border text-left transition-colors', escolhido ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-[#1a1a20] border-white/10 hover:border-white/20')}>
          <span className={escolhido ? 'text-emerald-300' : 'text-zinc-400'}>{icone}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase tracking-wider text-zinc-500 font-bold leading-none">{rotulo}</span>
            <span className="block text-sm font-semibold text-white truncate mt-1">{valor}</span>
          </span>
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-1 bg-[#1a1a20] border-white/10 text-white max-h-72 overflow-y-auto">
        {opcoes.length <= 1 && vazio && <p className="px-3 py-2 text-xs text-zinc-500">{vazio}</p>}
        {opcoes.map(([v, texto]) => (
          <button key={v || 'todos'} onClick={() => { onEscolher(v); setAberto(false); }}
            className={cn('w-full h-10 px-3 flex items-center justify-between rounded-lg text-sm text-left hover:bg-white/5', v === escolhido && 'text-emerald-300 font-semibold')}>
            {texto}{v === escolhido && <Check className="w-4 h-4" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
