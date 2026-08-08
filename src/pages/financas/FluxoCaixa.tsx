import { useState } from 'react';
import { CalendarDays, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

// Mock de dados mantido para simulação
const fluxoMock = [
  { dia: '2026-07-05', formatado: '05 de Julho', totalDia: -6927.37, itens: [{ id: 1, desc: 'Fatura Latam Pass Black', valor: -6927.37, tipo: 'DESPESA', status: 'PENDENTE' }] },
  { dia: '2026-07-10', formatado: '10 de Julho', totalDia: -340, itens: [{ id: 2, desc: 'Condomínio', valor: -650.00, tipo: 'DESPESA', status: 'PAGO' }, { id: 3, desc: 'Reembolso Cliente', valor: 310.00, tipo: 'RECEITA', status: 'PAGO' }] },
  { dia: '2026-07-15', formatado: '15 de Julho', totalDia: -1200, itens: [{ id: 4, desc: 'Compra Exemplo Hoje', valor: -1200.00, tipo: 'DESPESA', status: 'PENDENTE' }] }
];

export default function FluxoCaixa() {
  // Inicializa com a data de hoje formatada como YYYY-MM-DD
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);

  // Filtra apenas o dia selecionado
  const diaFiltrado = fluxoMock.find(f => f.dia === dataSelecionada);

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto text-zinc-100 p-4 md:p-6 pb-24">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#141417] p-4 rounded-xl border border-white/5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluxo de Pagamentos</h1>
          <p className="text-zinc-400 text-xs mt-0.5">Visão detalhada das movimentações do dia.</p>
        </div>
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
          <CalendarDays className="w-4 h-4 text-zinc-400" />
          <input 
            type="date" 
            value={dataSelecionada} 
            onChange={(e) => setDataSelecionada(e.target.value)} 
            className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer [color-scheme:dark]" 
          />
        </div>
      </div>

      {diaFiltrado ? (
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl overflow-hidden">
          <div className="bg-black/20 p-4 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#10b981]" /> {diaFiltrado.formatado}
            </h3>
            <span className="font-bold text-sm text-[#e74c3c]">
              R$ {Math.abs(diaFiltrado.totalDia).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {diaFiltrado.itens.map(item => (
              <div key={item.id} className="p-4 flex justify-between items-center hover:bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  {item.tipo === 'DESPESA' ? <ArrowDownCircle className="w-5 h-5 text-[#e74c3c]" /> : <ArrowUpCircle className="w-5 h-5 text-[#2ecc71]" />}
                  <div>
                    <p className="text-sm font-semibold text-white">{item.desc}</p>
                    <p className={`text-[10px] font-bold mt-0.5 ${item.status === 'PAGO' ? 'text-emerald-500' : 'text-amber-500'}`}>{item.status}</p>
                  </div>
                </div>
                <span className={`font-bold text-sm ${item.tipo === 'DESPESA' ? 'text-[#e74c3c]' : 'text-[#2ecc71]'}`}>
                  {item.tipo === 'DESPESA' ? '-' : '+'} R$ {Math.abs(item.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-zinc-500">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhuma movimentação encontrada para esta data.</p>
        </div>
      )}
    </div>
  );
}