import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Target, AlertTriangle, CheckCircle2, Edit2, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Metas() {
  const [mes, setMes] = useState('Julho 2026');

  // BUSCA AS CATEGORIAS REAIS DO SUPABASE
  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias_metas'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categoria_pessoal').select('*').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const metasProcessadas = useMemo(() => {
    return categorias.map((cat: any) => ({
      id: cat.id,
      categoria: cat.nome,
      meta: Number(cat.teto_gastos) || 0,
      gasto: 0, 
      cor: cat.cor || '#3498db',
      icon: cat.icone || '📊'
    }));
  }, [categorias]);
  
  const totalMeta = metasProcessadas.reduce((acc: number, m: any) => acc + m.meta, 0);
  const totalGasto = metasProcessadas.reduce((acc: number, m: any) => acc + m.gasto, 0);
  const percentualGeral = totalMeta > 0 ? (totalGasto / totalMeta) * 100 : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#141417] p-4 rounded-xl border border-white/5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-500" /> Metas e Orçamento
          </h1>
          <p className="text-zinc-400 text-xs mt-0.5">Defina limites de gastos por categoria e acompanhe o saldo restante do mês.</p>
        </div>
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
          <CalendarDays className="w-4 h-4 text-zinc-400" />
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer">
            <option>Julho 2026</option>
            <option>Agosto 2026</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5">
          <p className="text-zinc-400 text-xs font-medium mb-1">Orçamento Total Definido</p>
          <p className="text-2xl font-bold text-white">R$ {totalMeta.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5">
          <p className="text-zinc-400 text-xs font-medium mb-1">Total Consumido</p>
          <p className={cn("text-2xl font-bold", totalGasto > totalMeta ? "text-red-400" : "text-emerald-400")}>R$ {totalGasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5">
          <p className="text-zinc-400 text-xs font-medium mb-1">Saldo Livre Restante</p>
          <p className={cn("text-2xl font-bold", totalMeta - totalGasto < 0 ? "text-red-400" : "text-[#3498db]")}>
            R$ {(totalMeta - totalGasto).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
          </p>
        </div>
      </div>

      <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6">
        <div className="flex justify-between items-end mb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Consumo Global do Mês</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Você consumiu {percentualGeral.toFixed(1)}% do seu orçamento total planejado.</p>
          </div>
          {percentualGeral > 100 ? (
            <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-md border border-red-400/20"><AlertTriangle className="w-3.5 h-3.5" /> Estourado</span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md border border-emerald-400/20"><CheckCircle2 className="w-3.5 h-3.5" /> Dentro da meta</span>
          )}
        </div>
        <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
          <div className={cn("h-full rounded-full transition-all", percentualGeral > 100 ? "bg-red-500" : percentualGeral > 85 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(percentualGeral, 100)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {metasProcessadas.length === 0 && (
          <p className="text-zinc-500 col-span-2 text-center py-10">Nenhuma categoria com meta/orçamento definida.</p>
        )}
        {metasProcessadas.map((item: any) => {
          const percentual = item.meta > 0 ? (item.gasto / item.meta) * 100 : 0;
          const estourou = item.gasto > item.meta;
          const emAlerta = percentual >= 85 && percentual <= 100;
          
          let corBarra = item.cor;
          if (estourou) corBarra = '#e74c3c';
          else if (emAlerta) corBarra = '#f39c12';
          
          return (
            <div key={item.id} className="bg-[#141417] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-lg border border-white/5 shadow-inner">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white">{item.categoria}</h4>
                    <p className="text-[11px] font-medium mt-0.5 text-zinc-500">Meta: R$ {item.meta.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white bg-white/[0.02] rounded-lg"><Edit2 className="w-3.5 h-3.5" /></Button>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-end text-xs">
                  <span className="font-semibold text-zinc-300">Gasto: R$ {item.gasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                  <span className={cn("font-bold", estourou ? "text-red-400" : emAlerta ? "text-amber-400" : "text-emerald-400")}>
                    {percentual.toFixed(1)}%
                  </span>
                </div>
                
                <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(percentual, 100)}%`, backgroundColor: corBarra }} />
                </div>
                
                <div className="flex justify-between text-[10px] font-medium pt-1">
                  <span className="text-zinc-500 uppercase tracking-wider">Saldo Restante:</span>
                  <span className={cn("text-xs", estourou ? "text-red-400 font-bold" : "text-white font-semibold")}>
                    {estourou ? '-' : '+'} R$ {Math.abs(item.meta - item.gasto).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
