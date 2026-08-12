import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Landmark, ArrowUpCircle, ArrowDownCircle, CalendarDays, Wallet, Layers, PieChart, BarChart3, AlertTriangle } from 'lucide-react';

export default function FinancasDashboard() {
  const [filtroMes, setFiltroMes] = useState('Julho 2026');
  const [filtroCentro, setFiltroCentro] = useState('Todos (Visão Global)');

  // BUSCA DADOS REAIS DO BANCO
  const { data: transacoes = [] } = useQuery({
    queryKey: ['transacoes_dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transacao_pessoal').select('*, categoria_pessoal(nome), centro_custo_projeto(nome)');
      if (error) throw error;
      return data || [];
    }
  });

  // CÁLCULOS DINÂMICOS
  const { faturamento, gastoConsumido } = useMemo(() => {
    let fat = 0;
    let gas = 0;
    transacoes.forEach((t: any) => {
      if (t.tipo === 'Receita') fat += Number(t.valor) || 0;
      if (t.tipo === 'Despesa') gas += Number(t.valor) || 0;
    });
    return { faturamento: fat, gastoConsumido: gas };
  }, [transacoes]);

  // CATEGORIAS E CENTROS ZERADOS AGUARDANDO DADOS
  const despesasPorCategoria: any[] = []; 
  const custoPorUnidade: any[] = []; 

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100">
      
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
              <option>Julho 2026</option>
              <option>Agosto 2026</option>
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
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Faturamento Geral</p><p className="text-xl font-bold text-[#2ecc71]">R$ {faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#2ecc71]/10 flex items-center justify-center"><ArrowUpCircle className="w-4 h-4 text-[#2ecc71]" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Gasto Consumido</p><p className="text-xl font-bold text-[#e74c3c]">R$ {gastoConsumido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#e74c3c]/10 flex items-center justify-center"><ArrowDownCircle className="w-4 h-4 text-[#e74c3c]" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Faturas Ativas de Cartões</p><p className="text-xl font-bold text-amber-400">R$ 0,00</p></div>
            <div className="h-8 w-8 rounded-full bg-amber-400/10 flex items-center justify-center"><Wallet className="w-4 h-4 text-amber-400" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Saldo Líquido Previsto</p><p className="text-xl font-bold text-white">R$ {(faturamento - gastoConsumido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#3498db]/10 flex items-center justify-center"><Landmark className="w-4 h-4 text-[#3498db]" /></div>
          </div>
        </div>
      </div>

      {/* METRICAS VISUAIS DE INVESTIMENTOS / ALOCAÇÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Distribuição por Categorias */}
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 col-span-2 flex flex-col h-[400px]">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4 shrink-0"><BarChart3 className="w-4 h-4 text-[#6c5ce7]" /> Despesas por Categoria (Visão Completa)</h3>
          
          <div className="space-y-4 overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1">
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
                    <div className="h-full rounded-full" style={{ width: i.pct, backgroundColor: i.cor }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Divisão de Centros de Custo */}
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex flex-col h-[400px]">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-4 shrink-0"><PieChart className="w-4 h-4 text-emerald-500" /> Custo por Unidade</h3>
          
          <div className="space-y-4 my-auto">
            {custoPorUnidade.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center">Nenhum custo apropriado.</p>
            ) : (
              custoPorUnidade.map((u, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs border-b border-white/[0.03] pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: u.cor }} />
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
