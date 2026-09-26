import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, Landmark, CalendarDays } from 'lucide-react';
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
  const [mes, setMesEstado] = useState<string>(''); // '' = tudo
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
      });
    return () => { vivo = false; };
  }, [codigo, mes]);

  // meses com lançamento, do mais novo para o mais antigo
  const meses = useMemo(() => {
    if (!dados?.primeiro_mes || !dados.ultimo_mes) return [];
    const l: string[] = [];
    for (let m = dados.ultimo_mes; m >= dados.primeiro_mes && l.length < 36; m = somar(m, -1)) l.push(m);
    return l;
  }, [dados?.primeiro_mes, dados?.ultimo_mes]);

  // vencimentos de cartão presentes no período (para o 2º filtro)
  const vencimentos = useMemo(() => {
    const m = new Map<string, { data: string; cartao: string; total: number }>();
    for (const l of dados?.lancamentos || []) {
      if (!l.cartao || l.tipo === 'RECEITA') continue;
      const k = `${l.vencimento}|${l.cartao}`;
      const x = m.get(k) || { data: l.vencimento, cartao: l.cartao, total: 0 };
      x.total += l.tipo === 'ESTORNO' ? -Number(l.valor) : Number(l.valor);
      m.set(k, x);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].data.localeCompare(b[1].data));
  }, [dados?.lancamentos]);
  const lista = (dados?.lancamentos || []).filter((l) => !venc || `${l.vencimento}|${l.cartao}` === venc);
  const vencEscolhido = vencimentos.find(([k]) => k === venc)?.[1];

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

        {/* Período: o único filtro que a pessoa escolhe */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <Chip ativo={!mes} onClick={() => setMes('')}>Tudo</Chip>
          {meses.map((m) => <Chip key={m} ativo={mes === m} onClick={() => setMes(m)}>{rotulo(m)}</Chip>)}
        </div>

        {/* Vencimento do cartão: mostra só o que cai numa fatura */}
        {vencimentos.length > 0 && (
          <div>
            <p className="text-[11px] text-zinc-500 mb-1.5">Vencimento do cartão</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <Chip ativo={!venc} onClick={() => setVenc('')}>Todos</Chip>
              {vencimentos.map(([k, v]) => <Chip key={k} ativo={venc === k} onClick={() => setVenc(k)}>{dataBR(v.data).slice(0, 5)} · {v.cartao}</Chip>)}
            </div>
          </div>
        )}

        {vencEscolhido && (
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-3">
            <p className="text-[11px] text-zinc-300">Fatura {vencEscolhido.cartao} que vence em {dataBR(vencEscolhido.data)}</p>
            <p className="text-xl font-bold text-violet-200">{brl(vencEscolhido.total)}</p>
          </div>
        )}

        {mes && !venc && (
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#1a1a20] border border-white/5 rounded-xl p-3"><p className="text-[11px] text-zinc-400">Lançado em {MESES_LONGOS[Number(mes.slice(5, 7)) - 1]}</p><p className="font-bold text-white">{brl(dados.periodo_lancado)}</p></div>
            <div className="bg-[#1a1a20] border border-white/5 rounded-xl p-3"><p className="text-[11px] text-zinc-400">Pago em {MESES_LONGOS[Number(mes.slice(5, 7)) - 1]}</p><p className="font-bold text-emerald-300">{brl(dados.periodo_pago)}</p></div>
          </div>
        )}

        <div className="bg-[#1a1a20] border border-white/5 rounded-2xl divide-y divide-white/5">
          {lista.length === 0 && <p className="p-4 text-sm text-zinc-500">Nenhum lançamento neste período.</p>}
          {lista.map((l, i) => {
            const pagamento = l.tipo === 'RECEITA', estorno = l.tipo === 'ESTORNO';
            return (
              <div key={i} className="p-3.5 flex items-start gap-3">
                <div className={cn('mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0', pagamento ? 'bg-emerald-500/15 text-emerald-300' : l.cartao ? 'bg-violet-500/15 text-violet-300' : 'bg-sky-500/15 text-sky-300')}>
                  {l.cartao ? <CreditCard className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white break-words">{pagamento ? `Pagamento recebido${l.descricao ? ` · ${l.descricao}` : ''}` : l.descricao}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {l.cartao
                      ? <>Compra em {dataBR(l.data)} · 💳 {l.cartao} · <b className="text-zinc-200">vence {dataBR(l.vencimento)}</b></>
                      : <><CalendarDays className="w-3 h-3 inline -mt-0.5" /> {dataBR(l.data)}{l.conta ? ` · ${l.conta}` : ''}</>}
                  </p>
                </div>
                <p className={cn('text-sm font-bold whitespace-nowrap', pagamento || estorno ? 'text-emerald-300' : 'text-white')}>{pagamento || estorno ? '−' : ''}{brl(l.valor)}</p>
              </div>
            );
          })}
        </div>
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

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors', ativo ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-[#1a1a20] text-zinc-300 border-white/10 hover:border-white/20')}>
      {children}
    </button>
  );
}
