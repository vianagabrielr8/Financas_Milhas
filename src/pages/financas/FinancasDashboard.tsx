import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Landmark, ArrowUpCircle, ArrowDownCircle, Calendar, Layers, BarChart3, AlertTriangle, Wallet,
  PiggyBank, Percent, CreditCard, Users, Gauge, Lightbulb, ShieldCheck, ChevronDown, ChevronRight,
  Flame, Info, TrendingUp, CalendarClock, Grid3X3, Eye,
} from 'lucide-react';

/* =====================================================================================
   CONFIGURAÇÃO — tudo que depende do seu banco/negócio fica aqui em cima.
   Itens marcados com ⚠️ CONFIRMAR são nomes que não aparecem no código antigo.
   Se estiverem errados o dashboard NÃO quebra: só aquele bloco fica sem dados.
   ===================================================================================== */
const CONFIG = {
  centroPrincipal: 'Familiar',
  centroTerceiros: 'Terceiros',
  centroReembolsos: 'Reembolsos/Giro Cartão',
  // trechos do nome da categoria (sem acento, minúsculo)
  categoriasDivida: ['emprestimo', 'juros'],
  categoriasInvestimento: ['investimento'],
  // tipos de lançamento que NÃO são receita nem gasto (mudança de lugar do dinheiro)
  tiposNeutros: ['TRANSFERENCIA', 'PAGAMENTO_FATURA', 'PAGAMENTO FATURA', 'PAGAMENTO DE FATURA'],

  // ⚠️ CONFIRMAR no Supabase
  tabelaCartoes: 'cartao_credito',
  cartaoCampoNome: 'nome',
  cartaoCampoMelhorDia: 'melhor_dia_compra',
  cartaoCampoLimite: 'limite_total',
  tabelaSubcategorias: 'subcategoria_pessoal',
  transacaoCampoSubcategoria: 'subcategoria_id',
  transacaoCampoDescricao: 'descricao',

  mesesJanela: 12, // histórico usado em médias, gráficos e heatmap
  mesesFuturos: 6, // faturas futuras (parcelas já compradas)
  anomaliaPct: 0.3, // +30% acima da média de 3 meses = alerta
  anomaliaMinimoReais: 100, // abaixo disso não alerta (evita ruído)
};

const db = supabase as any;
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const PALETA = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#14b8a6', '#f43f5e', '#84cc16', '#a855f7', '#0ea5e9'];
const VERDE = '#10b981';
const VERMELHO = '#ef4444';
const AMARELO = '#f59e0b';
const AZUL = '#3b82f6';
const TODOS = 'Todos os centros';

/* ------------------------------- utilitários ------------------------------- */
const semAcento = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s?: string | null) => semAcento(s || '').toLowerCase().trim();
const TIPOS_NEUTROS = new Set(CONFIG.tiposNeutros.map((t) => semAcento(t).toUpperCase()));

const brl = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlCurto = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}mi`;
  if (a >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
};
const pct = (v: number | null | undefined, casas = 1) =>
  v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const dataBR = (d?: string | null) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');

// cor fixa por nome: a categoria mantém a mesma cor todo mês
const corDoNome = (nome: string) => {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
};

const somarMeses = (chave: string, n: number) => {
  const [a, m] = chave.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const ultimoDia = (chave: string) => {
  const [a, m] = chave.split('-').map(Number);
  return new Date(a, m, 0).getDate();
};
const chaveParaFatura = (chave: string) => {
  const [a, m] = chave.split('-').map(Number);
  return `${MESES[m - 1]}/${a}`;
};
const faturaParaChave = (f?: string | null): string | null => {
  if (!f) return null;
  const [mStr, aStr] = String(f).split('/');
  const idx = MESES.findIndex((x) => norm(x) === norm(mStr).slice(0, 3));
  if (idx < 0 || !aStr) return null;
  return `${aStr.trim()}-${String(idx + 1).padStart(2, '0')}`;
};
const rotuloMes = (chave: string) => {
  const [a, m] = chave.split('-').map(Number);
  return `${MESES[m - 1]}/${String(a).slice(2)}`;
};
const rotuloMesLongo = (chave: string) => {
  const [a, m] = chave.split('-').map(Number);
  return `${MESES_LONGOS[m - 1]} de ${a}`;
};

// dias até a fatura fechar se eu comprar HOJE (fechamento = véspera do "melhor dia de compra")
const diasAteFechar = (melhorDia: number, hoje: Date) => {
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  const d = hoje.getDate();
  const clamp = (ano: number, mes: number, dia: number) => Math.min(dia, new Date(ano, mes + 1, 0).getDate());
  const melhorEsteMes = clamp(y, m, melhorDia);
  const base = new Date(y, d >= melhorEsteMes ? m + 1 : m, 1);
  const fechamento = new Date(base.getFullYear(), base.getMonth(), clamp(base.getFullYear(), base.getMonth(), melhorDia) - 1);
  return Math.round((fechamento.getTime() - new Date(y, m, d).getTime()) / 86400000);
};

// Supabase devolve no máximo 1000 linhas por consulta — aqui buscamos em páginas até acabar
async function buscarPaginado(montar: () => any): Promise<any[]> {
  const TAM = 1000;
  const out: any[] = [];
  for (let de = 0; de < 100000; de += TAM) {
    const { data, error } = await montar().range(de, de + TAM - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < TAM) break;
  }
  return out;
}
// tabela opcional: se não existir, devolve vazio sem derrubar a tela
async function buscarOpcional(tabela: string): Promise<any[]> {
  try {
    const { data, error } = await db.from(tabela).select('*');
    return error ? [] : data || [];
  } catch {
    return [];
  }
}

type Mes = {
  receita: number;
  consumo: number;
  investimento: number;
  divida: number;
  cartao: number;
  foraConsumo: number;
  porCat: Record<string, number>;
  porSub: Record<string, Record<string, number>>;
  porCartao: Record<string, number>;
  txs: any[];
};
const novoMes = (): Mes => ({ receita: 0, consumo: 0, investimento: 0, divida: 0, cartao: 0, foraConsumo: 0, porCat: {}, porSub: {}, porCartao: {}, txs: [] });
const temDados = (m?: Mes | null): m is Mes => !!m && (Math.abs(m.consumo) > 0.004 || m.receita > 0);

/* ------------------------------- componentes visuais ------------------------------- */
function Dica({ texto }: { texto: string }) {
  return (
    <span className="relative group inline-flex align-middle">
      <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-5 z-50 hidden group-hover:block w-64 rounded-lg border border-white/10 bg-[#0f0f12] p-3 text-[11px] font-normal leading-relaxed text-zinc-300 shadow-xl">
        {texto}
      </span>
    </span>
  );
}

function Variacao({ atual, referencia, sobeEhBom, rotulo }: { atual: number; referencia: number | null; sobeEhBom: boolean; rotulo: string }) {
  if (referencia == null || Math.abs(referencia) < 0.01) return <p className="text-[10px] text-zinc-500 mt-1">sem base de comparação</p>;
  const v = (atual - referencia) / Math.abs(referencia);
  const neutro = Math.abs(v) < 0.005;
  const bom = sobeEhBom ? v >= 0 : v <= 0;
  return (
    <p className={`text-[10px] mt-1 font-semibold ${neutro ? 'text-zinc-400' : bom ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
      {v >= 0 ? '▲' : '▼'} {pct(Math.abs(v))} <span className="text-zinc-500 font-normal">vs {rotulo}</span>
    </p>
  );
}

