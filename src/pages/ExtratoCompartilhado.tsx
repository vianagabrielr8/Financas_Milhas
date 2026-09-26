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
  // abre no mês atual ('' = todos os meses)
  const mesAtual = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const [mes, setMesEstado] = useState<string>(mesAtual);
  const [venc, setVenc] = useState<string>(''); // vencimento do cartão: 'AAAA-MM-DD|Cartão' ('' = todos)
  const setMes = (m: string) => { setMesEstado(m); setVenc(''); };
  const [dados, setDados] = useState<Extrato | null>(null);
  const [estado, setEstado] = useState<'CARREGANDO' | 'OK' | 'INVALIDO' | 'ERRO'>('CARREGANDO');

  useEffect(() => {
    let vivo = true;
    setEstado((e) => (e === 'OK' ? 'OK' : 'CARREGANDO'));
    (supabase as any).rpc('extrato_compartilhado', { p_codigo: codigo, p_de: mes || null, p_ate: mes || null })
      .then(({ data, error }: { data: Extrato | null; error: unknown }) => {
        if (!vivo) return;
        if (error) { setEstado('ERRO'); return; }
        if (!data) { setEstado('INVALIDO'); return; }
        setDados(data); setEstado('OK');
        document.title = `Contas – ${data.titulo}`;
      });
    return () => { vivo = false; };
  }, [codigo, mes]);

  // meses com lançamento, do mais novo para o mais antigo
  const meses = useMemo(() => {
    // sempre inclui o mês atual, mesmo sem lançamento nele
    const ini = [dados?.primeiro_mes, mesAtual].filter(Boolean).sort()[0] as string;
    const fim = [dados?.ultimo_mes, mesAtual].filter(Boolean).sort().at(-1) as string;
    const l: string[] = [];
    for (let m = fim; m >= ini && l.length < 36; m = somar(m, -1)) l.push(m);
    return l;
  }, [dados?.primeiro_mes, dados?.ultimo_mes, mesAtual]);

  // vencimentos de cartão do período, só pelo dia (cartões que vencem no mesmo dia ficam juntos)
  const vencimentos = useMemo(() => Array.from(new Set((dados?.lancamentos || [])
    .filter((l) => l.cartao && l.tipo !== 'RECEITA').map((l) => l.vencimento))).sort(), [dados?.lancamentos]);
  const lista = (dados?.lancamentos || []).filter((l) => !venc || (l.cartao && l.vencimento === venc));
  const filtrado = !!mes || !!venc;
  // grupos por dia de vencimento (conta bancária: pelo dia do lançamento), do mais novo ao mais antigo
  const grupos = (() => {
    const m = new Map<string, { data: string; cartao: boolean; total: number; itens: Lanc[] }>();
    for (const l of lista) {
      const g = m.get(l.vencimento) || { data: l.vencimento, cartao: false, total: 0, itens: [] };
      g.cartao = g.cartao || !!l.cartao;
      g.total += (l.tipo === 'DESPESA' ? 1 : -1) * Number(l.valor);
      g.itens.push(l);
      m.set(l.vencimento, g);
    }
    return Array.from(m.values()).sort((a, b) => b.data.localeCompare(a.data));
  })();
  const somaLista = lista.reduce((a, l) => a + (l.tipo === 'DESPESA' ? Number(l.valor) : l.tipo === 'ESTORNO' ? -Number(l.valor) : 0), 0);
  const pagoLista = lista.reduce((a, l) => a + (l.tipo === 'RECEITA' ? Number(l.valor) : 0), 0);

  if (estado === 'CARREGANDO' && !dados) return <Tela><p className="text-zinc-400 text-sm">Carregando...</p></Tela>;
  if (estado === 'INVALIDO') return <Tela><p className="text-zinc-300">Este link não existe ou foi desativado.</p><p className="text-zinc-500 text-sm mt-1">Peça um link novo para quem te enviou.</p></Tela>;
  if (estado === 'ERRO' || !dados) return <Tela><p className="text-zinc-300">Não consegui carregar agora. Tente de novo em instantes.</p></Tela>;

  const deve = dados.total_lancado - dados.total_pago;
  return (
    <Tela>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Resumo de gastos</p>
          <h1 className="text-2xl font-bold text-white">{dados.titulo}</h1>
        </div>

        <div className={cn('rounded-2xl p-5 border', deve > 0.004 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30')}>
          <p className="text-sm text-zinc-300">{deve > 0.004 ? 'Em aberto hoje' : 'Tudo certo'}</p>
          <p className={cn('text-3xl font-bold mt-1', deve > 0.004 ? 'text-amber-300' : 'text-emerald-300')}>{deve > 0.004 ? brl(deve) : deve < -0.004 ? `${brl(-deve)} a seu favor` : 'Nada em aberto 🎉'}</p>
          <p className="text-xs text-zinc-400 mt-2">Total lançado {brl(dados.total_lancado)} · já pago {brl(dados.total_pago)}</p>
        </div>

        {/* Filtros: mês e vencimento do cartão, cada um abre sua lista */}
        <div className="grid grid-cols-2 gap-2">
          <Filtro icone={<CalendarDays className="w-4 h-4" />} rotulo="Mês" valor={mes ? rotulo(mes) : 'Todos'}
            opcoes={[['', 'Todos'], ...meses.map((m) => [m, `${MESES_LONGOS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`] as [string, string])]}
            escolhido={mes} onEscolher={setMes} />
          <Filtro icone={<CreditCard className="w-4 h-4" />} rotulo="Vencimento" valor={venc ? `dia ${dataBR(venc).slice(0, 5)}` : 'Todos'}
            opcoes={[['', 'Todos'], ...vencimentos.map((v) => [v, `Vence ${dataBR(v)}`] as [string, string])]}
            escolhido={venc} onEscolher={setVenc} vazio="Nenhuma compra no cartão neste mês"
            bloqueado={!mes ? 'Escolha um mês primeiro' : undefined} />
        </div>

        {filtrado && (
          <div className="flex items-center justify-between gap-2 text-xs bg-[#1a1a20] border border-white/5 rounded-xl px-3 py-2.5">
            <span className="text-zinc-400">{venc ? `A pagar no vencimento ${dataBR(venc).slice(0, 5)}` : 'Neste mês'}: <b className="text-white">{brl(somaLista)}</b>{pagoLista > 0 && <> · pago <b className="text-emerald-300">{brl(pagoLista)}</b></>}</span>
            <button onClick={() => { setMes(''); setVenc(''); }} className="text-emerald-400 font-semibold shrink-0">Limpar</button>
          </div>
        )}

        {lista.length === 0 && <p className="p-4 text-sm text-zinc-500 bg-[#1a1a20] border border-white/5 rounded-2xl">Nenhum lançamento neste período.</p>}
        {/* Agrupado por vencimento: um título com o total de cada dia, as compras embaixo */}
        {grupos.map((g) => (
          <div key={g.data} className="bg-[#1a1a20] border border-white/5 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/5">
              <p className="text-xs font-bold text-zinc-300">{g.cartao ? 'Vence' : 'Em'} {dataBR(g.data)}</p>
              <p className={cn('text-sm font-bold', g.total < 0 ? 'text-emerald-300' : 'text-white')}>{g.total < 0 ? `−${brl(-g.total)}` : brl(g.total)}</p>
            </div>
            <div className="divide-y divide-white/5">
              {g.itens.map((l, i) => {
                const pagamento = l.tipo === 'RECEITA', estorno = l.tipo === 'ESTORNO';
                return (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm break-words', pagamento ? 'text-emerald-300 font-semibold' : 'text-zinc-100')}>{pagamento ? `Pagamento recebido${l.descricao ? ` · ${l.descricao}` : ''}` : l.descricao}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{l.cartao ? `compra em ${dataBR(l.data)}` : (l.conta || '')}{estorno ? ' · estorno' : ''}</p>
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
