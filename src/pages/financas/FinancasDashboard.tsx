import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Landmark, ArrowUpCircle, ArrowDownCircle, CalendarDays, Wallet, Layers, PieChart, BarChart3, AlertTriangle } from 'lucide-react';

export default function FinancasDashboard() {
  const [filtroMes, setFiltroMes] = useState('Julho/2026'); // Ajustado para bater com o formato da sua fatura
  const [filtroCentro, setFiltroCentro] = useState('Todos (Visão Global)');

  // Busca Transações (Receitas e Despesas Avulsas)
  const { data: transacoes = [] } = useQuery({
    queryKey: ['transacoes_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transacao_pessoal').select('*, categoria_pessoal(nome, cor), centro_custo_projeto(nome, cor)');
      if (error) throw error;
      return data || [];
    }
  });

  // Cálculos Dinâmicos
  const { faturamento, gastoConsumido, faturasAtivas, despesasPorCategoria, custoPorUnidade } = useMemo(() => {
    let fat = 0;
    let gas = 0;
    let faturas = 0;
    
    // Filtra pelo mês selecionado (ex: "Jul/2026")
    const transacoesFiltradas = transacoes.filter((t: any) => {
      const mesFatura = t.mes_fatura || ''; // Usa a coluna de fatura que criamos antes
      const centroNome = t.centro_custo_projeto?.nome || 'Sem Centro';
      
      const bateuMes = mesFatura.toLowerCase().includes(filtroMes.split('/')[0].toLowerCase());
      const bateuCentro = filtroCentro === 'Todos (Visão Global)' || centroNome === filtroCentro;
      
      return bateuMes && bateuCentro;
    });

    // Mapeamento para os Gráficos
    const mapCategorias: Record<string, { valor: number, cor: string }> = {};
    const mapCentros: Record<string, { valor: number, cor: string }> = {};

    transacoesFiltradas.forEach((t: any) => {
      const val = Number(t.valor) || 0;
      
      if (t.tipo === 'Receita') {
        fat += val;
      } else {
        // Tudo que não é receita é considerado gasto
        gas += val;
        if (t.cartao_id) faturas += val; // Se tem cartão, soma no card de Faturas Ativas

        // Agrupa por Categoria para o Gráfico de Barras
        const catNome = t.categoria_pessoal?.nome || 'A Classificar';
        const catCor = t.categoria_pessoal?.cor || '#95a5a6';
        if (!mapCategorias[catNome]) mapCategorias[catNome] = { valor: 0, cor: catCor };
        mapCategorias[catNome].valor += val;

        // Agrupa por Centro de Custo para o Gráfico de Pizza (Unidades)
        const ccNome = t.centro_custo_projeto?.nome || 'Sem Centro';
        const ccCor = t.centro_custo_projeto?.cor || '#3498db';
        if (!mapCentros[ccNome]) mapCentros[ccNome] = { valor: 0, cor: ccCor };
        mapCentros[ccNome].valor += val;
      }
    });

    // Formata os dados para os gráficos
    const totalDespesasGrafico = Object.values(mapCategorias).reduce((acc, curr) => acc + curr.valor, 0);
    
    const arrayCategorias = Object.entries(mapCategorias)
      .map(([cat, obj]) => ({
        cat,
        valor: obj.valor,
        pct: totalDespesasGrafico > 0 ? `${((obj.valor / totalDespesasGrafico) * 100).toFixed(1)}%` : '0%',
        cor: obj.cor
      }))
      .sort((a, b) => b.valor - a.valor); // Ordena da maior para a menor

    const arrayCentros = Object.entries(mapCentros)
      .map(([cc, obj]) => ({ cc, valor: obj.valor, cor: obj.cor }))
      .sort((a, b) => b.valor - a.valor);

    return { 
      faturamento: fat, 
      gastoConsumido: gas, 
      faturasAtivas: faturas,
      despesasPorCategoria: arrayCategorias,
      custoPorUnidade: arrayCentros
    };
  }, [transacoes, filtroMes, filtroCentro]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-6">
      
      {/* HEADER & FILTROS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#141417] p-4 rounded-xl border border-white/5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Financeira</h1>
          <p className="text-zinc-400 text-xs mt-0.5">Visão consolidada e controle de alocação de receitas e despesas.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            <CalendarDays className="w-4 h-4 text-zinc-400" />
            <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer">
              <option value="Jul/2026">Julho 2026</option>
              <option value="Ago/2026">Agosto 2026</option>
              <option value="Set/2026">Setembro 2026</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            <Layers className="w-4 h-4 text-zinc-400" />
            <select value={filtroCentro} onChange={(e) => setFiltroCentro(e.target.value)} className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer">
              <option>Todos (Visão Global)</option>
              <option>Familiar</option>
              <option>360 Gestão</option>
              <option>Bitté</option>
            </select>
          </div>
        </div>
      </div>

      {/* CARDS INDICADORES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Faturamento Geral</p><p className="text-xl font-bold text-[#10b981]">R$ {faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#10b981]/10 flex items-center justify-center"><ArrowUpCircle className="w-4 h-4 text-[#10b981]" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Gasto Consumido</p><p className="text-xl font-bold text-[#ef4444]">R$ {gastoConsumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#ef4444]/10 flex items-center justify-center"><ArrowDownCircle className="w-4 h-4 text-[#ef4444]" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Faturas Ativas de Cartões</p><p className="text-xl font-bold text-amber-500">R$ {faturasAtivas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center"><Wallet className="w-4 h-4 text-amber-500" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Saldo Líquido Previsto</p><p className="text-xl font-bold text-white">R$ {(faturamento - gastoConsumido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#3b82f6]/10 flex items-center justify-center"><Landmark className="w-4 h-4 text-[#3b82f6]" /></div>
          </div>
        </div>
      </div>

      {/* METRICAS VISUAIS DE INVESTIMENTOS / ALOCAÇÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Distribuição por Categorias */}
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 col-span-2 flex flex-col h-[400px]">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4 shrink-0"><BarChart3 className="w-4 h-4 text-[#8b5cf6]" /> Despesas por Categoria (Visão Completa)</h3>
          
          <div className="space-y-4 overflow-y-auto pr-3 custom-scrollbar flex-1">
            {despesasPorCategoria.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center mt-10">Nenhuma despesa registrada no período.</p>
            ) : (
              despesasPorCategoria.map((i, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span className="font-semibold">{i.cat}</span>
                    <span className="font-bold text-white">R$ {i.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({i.pct})</span>
                  </div>
                  <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: i.pct, backgroundColor: i.cor || '#8b5cf6' }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Divisão de Centros de Custo */}
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex flex-col h-[400px]">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4 shrink-0"><PieChart className="w-4 h-4 text-[#10b981]" /> Custo por Unidade</h3>
          
          <div className="space-y-4 my-auto overflow-y-auto custom-scrollbar pr-2">
            {custoPorUnidade.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center">Nenhum custo apropriado.</p>
            ) : (
              custoPorUnidade.map((u, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs border-b border-white/[0.03] pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: u.cor || '#10b981' }} />
                    <span className="font-semibold text-zinc-300">{u.cc}</span>
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