function CardKpi({ titulo, valor, corValor, icone: Icone, corIcone, dica, sub, children }: any) {
  return (
    <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <p className="text-zinc-400 text-xs font-medium mb-1 flex items-center gap-1.5">
            {titulo} {dica && <Dica texto={dica} />}
          </p>
          <p className="text-xl font-bold truncate" style={{ color: corValor }}>{valor}</p>
          {sub && <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>}
          {children}
        </div>
        <div className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: `${corIcone}1a` }}>
          <Icone className="w-4 h-4" style={{ color: corIcone }} />
        </div>
      </div>
    </div>
  );
}

function Bloco({ titulo, icone: Icone, corIcone, dica, children, className = '', extra }: any) {
  return (
    <div className={`bg-[#1e1e24] border border-white/5 rounded-2xl p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Icone className="w-4 h-4" style={{ color: corIcone }} /> {titulo} {dica && <Dica texto={dica} />}
        </h3>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Sparkline({ valores, cor }: { valores: number[]; cor: string }) {
  const w = 72;
  const h = 22;
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const pts = valores.map((v, i) => `${(i / Math.max(valores.length - 1, 1)) * w},${h - ((v - min) / (max - min || 1)) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible">
      <polyline points={pts} fill="none" stroke={cor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-zinc-500 text-xs text-center py-6">{texto}</p>;
}

/* ===================================================================================== */
export default function FinancasDashboard() {
  const hoje = useMemo(() => new Date(), []);
  const chaveHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  const [mesSel, setMesSel] = useState(chaveHoje);
  const [filtroCentro, setFiltroCentro] = useState<string>(CONFIG.centroPrincipal);
  const [visao, setVisao] = useState<'fatura' | 'compra'>('fatura');
  const [comparar, setComparar] = useState<'media3' | 'anterior'>('media3');
  const [catAberta, setCatAberta] = useState<string | null>(null);

  const mesesJanela = useMemo(
    () => Array.from({ length: CONFIG.mesesJanela }, (_, i) => somarMeses(mesSel, i - (CONFIG.mesesJanela - 1))),
    [mesSel],
  );
  const mesesFuturos = useMemo(() => Array.from({ length: CONFIG.mesesFuturos }, (_, i) => somarMeses(mesSel, i + 1)), [mesSel]);

  /* ------------------------------- buscas ------------------------------- */
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['dash_centros'],
    queryFn: async () => {
      const { data } = await db.from('centro_custo_projeto').select('id, nome').order('nome');
      return data || [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['dash_categorias'],
    queryFn: async () => {
      const { data } = await db.from('categoria_pessoal').select('*');
      return data || [];
    },
  });

  const { data: subcategorias = [] } = useQuery({ queryKey: ['dash_subcategorias'], queryFn: () => buscarOpcional(CONFIG.tabelaSubcategorias) });
  const { data: cartoes = [] } = useQuery({ queryKey: ['dash_cartoes'], queryFn: () => buscarOpcional(CONFIG.tabelaCartoes) });

  // 12 meses de uma vez: serve para o mês, as comparações, as médias e os gráficos
  const { data: transacoes = [], isLoading, error } = useQuery({
    queryKey: ['dash_transacoes', mesesJanela[0], mesSel],
    queryFn: () => {
      const ini = `${mesesJanela[0]}-01`;
      const fim = `${mesSel}-${String(ultimoDia(mesSel)).padStart(2, '0')}`;
      const faturas = mesesJanela.map((k) => `"${chaveParaFatura(k)}"`).join(',');
      return buscarPaginado(() =>
        db
          .from('transacao_pessoal')
          .select('*, centro_custo_projeto(nome)')
          .or(`and(data.gte.${ini},data.lte.${fim}),mes_fatura.in.(${faturas})`)
          .order('data', { ascending: false })
          .order('id', { ascending: true }),
      );
    },
  });

  // parcelas já lançadas em faturas futuras
  const { data: futuras = [] } = useQuery({
    queryKey: ['dash_futuras', mesSel],
    queryFn: () =>
      buscarPaginado(() =>
        db
          .from('transacao_pessoal')
          .select('id, valor, tipo, cartao_id, mes_fatura')
          .not('cartao_id', 'is', null)
          .in('mes_fatura', mesesFuturos.map(chaveParaFatura))
          .order('id', { ascending: true }),
      ),
  });

  const mapaNomes = useMemo(() => {
    const m = new Map<string, string>();
    [...categorias, ...subcategorias].forEach((c: any) => {
      if (c?.id != null) m.set(String(c.id), c.nome ?? c.name ?? 'Sem nome');
    });
    return m;
  }, [categorias, subcategorias]);

  const mapaCartoes = useMemo(() => {
    const m = new Map<string, { nome: string; melhorDia: number | null; limite: number | null }>();
    cartoes.forEach((c: any) =>
      m.set(String(c.id), {
        nome: c[CONFIG.cartaoCampoNome] ?? 'Cartão',
        melhorDia: Number(c[CONFIG.cartaoCampoMelhorDia]) || null,
        limite: Number(c[CONFIG.cartaoCampoLimite]) || null,
      }),
    );
    return m;
  }, [cartoes]);

  /* ------------------------------- cálculos ------------------------------- */
  const A = useMemo(() => {
    const nomeDe = (id: any) => (id != null && id !== '' ? mapaNomes.get(String(id)) ?? 'A Classificar' : 'A Classificar');

    // em qual mês a transação cai, conforme a visão escolhida
    const chaveDaTx = (t: any): string | null => {
      if (visao === 'fatura' && t.cartao_id) {
        const k = faturaParaChave(t.mes_fatura);
        if (k) return k;
      }
      return t.data ? String(t.data).slice(0, 7) : null;
    };

    const porMes: Record<string, Mes> = {};
    mesesJanela.forEach((k) => (porMes[k] = novoMes()));
    const terceiros: Record<string, { lancado: number; recebido: number }> = {};
    const reembolsos = { lancado: 0, recebido: 0 };
    const q = { totalDespesas: 0, valorDespesas: 0, semCategoria: 0, valorSemCategoria: 0, semCentro: 0, semSub: 0, duplicadas: 0 };
    const assinaturas = new Map<string, number>();
    const temCampoSub = (transacoes as any[]).some((t) => CONFIG.transacaoCampoSubcategoria in t);

    for (const t of transacoes as any[]) {
      const k = chaveDaTx(t);
      if (!k || !porMes[k]) continue;
      const centro: string = t.centro_custo_projeto?.nome || 'Sem Centro';
      const val = Math.abs(Number(t.valor) || 0);
      const tipo = semAcento(String(t.tipo || 'DESPESA')).toUpperCase().trim();
      if (TIPOS_NEUTROS.has(tipo)) continue;
      const entrada = tipo === 'RECEITA';
      const estorno = tipo === 'ESTORNO';
      const cat = nomeDe(t.categoria_id);
      const catN = norm(cat);
      const ehTerceiros = norm(centro) === norm(CONFIG.centroTerceiros);
      const ehReemb = norm(centro) === norm(CONFIG.centroReembolsos);

      // Terceiros e Reembolsos são sempre acompanhados (independem do filtro)
      if (ehTerceiros) {
        const p = (terceiros[cat] ??= { lancado: 0, recebido: 0 });
        if (entrada || estorno) p.recebido += val;
        else p.lancado += val;
      }
      if (ehReemb) {
        if (entrada || estorno) reembolsos.recebido += val;
        else reembolsos.lancado += val;
      }
      if (k === mesSel && centro === 'Sem Centro') q.semCentro++;

      if (filtroCentro !== TODOS && centro !== filtroCentro) continue;
      const m = porMes[k];
      const foraConsumo = filtroCentro === TODOS && (ehTerceiros || ehReemb);

      // qualidade dos dados (mês selecionado)
      if (k === mesSel && !entrada) {
        q.totalDespesas++;
        q.valorDespesas += val;
        if (cat === 'A Classificar') {
          q.semCategoria++;
          q.valorSemCategoria += val;
        }
        if (temCampoSub && !t[CONFIG.transacaoCampoSubcategoria]) q.semSub++;
        const ass = [t.data, val.toFixed(2), norm(String(t[CONFIG.transacaoCampoDescricao] ?? '')), t.cartao_id ?? '', t.mes_fatura ?? ''].join('|');
        const n = (assinaturas.get(ass) ?? 0) + 1;
        assinaturas.set(ass, n);
        if (n === 2) q.duplicadas++;
      }

      if (entrada) {
        if (!foraConsumo) m.receita += val;
        continue;
      }
      const v = estorno ? -val : val;
      if (foraConsumo) {
        m.foraConsumo += v;
        continue;
      }
      if (CONFIG.categoriasInvestimento.some((p) => catN.includes(p))) {
        m.investimento += v;
        continue;
      }
      m.consumo += v;
      if (CONFIG.categoriasDivida.some((p) => catN.includes(p))) m.divida += v;
      if (t.cartao_id) {
        m.cartao += v;
        m.porCartao[t.cartao_id] = (m.porCartao[t.cartao_id] ?? 0) + v;
      }
      m.porCat[cat] = (m.porCat[cat] ?? 0) + v;
      const subId = t[CONFIG.transacaoCampoSubcategoria];
      const sub = subId ? mapaNomes.get(String(subId)) ?? 'Subcategoria sem nome' : 'Sem subcategoria';
      const ps = (m.porSub[cat] ??= {});
      ps[sub] = (ps[sub] ?? 0) + v;
      m.txs.push({ ...t, _cat: cat, _valor: v });
    }

    const atual = porMes[mesSel];
    const anteriorBruto = porMes[somarMeses(mesSel, -1)];
    const anterior = temDados(anteriorBruto) ? anteriorBruto : null;
    const ultimos3 = [1, 2, 3].map((i) => porMes[somarMeses(mesSel, -i)]).filter(temDados);
    const media = (f: (m: Mes) => number) => (ultimos3.length ? ultimos3.reduce((s, m) => s + f(m), 0) / ultimos3.length : null);
    const ref = (f: (m: Mes) => number) => (comparar === 'anterior' ? (anterior ? f(anterior) : null) : media(f));

    // projeção e ritmo (só faz sentido no mês corrente)
    const ehMesCorrente = mesSel === chaveHoje;
    const diasMes = ultimoDia(mesSel);
    const diaHoje = hoje.getDate();
    const naoCartao = atual.consumo - atual.cartao;
    const projecao = ehMesCorrente
      ? visao === 'compra'
        ? (atual.consumo / diaHoje) * diasMes
        : atual.cartao + (naoCartao / diaHoje) * diasMes
      : atual.consumo;
    const refConsumo = media((m) => m.consumo);
    const diasRestantes = ehMesCorrente ? diasMes - diaHoje + 1 : 0;
    const podePorDia = ehMesCorrente && refConsumo != null ? (refConsumo - atual.consumo) / diasRestantes : null;
    const ritmoIdeal = ehMesCorrente && refConsumo != null ? (refConsumo * diaHoje) / diasMes : null;

    // categorias
    const nomesCat = new Set<string>([...Object.keys(atual.porCat), ...ultimos3.flatMap((m) => Object.keys(m.porCat))]);
    const ult6 = Array.from({ length: 6 }, (_, i) => somarMeses(mesSel, i - 5));
    const linhasCat = [...nomesCat]
      .map((nome) => {
        const valor = atual.porCat[nome] ?? 0;
        const ant = anterior?.porCat[nome] ?? 0;
        const med = ultimos3.length ? ultimos3.reduce((s, m) => s + (m.porCat[nome] ?? 0), 0) / ultimos3.length : null;
        const base = comparar === 'anterior' ? (anterior ? ant : null) : med;
        const serie = ult6.map((k) => porMes[k]?.porCat[nome] ?? 0);
        const anomalia = med != null && med > 0 && valor > med * (1 + CONFIG.anomaliaPct) && valor - med >= CONFIG.anomaliaMinimoReais;
        const novo = ultimos3.length > 0 && (med == null || med === 0) && valor >= CONFIG.anomaliaMinimoReais;
        return { nome, valor, ant, med, base, serie, anomalia, novo, pct: atual.consumo > 0 ? valor / atual.consumo : null, cor: corDoNome(nome) };
      })
      .filter((r) => Math.abs(r.valor) > 0.004 || (r.med ?? 0) > 0)
      .sort((a, b) => b.valor - a.valor);

    // evolução e heatmap
    const evolucao = mesesJanela.map((k) => ({
      k,
      receita: porMes[k].receita,
      consumo: porMes[k].consumo,
      investimento: porMes[k].investimento,
      resultado: porMes[k].receita - porMes[k].consumo,
    }));
    const totais12: Record<string, number> = {};
    mesesJanela.forEach((k) => Object.entries(porMes[k].porCat).forEach(([c, v]) => (totais12[c] = (totais12[c] ?? 0) + v)));
    const heatCats = Object.entries(totais12)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([c]) => c);

    // cartões
    const porCartao = Object.entries(atual.porCartao)
      .map(([id, valor]) => {
        const c = mapaCartoes.get(String(id));
        return {
          id,
          nome: c?.nome ?? `Cartão ${String(id).slice(0, 6)}`,
          valor,
          share: atual.cartao > 0 ? valor / atual.cartao : null,
          limite: c?.limite ?? null,
          uso: c?.limite ? valor / c.limite : null,
        };
      })
      .filter((x) => x.valor > 0)
      .sort((a, b) => b.valor - a.valor);
    const cartaoDaVez = [...mapaCartoes.entries()]
      .filter(([, c]) => c.melhorDia)
      .map(([id, c]) => ({ id, nome: c.nome, melhorDia: c.melhorDia as number, dias: diasAteFechar(c.melhorDia as number, hoje) }))
      .sort((a, b) => b.dias - a.dias);
    const futurasPorMes = mesesFuturos.map((k) => {
      let v = 0;
      for (const t of futuras as any[]) {
        if (faturaParaChave(t.mes_fatura) !== k) continue;
        const tipo = semAcento(String(t.tipo || 'DESPESA')).toUpperCase().trim();
        if (TIPOS_NEUTROS.has(tipo) || tipo === 'RECEITA') continue;
        const val = Math.abs(Number(t.valor) || 0);
        v += tipo === 'ESTORNO' ? -val : val;
      }
      return { k, v };
    });

    // terceiros
    const listaTerceiros = Object.entries(terceiros)
      .map(([pessoa, p]) => ({ pessoa, ...p, saldo: p.lancado - p.recebido }))
      .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
    const saldoTerceiros = listaTerceiros.reduce((s, p) => s + p.saldo, 0);
    const saldoReembolsos = reembolsos.lancado - reembolsos.recebido;

    // insights em linguagem simples
    const rotulo = rotuloMesLongo(mesSel);
    const ins: { txt: string; tipo: 'alerta' | 'bom' | 'info'; peso: number }[] = [];
    if (atual.receita === 0 && filtroCentro !== CONFIG.centroTerceiros)
      ins.push({ tipo: 'alerta', peso: 1e12, txt: `Nenhuma receita lançada em ${rotulo}. Sem ela, "Resultado" e "Taxa de poupança" não significam nada — lance salários e retiradas primeiro.` });
    const comMedia = linhasCat.filter((r) => r.med != null && r.med > 0).map((r) => ({ ...r, dif: r.valor - (r.med as number) }));
    const alta = [...comMedia].sort((a, b) => b.dif - a.dif)[0];
    if (alta && alta.dif >= CONFIG.anomaliaMinimoReais)
      ins.push({ tipo: 'alerta', peso: alta.dif, txt: `${alta.nome}: ${brl(alta.valor)} este mês — ${pct(alta.dif / (alta.med as number), 0)} acima da sua média de 3 meses (+${brl(alta.dif)}).` });
    const queda = [...comMedia].sort((a, b) => a.dif - b.dif)[0];
    if (queda && queda.dif <= -CONFIG.anomaliaMinimoReais)
      ins.push({ tipo: 'bom', peso: -queda.dif / 2, txt: `${queda.nome} caiu ${brl(-queda.dif)} em relação à sua média de 3 meses.` });
    if (atual.consumo > 0 && atual.divida / atual.consumo >= 0.1) {
      const alim = linhasCat.find((r) => norm(r.nome).includes('alimenta'));
      const equiv = alim && alim.valor > 0 ? ` Isso é ${(atual.divida / alim.valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x o que foi gasto com Alimentação.` : '';
      ins.push({ tipo: 'alerta', peso: atual.divida, txt: `Empréstimos e juros levaram ${pct(atual.divida / atual.consumo)} de tudo que foi gasto (${brl(atual.divida)}).${equiv}` });
    }
    if (ehMesCorrente && refConsumo) {
      if (projecao > refConsumo * 1.05)
        ins.push({ tipo: 'alerta', peso: projecao - refConsumo, txt: `No ritmo atual o mês fecha perto de ${brl(projecao)} — ${brl(projecao - refConsumo)} acima da sua média.` });
      else if (projecao < refConsumo * 0.95)
        ins.push({ tipo: 'bom', peso: (refConsumo - projecao) / 2, txt: `No ritmo atual o mês fecha perto de ${brl(projecao)} — ${brl(refConsumo - projecao)} abaixo da sua média.` });
    }
    if (porCartao[0] && (porCartao[0].share ?? 0) >= 0.5)
      ins.push({ tipo: 'info', peso: 1, txt: `${pct(porCartao[0].share)} dos gastos no cartão passaram pelo ${porCartao[0].nome}.` });
    if (Math.abs(saldoTerceiros) >= 1)
      ins.push({ tipo: 'alerta', peso: Math.abs(saldoTerceiros), txt: `Terceiros não está zerado: ${saldoTerceiros > 0 ? 'falta receber' : 'foi recebido a mais'} ${brl(Math.abs(saldoTerceiros))} (últimos 12 meses).` });
    if (q.semCategoria > 0)
      ins.push({ tipo: 'alerta', peso: q.valorSemCategoria, txt: `${q.semCategoria} lançamento(s) sem categoria somando ${brl(q.valorSemCategoria)}. Enquanto não classificar, os números acima ficam incompletos.` });
    if (atual.investimento > 0)
      ins.push({ tipo: 'bom', peso: atual.investimento / 2, txt: `Você investiu ${brl(atual.investimento)} este mês${atual.receita > 0 ? ` (${pct(atual.investimento / atual.receita)} do que entrou)` : ''}.` });
    const ordemTipo = { alerta: 0, bom: 1, info: 2 };
    const insights = ins.sort((a, b) => ordemTipo[a.tipo] - ordemTipo[b.tipo] || b.peso - a.peso).slice(0, 6);

    return {
      porMes, atual, anterior, ultimos3, ref, media, ehMesCorrente, diasMes, diaHoje, projecao, refConsumo, diasRestantes, podePorDia,
      ritmoIdeal, linhasCat, evolucao, heatCats, porCartao, cartaoDaVez, futurasPorMes, listaTerceiros, saldoTerceiros, reembolsos,
      saldoReembolsos, q, insights, temCampoSub,
    };
  }, [transacoes, futuras, mapaNomes, mapaCartoes, visao, filtroCentro, comparar, mesSel, mesesJanela, mesesFuturos, chaveHoje, hoje]);

  const { atual } = A;
  const rotuloComp = comparar === 'anterior' ? 'mês anterior' : 'média 3 meses';
  const resultado = atual.receita - atual.consumo;
  const taxaPoupanca = atual.receita > 0 ? resultado / atual.receita : null;
  const pesoDivida = atual.consumo > 0 ? atual.divida / atual.consumo : null;
  const corPoupanca = taxaPoupanca == null ? '#a1a1aa' : taxaPoupanca >= 0.2 ? VERDE : taxaPoupanca >= 0.1 ? AMARELO : taxaPoupanca >= 0 ? '#fb923c' : VERMELHO;
  const corDivida = pesoDivida == null ? '#a1a1aa' : pesoDivida <= 0.1 ? VERDE : pesoDivida <= 0.25 ? AMARELO : VERMELHO;
  const maxCat = Math.max(...A.linhasCat.map((r) => r.valor), 1);
  const maxEvol = Math.max(...A.evolucao.map((e) => Math.max(e.receita, e.consumo)), 1);
  const maxFuturo = Math.max(...A.futurasPorMes.map((f) => f.v), 1);

  /* ------------------------------- tela ------------------------------- */
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-4 md:p-6 animate-fade-in">
      {/* CABEÇALHO + FILTROS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-[#141417] p-4 rounded-xl border border-white/5 shadow-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Financeira</h1>
          <p className="text-zinc-400 text-xs mt-0.5">
            {filtroCentro === TODOS ? 'Todos os centros de custo' : `Centro: ${filtroCentro}`} · {rotuloMesLongo(mesSel)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#1a1a20] border border-gray-800 rounded-lg px-3 focus-within:border-[#10b981] transition-colors h-[42px]">
            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
            <input type="month" value={mesSel} onChange={(e) => e.target.value && setMesSel(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark] cursor-pointer" />
          </div>

          <div className="flex items-center gap-2 bg-[#1a1a20] border border-gray-800 rounded-lg px-3 h-[42px]">
            <Layers className="w-4 h-4 text-gray-400" />
            <select value={filtroCentro} onChange={(e) => setFiltroCentro(e.target.value)} className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer max-w-[170px] truncate">
              <option value={TODOS} className="bg-[#1a1a20]">{TODOS}</option>
              {centrosCusto.map((cc: any) => (
                <option key={cc.id} value={cc.nome} className="bg-[#1a1a20]">{cc.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-[#1a1a20] border border-gray-800 rounded-lg p-1 h-[42px] gap-1">
            {(
              [
                ['fatura', 'Quando pagou'],
                ['compra', 'Quando comprou'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} onClick={() => setVisao(v)} className={`px-3 h-full rounded-md text-[11px] font-semibold transition-colors ${visao === v ? 'bg-[#10b981] text-black' : 'text-zinc-400 hover:text-white'}`}>
                {l}
              </button>
            ))}
            <span className="px-1">
              <Dica texto='"Quando pagou": compra no cartão conta no mês da FATURA (igual à tela Transações). "Quando comprou": conta no mês em que você passou o cartão. Use "quando comprou" para saber se você está gastando mais; "quando pagou" para saber o que sai da conta.' />
            </span>
          </div>

          <div className="flex items-center gap-2 bg-[#1a1a20] border border-gray-800 rounded-lg px-3 h-[42px]">
            <Eye className="w-4 h-4 text-gray-400" />
            <select value={comparar} onChange={(e) => setComparar(e.target.value as any)} className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer">
              <option value="media3" className="bg-[#1a1a20]">Comparar: média 3 meses</option>
              <option value="anterior" className="bg-[#1a1a20]">Comparar: mês anterior</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl p-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> Erro ao buscar transações: {(error as any)?.message ?? 'desconhecido'}
        </div>
      )}
      {isLoading && <p className="text-xs text-zinc-500">Carregando 12 meses de lançamentos…</p>}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardKpi titulo="Receita do mês" valor={brl(atual.receita)} corValor={VERDE} icone={ArrowUpCircle} corIcone={VERDE}
          dica="Todo dinheiro que ENTROU neste centro no mês: salário, retirada da empresa, reembolso recebido. Se estiver zerado, os percentuais ficam sem sentido.">
          <Variacao atual={atual.receita} referencia={A.ref((m) => m.receita)} sobeEhBom rotulo={rotuloComp} />
        </CardKpi>

        <CardKpi titulo="Gasto do mês" valor={brl(atual.consumo)} corValor={VERMELHO} icone={ArrowDownCircle} corIcone={VERMELHO}
          dica="Tudo que foi gasto de verdade. NÃO entra aqui: dinheiro investido, compras feitas para Terceiros/Reembolsos, transferências entre suas contas e pagamento de fatura (a fatura é só o boleto das compras que já estão contadas).">
          <Variacao atual={atual.consumo} referencia={A.ref((m) => m.consumo)} sobeEhBom={false} rotulo={rotuloComp} />
        </CardKpi>

        <CardKpi titulo="Resultado (sobrou / faltou)" valor={brl(resultado)} corValor={resultado >= 0 ? VERDE : VERMELHO} icone={Landmark} corIcone={AZUL}
          dica="Entrou menos gastou. Positivo = sobrou dinheiro. Negativo = você gastou mais do que ganhou e cobriu com saldo guardado, cartão ou empréstimo.">
          <Variacao atual={resultado} referencia={A.ref((m) => m.receita - m.consumo)} sobeEhBom rotulo={rotuloComp} />
        </CardKpi>

        <CardKpi titulo="Taxa de poupança" valor={pct(taxaPoupanca)} corValor={corPoupanca} icone={PiggyBank} corIcone={corPoupanca}
          sub={taxaPoupanca == null ? 'Lance a receita para calcular' : 'Referência saudável: 20% ou mais'}
          dica="De cada R$ 100 que entram, quantos reais sobram depois dos gastos. 20 ou mais é saudável; abaixo de 10 é sinal de aperto." />

        <CardKpi titulo="Peso de empréstimos e juros" valor={pct(pesoDivida)} corValor={corDivida} icone={Percent} corIcone={corDivida}
          sub={`${brl(atual.divida)}${atual.receita > 0 ? ` · ${pct(atual.divida / atual.receita)} da renda` : ''}`}
          dica="Quanto do seu gasto foi para empréstimos e juros. É dinheiro pagando o passado, não o seu mês. Até 10% é tranquilo; acima de 25% aperta tudo o resto." />

        <CardKpi titulo="Pago no cartão" valor={brl(atual.cartao)} corValor={AMARELO} icone={Wallet} corIcone={AMARELO}
          sub={atual.consumo > 0 ? `${pct(atual.cartao / atual.consumo)} do gasto passou pelo cartão` : undefined}
          dica="Parte do 'Gasto do mês' feita no cartão de crédito. NÃO é um gasto a mais — é o mesmo gasto, só mostrando o meio de pagamento." />

        <CardKpi titulo="Investido no mês" valor={brl(atual.investimento)} corValor={AZUL} icone={TrendingUp} corIcone={AZUL}
          sub={atual.receita > 0 ? `${pct(atual.investimento / atual.receita)} do que entrou` : undefined}
          dica="Dinheiro guardado ou aplicado (categoria Investimentos). Não conta como gasto, porque continua sendo seu." />

        {A.ehMesCorrente ? (
          <CardKpi titulo="Projeção de fechamento" valor={brl(A.projecao)} corValor={A.refConsumo != null && A.projecao > A.refConsumo ? VERMELHO : '#fff'} icone={Gauge} corIcone={AZUL}
            sub={A.refConsumo != null ? `Sua média: ${brl(A.refConsumo)}` : 'Sem histórico para comparar'}
            dica="Estimativa de quanto o mês vai fechar se você continuar gastando no mesmo ritmo dos dias que já passaram. Fatura de cartão já definida entra inteira." />
        ) : (
          <CardKpi titulo="Média de gasto (3 meses antes)" valor={A.refConsumo != null ? brl(A.refConsumo) : '—'} corValor="#fff" icone={Gauge} corIcone={AZUL}
            dica="Quanto você costuma gastar por mês, olhando os 3 meses anteriores ao mês escolhido." />
        )}
      </div>

      {/* TERMÔMETRO + PARA ONDE VAI CADA R$ 100 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Bloco titulo={A.ehMesCorrente ? 'Termômetro do mês' : 'Resumo do mês'} icone={Gauge} corIcone={VERDE} className="lg:col-span-2"
          dica="Compara o que você já gastou com a sua própria média dos últimos 3 meses. Quando as metas estiverem preenchidas, a referência passa a ser a meta.">
          {A.refConsumo == null ? (
            <Vazio texto="Ainda não há 3 meses de histórico para comparar." />
          ) : (
            (() => {
              const escala = Math.max(A.refConsumo, A.projecao, atual.consumo) * 1.1 || 1;
              const p = (v: number) => `${Math.min(100, (v / escala) * 100)}%`;
              const acimaRitmo = A.ritmoIdeal != null ? atual.consumo - A.ritmoIdeal : null;
              return (
                <div className="space-y-5">
                  <div className="relative h-6 w-full bg-black/40 rounded-full overflow-visible">
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: p(atual.consumo), backgroundColor: atual.consumo > A.refConsumo ? VERMELHO : VERDE }} />
                    {A.ehMesCorrente && <div className="absolute inset-y-0 left-0 rounded-full border-2 border-dashed border-white/30" style={{ width: p(A.projecao) }} title="Projeção" />}
                    <div className="absolute -top-2 -bottom-2 w-0.5 bg-white" style={{ left: p(A.refConsumo) }} title="Sua média" />
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-zinc-400">
                    <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: atual.consumo > A.refConsumo ? VERMELHO : VERDE }} />Gasto {A.ehMesCorrente ? 'até hoje' : 'no mês'}: <b className="text-white">{brl(atual.consumo)}</b></span>
                    {A.ehMesCorrente && <span><span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 border border-dashed border-white/50" />Projeção: <b className="text-white">{brl(A.projecao)}</b></span>}
                    <span><span className="inline-block w-0.5 h-3 bg-white mr-1.5 align-middle" />Sua média (3m): <b className="text-white">{brl(A.refConsumo)}</b></span>
                  </div>

                  {A.ehMesCorrente && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-black/30 rounded-xl p-4">
                        <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">Pode gastar por dia até o fim do mês <Dica texto="Quanto ainda cabe por dia para você terminar o mês igual à sua média. Se estiver negativo, você já passou da média." /></p>
                        <p className="text-2xl font-bold mt-1" style={{ color: (A.podePorDia ?? 0) >= 0 ? VERDE : VERMELHO }}>
                          {(A.podePorDia ?? 0) >= 0 ? brl(A.podePorDia ?? 0) : 'R$ 0,00'}
                        </p>
                        {(A.podePorDia ?? 0) < 0 && <p className="text-[10px] text-red-400 mt-1">Já passou da média em {brl(atual.consumo - A.refConsumo)}</p>}
                      </div>
                      <div className="bg-black/30 rounded-xl p-4">
                        <p className="text-[11px] text-zinc-400">Dias restantes</p>
                        <p className="text-2xl font-bold mt-1">{A.diasRestantes}</p>
                        <p className="text-[10px] text-zinc-500 mt-1">de {A.diasMes} dias no mês</p>
                      </div>
                      <div className="bg-black/30 rounded-xl p-4">
                        <p className="text-[11px] text-zinc-400 flex items-center gap-1.5">Ritmo <Dica texto="Quanto você 'deveria' ter gasto até hoje se gastasse sua média de forma igual todos os dias." /></p>
                        <p className="text-2xl font-bold mt-1" style={{ color: (acimaRitmo ?? 0) > 0 ? VERMELHO : VERDE }}>
                          {acimaRitmo == null ? '—' : `${acimaRitmo > 0 ? '+' : '−'}${brl(Math.abs(acimaRitmo))}`}
                        </p>
                        <p className="text-[10px] text-zinc-500 mt-1">{(acimaRitmo ?? 0) > 0 ? 'acima' : 'abaixo'} do ritmo da sua média</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </Bloco>

        <Bloco titulo="Para onde vai cada R$ 100 que entra" icone={PiggyBank} corIcone={AZUL}
          dica="Divide a receita do mês em: gastos do dia a dia, empréstimos/juros, investido e o que sobrou (ou faltou).">
          {atual.receita <= 0 ? (
            <Vazio texto="Lance a receita do mês para ver essa divisão." />
          ) : (
            (() => {
              const r = atual.receita;
              const partes = [
                { nome: 'Gastos do dia a dia', v: Math.max(0, atual.consumo - atual.divida), cor: VERMELHO },
                { nome: 'Empréstimos e juros', v: Math.max(0, atual.divida), cor: AMARELO },
                { nome: 'Investido', v: Math.max(0, atual.investimento), cor: AZUL },
                { nome: 'Sobrou', v: Math.max(0, r - atual.consumo - atual.investimento), cor: VERDE },
              ];
              const faltou = Math.max(0, atual.consumo + atual.investimento - r);
              const total = partes.reduce((s, x) => s + x.v, 0) || 1;
              return (
                <div className="space-y-4">
                  <div className="flex h-4 w-full rounded-full overflow-hidden bg-black/40">
                    {partes.map((x) => x.v > 0 && <div key={x.nome} style={{ width: `${(x.v / total) * 100}%`, backgroundColor: x.cor }} title={x.nome} />)}
                  </div>
                  <div className="space-y-2">
                    {partes.map((x) => (
                      <div key={x.nome} className="flex justify-between text-xs">
                        <span className="flex items-center gap-2 text-zinc-300"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: x.cor }} />{x.nome}</span>
                        <span className="font-bold">R$ {((x.v / r) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                      </div>
                    ))}
                  </div>
                  {faltou > 0 && (
                    <p className="text-[11px] text-red-400 bg-red-500/10 rounded-lg p-2.5">
                      Faltaram R$ {((faltou / r) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} a cada R$ 100 ({brl(faltou)}) — saiu mais do que entrou.
                    </p>
                  )}
                </div>
              );
            })()
          )}
        </Bloco>
      </div>

      {/* CATEGORIAS + INSIGHTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Bloco titulo="Gastos por categoria" icone={BarChart3} corIcone="#8b5cf6" className="lg:col-span-2"
          dica="Clique numa categoria para ver as subcategorias e os maiores lançamentos. O ícone de fogo marca categorias bem acima da sua média."
          extra={<span className="text-[10px] text-zinc-500">variação vs {rotuloComp}</span>}>
          {A.linhasCat.length === 0 ? (
            <Vazio texto="Nenhuma despesa no período selecionado." />
          ) : (
            <div className="space-y-1 max-h-[560px] overflow-y-auto pr-2 custom-scrollbar">
              {A.linhasCat.map((r) => {
                const aberta = catAberta === r.nome;
                const delta = r.base != null && Math.abs(r.base) > 0.01 ? (r.valor - r.base) / Math.abs(r.base) : null;
                const subs = Object.entries(atual.porSub[r.nome] ?? {}).filter(([, v]) => Math.abs(v) > 0.004).sort((a, b) => b[1] - a[1]);
                const maiores = atual.txs.filter((t) => t._cat === r.nome).sort((a, b) => b._valor - a._valor).slice(0, 8);
                return (
                  <div key={r.nome} className="rounded-lg hover:bg-white/[0.02]">
                    <button onClick={() => setCatAberta(aberta ? null : r.nome)} className="w-full text-left p-2 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        {aberta ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                        <span className="font-semibold text-zinc-200 truncate">{r.nome}</span>
                        {r.anomalia && <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                        {r.novo && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 shrink-0">NOVO</span>}
                        <span className="ml-auto hidden sm:block"><Sparkline valores={r.serie} cor={r.cor} /></span>
                        <span className={`w-16 text-right text-[10px] font-semibold shrink-0 ${delta == null ? 'text-zinc-600' : delta > 0.005 ? 'text-red-400' : delta < -0.005 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                          {delta == null ? '—' : `${delta >= 0 ? '▲' : '▼'} ${pct(Math.abs(delta), 0)}`}
                        </span>
                        <span className="w-28 text-right font-bold text-white shrink-0">{brl(r.valor)}</span>
                        <span className="w-12 text-right text-[10px] text-zinc-400 shrink-0">{pct(r.pct)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden ml-5" style={{ width: 'calc(100% - 1.25rem)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, (r.valor / maxCat) * 100)}%`, backgroundColor: r.cor }} />
                      </div>
                    </button>

                    {aberta && (
                      <div className="ml-7 mr-2 mb-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                        <div>
                          <p className="text-zinc-500 uppercase tracking-wide text-[9px] mb-2">Subcategorias</p>
                          {subs.length === 0 || (subs.length === 1 && subs[0][0] === 'Sem subcategoria') ? (
                            <p className="text-zinc-500">{A.temCampoSub ? 'Sem subcategoria nos lançamentos.' : 'Subcategoria não encontrada nos lançamentos (conferir CONFIG).'}</p>
                          ) : (
                            <div className="space-y-1.5">
                              {subs.map(([s, v]) => (
                                <div key={s} className="flex justify-between gap-2">
                                  <span className="text-zinc-300 truncate">{s}</span>
                                  <span className="font-semibold shrink-0">{brl(v)} <span className="text-zinc-500 font-normal">({pct(r.valor ? v / r.valor : null, 0)})</span></span>
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-zinc-500 mt-3">Média 3m: <b className="text-zinc-300">{r.med != null ? brl(r.med) : '—'}</b> · Mês anterior: <b className="text-zinc-300">{brl(r.ant)}</b></p>
                        </div>
                        <div>
                          <p className="text-zinc-500 uppercase tracking-wide text-[9px] mb-2">Maiores lançamentos</p>
                          <div className="space-y-1.5">
                            {maiores.map((t, i) => (
                              <div key={t.id ?? i} className="flex justify-between gap-2">
                                <span className="text-zinc-300 truncate">
                                  <span className="text-zinc-500 mr-1.5">{dataBR(t.data)}</span>
                                  {t[CONFIG.transacaoCampoDescricao] || '(sem descrição)'}
                                  {t.cartao_id && <span className="text-zinc-500"> · {A.porCartao.find((c) => c.id === t.cartao_id)?.nome ?? 'cartão'}</span>}
                                </span>
                                <span className="font-semibold shrink-0">{brl(t._valor)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Bloco>

        <Bloco titulo="O que chama atenção" icone={Lightbulb} corIcone={AMARELO} dica="Frases geradas automaticamente a partir dos seus números. Vermelho = atenção, verde = boa notícia.">
          {A.insights.length === 0 ? (
            <Vazio texto="Nada fora do normal neste mês." />
          ) : (
            <div className="space-y-2.5">
              {A.insights.map((i, idx) => (
                <div key={idx} className={`text-xs leading-relaxed rounded-lg p-3 border ${i.tipo === 'alerta' ? 'bg-red-500/5 border-red-500/20 text-red-100' : i.tipo === 'bom' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-100' : 'bg-white/[0.03] border-white/5 text-zinc-300'}`}>
                  {i.txt}
                </div>
              ))}
            </div>
          )}
        </Bloco>
      </div>

      {/* EVOLUÇÃO 12 MESES */}
      <Bloco titulo="Evolução dos últimos 12 meses" icone={TrendingUp} corIcone={VERDE}
        dica="Verde = o que entrou. Vermelho = o que foi gasto. O número embaixo é o resultado do mês (sobrou ou faltou). Clique numa coluna para abrir aquele mês."
        extra={
          <div className="flex gap-4 text-[10px] text-zinc-400">
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: VERDE }} />Receita</span>
            <span><span className="inline-block w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: VERMELHO }} />Gasto</span>
          </div>
        }>
        <div className="overflow-x-auto custom-scrollbar">
          <div className="flex items-end gap-2 min-w-[640px] h-56">
            {A.evolucao.map((e) => (
              <button key={e.k} onClick={() => setMesSel(e.k)} className={`flex-1 flex flex-col items-center gap-1 h-full rounded-lg pt-2 ${e.k === mesSel ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                <div className="flex items-end gap-1 flex-1 w-full justify-center">
                  <div className="w-3 rounded-t" style={{ height: `${(e.receita / maxEvol) * 100}%`, backgroundColor: VERDE }} title={`Receita ${brl(e.receita)}`} />
                  <div className="w-3 rounded-t" style={{ height: `${(Math.max(0, e.consumo) / maxEvol) * 100}%`, backgroundColor: VERMELHO }} title={`Gasto ${brl(e.consumo)}`} />
                </div>
                <span className={`text-[10px] font-semibold ${e.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{e.receita === 0 && e.consumo === 0 ? '—' : brlCurto(e.resultado)}</span>
                <span className={`text-[10px] pb-1 ${e.k === mesSel ? 'text-white font-bold' : 'text-zinc-500'}`}>{rotuloMes(e.k)}</span>
              </button>
            ))}
          </div>
        </div>
      </Bloco>

      {/* HEATMAP */}
      <Bloco titulo="Mapa de calor: categoria × mês" icone={Grid3X3} corIcone={AMARELO}
        dica="Quanto mais forte a cor, mais você gastou naquela categoria naquele mês (comparado com ela mesma). Serve para ver meses 'pesados' e gastos que se repetem todo ano.">
        {A.heatCats.length === 0 ? (
          <Vazio texto="Sem histórico suficiente." />
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[760px] text-[10px] border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left text-zinc-500 font-medium sticky left-0 bg-[#1e1e24] pr-2">Categoria</th>
                  {mesesJanela.map((k) => (
                    <th key={k} className={`font-medium ${k === mesSel ? 'text-white' : 'text-zinc-500'}`}>{rotuloMes(k)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {A.heatCats.map((c) => {
                  const vals = mesesJanela.map((k) => A.porMes[k].porCat[c] ?? 0);
                  const max = Math.max(...vals, 1);
                  return (
                    <tr key={c}>
                      <td className="text-zinc-300 font-semibold truncate max-w-[140px] sticky left-0 bg-[#1e1e24] pr-2">{c}</td>
                      {vals.map((v, i) => (
                        <td key={i} className="text-center rounded py-1.5 text-white/90" style={{ backgroundColor: v > 0 ? `rgba(245,158,11,${0.08 + 0.72 * (v / max)})` : 'rgba(255,255,255,0.02)' }} title={`${c} · ${rotuloMes(mesesJanela[i])}: ${brl(v)}`}>
                          {v > 0 ? brlCurto(v) : ''}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>

      {/* CARTÕES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Bloco titulo="Gasto por cartão no mês" icone={CreditCard} corIcone={AMARELO} dica="Quanto do gasto deste centro passou por cada cartão, e quanto isso representa do limite total do cartão.">
          {A.porCartao.length === 0 ? (
            <Vazio texto="Nenhum gasto no cartão neste mês." />
          ) : (
            <div className="space-y-3">
              {A.porCartao.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex justify-between text-xs gap-2">
                    <span className="text-zinc-300 font-semibold truncate">{c.nome}</span>
                    <span className="font-bold shrink-0">{brl(c.valor)} <span className="text-zinc-500 font-normal">({pct(c.share, 0)})</span></span>
                  </div>
                  <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(c.share ?? 0) * 100}%`, backgroundColor: corDoNome(c.nome) }} />
                  </div>
                  {c.uso != null && <p className="text-[10px] text-zinc-500">{pct(c.uso)} do limite de {brl(c.limite ?? 0)}</p>}
                </div>
              ))}
            </div>
          )}
        </Bloco>

        <Bloco titulo="Cartão da vez (compra hoje)" icone={CalendarClock} corIcone={VERDE}
          dica="Se você comprar HOJE, em quantos dias a fatura de cada cartão fecha. Quanto mais dias, mais tempo até pagar. Calculado pelo 'melhor dia de compra' cadastrado.">
          {A.cartaoDaVez.length === 0 ? (
            <Vazio texto="Não encontrei os cartões com 'melhor dia de compra'. Peça ao Claude Code para conferir o CONFIG no topo do arquivo." />
          ) : (
            <div className="space-y-2">
              {A.cartaoDaVez.map((c, i) => (
                <div key={c.id} className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${i === 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-black/20'}`}>
                  <span className="truncate">
                    <span className={`font-semibold ${i === 0 ? 'text-emerald-300' : 'text-zinc-300'}`}>{c.nome}</span>
                    <span className="text-zinc-500"> · melhor dia {c.melhorDia}</span>
                  </span>
                  <span className="font-bold shrink-0">{c.dias} dias</span>
                </div>
              ))}
            </div>
          )}
        </Bloco>

        <Bloco titulo="Faturas futuras já comprometidas" icone={Calendar} corIcone={VERMELHO}
          dica="Parcelas que você já comprou e vão cair nas próximas faturas, de TODOS os centros (é o que vai sair da conta de qualquer jeito).">
          {A.futurasPorMes.every((f) => f.v === 0) ? (
            <Vazio texto="Nenhuma parcela lançada em faturas futuras." />
          ) : (
            <div className="space-y-2.5">
              {A.futurasPorMes.map((f) => (
                <div key={f.k} className="flex items-center gap-3 text-xs">
                  <span className="w-12 text-zinc-400 shrink-0">{rotuloMes(f.k)}</span>
                  <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(Math.max(0, f.v) / maxFuturo) * 100}%`, backgroundColor: VERMELHO }} />
                  </div>
                  <span className="w-24 text-right font-bold shrink-0">{brl(f.v)}</span>
                </div>
              ))}
              <p className="text-[11px] text-zinc-400 pt-2 border-t border-white/5">
                Total já comprometido: <b className="text-white">{brl(A.futurasPorMes.reduce((s, f) => s + f.v, 0))}</b>
              </p>
            </div>
          )}
        </Bloco>
      </div>

      {/* TERCEIROS + QUALIDADE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Bloco titulo="Terceiros e Reembolsos (últimos 12 meses)" icone={Users} corIcone="#8b5cf6"
          dica="Compras que você fez para outras pessoas ou que vão ser reembolsadas. Não é gasto seu — é dinheiro a receber. O certo é o saldo fechar em zero.">
          <div className="space-y-2">
            {A.listaTerceiros.length === 0 ? (
              <Vazio texto="Nenhum lançamento em Terceiros." />
            ) : (
              A.listaTerceiros.map((p) => (
                <div key={p.pessoa} className="grid grid-cols-4 gap-2 text-xs items-center bg-black/20 rounded-lg px-3 py-2">
                  <span className="font-semibold text-zinc-300 truncate">{p.pessoa}</span>
                  <span className="text-zinc-500 text-right">lançado {brl(p.lancado)}</span>
                  <span className="text-zinc-500 text-right">recebido {brl(p.recebido)}</span>
                  <span className={`text-right font-bold ${Math.abs(p.saldo) < 1 ? 'text-emerald-400' : 'text-amber-400'}`}>{Math.abs(p.saldo) < 1 ? 'zerado' : brl(p.saldo)}</span>
                </div>
              ))
            )}
            <div className="grid grid-cols-4 gap-2 text-xs items-center bg-black/20 rounded-lg px-3 py-2">
              <span className="font-semibold text-zinc-300 truncate">Reembolsos/Giro</span>
              <span className="text-zinc-500 text-right">lançado {brl(A.reembolsos.lancado)}</span>
              <span className="text-zinc-500 text-right">recebido {brl(A.reembolsos.recebido)}</span>
              <span className={`text-right font-bold ${Math.abs(A.saldoReembolsos) < 1 ? 'text-emerald-400' : 'text-amber-400'}`}>{Math.abs(A.saldoReembolsos) < 1 ? 'zerado' : brl(A.saldoReembolsos)}</span>
            </div>
          </div>
          <div className={`text-[11px] flex items-center gap-1.5 mt-4 pt-3 border-t border-white/5 ${Math.abs(A.saldoTerceiros) < 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {Math.abs(A.saldoTerceiros) < 1 ? 'Caixa de Terceiros fechado em zero.' : `O caixa de Terceiros deve fechar zerado — em aberto: ${brl(A.saldoTerceiros)}`}
          </div>
        </Bloco>

        <Bloco titulo="Qualidade dos dados" icone={ShieldCheck} corIcone={VERDE}
          dica="O dashboard só é tão bom quanto os lançamentos. Aqui aparecem os buracos que deixam os números errados.">
          {(() => {
            const confianca = A.q.valorDespesas > 0 ? 1 - A.q.valorSemCategoria / A.q.valorDespesas : null;
            const itens = [
              { ok: atual.receita > 0, txt: atual.receita > 0 ? 'Receita do mês lançada' : 'Receita do mês NÃO lançada' },
              { ok: A.q.semCategoria === 0, txt: A.q.semCategoria === 0 ? 'Todos os gastos têm categoria' : `${A.q.semCategoria} gasto(s) sem categoria (${brl(A.q.valorSemCategoria)})` },
              { ok: A.q.semCentro === 0, txt: A.q.semCentro === 0 ? 'Todos os lançamentos têm centro de custo' : `${A.q.semCentro} lançamento(s) sem centro de custo (em qualquer centro)` },
              ...(A.temCampoSub ? [{ ok: A.q.semSub === 0, txt: A.q.semSub === 0 ? 'Todos os gastos têm subcategoria' : `${A.q.semSub} gasto(s) sem subcategoria` }] : []),
              { ok: A.q.duplicadas === 0, txt: A.q.duplicadas === 0 ? 'Nenhum lançamento repetido' : `${A.q.duplicadas} possível(is) lançamento(s) duplicado(s) (mesma data, valor e descrição)` },
            ];
            return (
              <div className="space-y-3">
                <div className="flex items-end gap-3">
                  <p className="text-3xl font-bold" style={{ color: confianca == null ? '#a1a1aa' : confianca >= 0.95 ? VERDE : confianca >= 0.8 ? AMARELO : VERMELHO }}>{pct(confianca, 0)}</p>
                  <p className="text-[11px] text-zinc-400 pb-1">do valor gasto está classificado</p>
                </div>
                {itens.map((i, idx) => (
                  <div key={idx} className={`text-xs flex items-center gap-2 ${i.ok ? 'text-zinc-400' : 'text-amber-300'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${i.ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {i.txt}
                  </div>
                ))}
              </div>
            );
          })()}
        </Bloco>
      </div>
    </div>
  );
}
