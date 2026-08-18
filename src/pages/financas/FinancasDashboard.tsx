import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Landmark, ArrowUpCircle, ArrowDownCircle, Calendar, Layers, PieChart, BarChart3, AlertTriangle, Wallet } from 'lucide-react';

const CORES_PALETA = ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#14b8a6', '#f43f5e', '#84cc16', '#a855f7', '#0ea5e9'];

export default function FinancasDashboard() {
  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const dataAtual = new Date();
  const anoAtual = dataAtual.getFullYear();
  const mesAtualNum = String(dataAtual.getMonth() + 1).padStart(2, '0');
  
  const [anoMesSelecionado, setAnoMesSelecionado] = useState(`${anoAtual}-${mesAtualNum}`);
  const [filtroCentro, setFiltroCentro] = useState('Todos (Visão Global)');

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros_custo_dashboard'],
    queryFn: async () => {
      const { data } = await supabase.from('centro_custo_projeto').select('id, nome').order('nome');
      return data || [];
    }
  });

  const { data: categoriasLista = [] } = useQuery({
    queryKey: ['categorias_dashboard'],
    queryFn: async () => {
      const { data } = await supabase.from('categoria_pessoal').select('id, nome');
      return data || [];
    }
  });

  // PREPARA OS DADOS EXATAMENTE IGUAL À TELA DE TRANSAÇÕES
  const { dataInicio, dataFim, mesFaturaStr } = useMemo(() => {
    const [anoStr, mesNumStr] = anoMesSelecionado.split('-');
    const anoNum = Number(anoStr);
    const mesNum = Number(mesNumStr);
    
    const ultimoDia = new Date(anoNum, mesNum, 0).getDate();
    const dInicio = `${anoStr}-${mesNumStr}-01`;
    const dFim = `${anoStr}-${mesNumStr}-${ultimoDia}`;
    const faturaStr = `${mesesNomes[mesNum - 1]}/${anoStr}`;
    
    return { dataInicio: dInicio, dataFim: dFim, mesFaturaStr: faturaStr };
  }, [anoMesSelecionado]);

  // BUSCA SINCRONIZADA COM A TELA DE TRANSAÇÕES
  const { data: transacoes = [] } = useQuery({
    queryKey: ['transacoes_dashboard', dataInicio, dataFim, mesFaturaStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transacao_pessoal')
        .select('*, centro_custo_projeto(nome)')
        .or(`and(cartao_id.is.null,data.gte.${dataInicio},data.lte.${dataFim}),and(cartao_id.not.is.null,mes_fatura.eq.${mesFaturaStr})`)
        .order('data', { ascending: false });
        
      if (error) {
        console.error("Erro na busca do Dashboard:", error);
        throw error;
      }
      return data || [];
    }
  });

  const { faturamento, gastoConsumido, faturasAtivas, despesasPorCategoria, custoPorUnidade } = useMemo(() => {
    let fat = 0;
    let gas = 0;
    let faturas = 0;
    
    const getMacroCatName = (catId?: string) => {
      if (!catId) return 'A Classificar';
      const c = categoriasLista.find((x: any) => x.id === catId);
      return c ? c.nome : 'A Classificar';
    };

    // O filtro de data já foi feito pelo Supabase. Filtramos só o Centro de Custo no Front.
    const transacoesFiltradas = transacoes.filter((t: any) => {
      const centroNome = t.centro_custo_projeto?.nome || 'Sem Centro';
      return filtroCentro === 'Todos (Visão Global)' || centroNome === filtroCentro;
    });

    const mapCategorias: Record<string, { valor: number, cor: string }> = {};
    const mapCentros: Record<string, { valor: number, cor: string }> = {};

    let corCatIdx = 0;
    let corCcIdx = 0;

    transacoesFiltradas.forEach((t: any) => {
      const val = Math.abs(Number(t.valor) || 0);
      const tipo = t.tipo?.toUpperCase() || 'DESPESA';
      
      if (tipo === 'RECEITA') {
        fat += val;
      } else if (tipo === 'ESTORNO') {
        gas -= val;
        if (t.cartao_id && t.cartao_id.trim() !== '') faturas -= val;
        
        const catNome = getMacroCatName(t.categoria_id);
        if (!mapCategorias[catNome]) {
           mapCategorias[catNome] = { valor: 0, cor: CORES_PALETA[corCatIdx % CORES_PALETA.length] };
           corCatIdx++;
        }
        mapCategorias[catNome].valor -= val;

        const ccNome = t.centro_custo_projeto?.nome || 'Sem Centro';
        if (!mapCentros[ccNome]) {
           mapCentros[ccNome] = { valor: 0, cor: CORES_PALETA[corCcIdx % CORES_PALETA.length] };
           corCcIdx++;
        }
        mapCentros[ccNome].valor -= val;
      } else {
        gas += val;
        if (t.cartao_id && t.cartao_id.trim() !== '') faturas += val; 

        const catNome = getMacroCatName(t.categoria_id);
        if (!mapCategorias[catNome]) {
           mapCategorias[catNome] = { valor: 0, cor: CORES_PALETA[corCatIdx % CORES_PALETA.length] };
           corCatIdx++;
        }
        mapCategorias[catNome].valor += val;

        const ccNome = t.centro_custo_projeto?.nome || 'Sem Centro';
        if (!mapCentros[ccNome]) {
           mapCentros[ccNome] = { valor: 0, cor: CORES_PALETA[corCcIdx % CORES_PALETA.length] };
           corCcIdx++;
        }
        mapCentros[ccNome].valor += val;
      }
    });

    const totalDespesasGrafico = Object.values(mapCategorias).reduce((acc, curr) => acc + curr.valor, 0);
    
    const arrayCategorias = Object.entries(mapCategorias)
      .filter(([_, obj]) => obj.valor > 0) 
      .map(([cat, obj]) => ({
        cat,
        valor: obj.valor,
        pct: totalDespesasGrafico > 0 ? `${((obj.valor / totalDespesasGrafico) * 100).toFixed(1)}%` : '0%',
        cor: obj.cor
      }))
      .sort((a, b) => b.valor - a.valor); 

    const arrayCentros = Object.entries(mapCentros)
      .filter(([_, obj]) => obj.valor > 0)
      .map(([cc, obj]) => ({ cc, valor: obj.valor, cor: obj.cor }))
      .sort((a, b) => b.valor - a.valor);

    return { 
      faturamento: fat, 
      gastoConsumido: gas, 
      faturasAtivas: faturas,
      despesasPorCategoria: arrayCategorias,
      custoPorUnidade: arrayCentros
    };
  }, [transacoes, filtroCentro, categoriasLista]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-6 animate-fade-in">
      
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#141417] p-4 rounded-xl border border-white/5 shadow-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Financeira</h1>
          <p className="text-zinc-400 text-xs mt-0.5">Visão consolidada e controle de alocação de receitas e despesas.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#1a1a20] border border-gray-800 rounded-lg px-3 focus-within:border-[#10b981] transition-colors h-[42px]">
            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
            <input 
              type="month" 
              value={anoMesSelecionado} 
              onChange={(e) => setAnoMesSelecionado(e.target.value)} 
              className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark] cursor-pointer" 
            />
          </div>

          <div className="flex items-center gap-2 bg-[#1a1a20] border border-gray-800 rounded-lg px-3 transition-colors h-[42px]">
            <Layers className="w-4 h-4 text-gray-400" />
            <select value={filtroCentro} onChange={(e) => setFiltroCentro(e.target.value)} className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer appearance-none max-w-[150px] truncate">
              <option value="Todos (Visão Global)" className="bg-[#1a1a20]">Todos (Visão Global)</option>
              {centrosCusto.map((cc: any) => <option key={cc.id} value={cc.nome} className="bg-[#1a1a20]">{cc.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Faturamento Geral</p><p className="text-xl font-bold text-[#10b981]">R$ {faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#10b981]/10 flex items-center justify-center"><ArrowUpCircle className="w-4 h-4 text-[#10b981]" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Gasto Consumido</p><p className="text-xl font-bold text-[#ef4444]">R$ {gastoConsumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#ef4444]/10 flex items-center justify-center"><ArrowDownCircle className="w-4 h-4 text-[#ef4444]" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Faturas Ativas</p><p className="text-xl font-bold text-amber-500">R$ {faturasAtivas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center"><Wallet className="w-4 h-4 text-amber-500" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Saldo Líquido Previsto</p><p className="text-xl font-bold text-white">R$ {(faturamento - gastoConsumido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#3b82f6]/10 flex items-center justify-center"><Landmark className="w-4 h-4 text-[#3b82f6]" /></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 col-span-2 flex flex-col h-[400px]">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4 shrink-0"><BarChart3 className="w-4 h-4 text-[#8b5cf6]" /> Despesas por Categoria (Visão Macro)</h3>
          
          <div className="space-y-4 overflow-y-auto pr-3 custom-scrollbar flex-1">
            {despesasPorCategoria.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center mt-10">Nenhuma despesa registrada no período selecionado.</p>
            ) : (
              despesasPorCategoria.map((i, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span className="font-semibold">{i.cat}</span>
                    <span className="font-bold text-white">R$ {i.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({i.pct})</span>
                  </div>
                  <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: i.pct, backgroundColor: i.cor }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex flex-col h-[400px]">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4 shrink-0"><PieChart className="w-4 h-4 text-[#10b981]" /> Custo por Unidade</h3>
          
          <div className="space-y-4 my-auto overflow-y-auto custom-scrollbar pr-2">
            {custoPorUnidade.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center">Nenhum custo apropriado.</p>
            ) : (
              custoPorUnidade.map((u, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs border-b border-white/[0.03] pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: u.cor }} />
                    <span className="font-semibold text-zinc-300 truncate max-w-[120px]" title={u.cc}>{u.cc}</span>
                  </div>
                  <span className="font-bold text-white">R$ {u.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ))
            )}
          </div>

          <div className="text-[10px] text-zinc-500 text-center flex items-center justify-center gap-1.5 mt-auto pt-4 border-t border-white/5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> O caixa de Terceiros deve fechar zerado.
          </div>
        </div>
      </div>
    </div>
  );
}
