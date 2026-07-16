import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, DollarSign, Receipt, FileText, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const transacoesFatura = [
  { id: 1, data: '2026-06-09', desc: 'SHOPEE *AlegrartPe (7/10)', obs: 'Presente Bento', cat: 'Outros', valor: 62.00 },
  { id: 2, data: '2026-06-09', desc: 'DSM TELECOM (7/7)', obs: 'Internet Casa', cat: 'Moradia', valor: 149.90 },
  { id: 3, data: '2026-06-09', desc: 'JIM.COM* OMEGA PER (7/10)', obs: '', cat: 'Pessoal - Ingrid', valor: 175.00 },
  { id: 4, data: '2026-06-09', desc: 'LIVELO (7/11)', obs: 'Compra de Lote Promocional', cat: 'Milhas', valor: 196.00 }
];

export default function FaturaCartao() {
  const [mes, setMes] = useState('Jul');

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-4 md:p-6 pb-24">
      
      {/* HEADER TIPO MOBILLS */}
      <div className="flex items-center gap-4">
        <Link to="/financas/cartoes">
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white"><ChevronLeft className="w-6 h-6" /></Button>
        </Link>
        <div className="bg-[#10b981] text-black px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
          Cartão: LATAM PASS BLACK
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LADO ESQUERDO: TRANSAÇÕES */}
        <div className="lg:col-span-2 bg-[#1e1e24] border border-white/5 rounded-2xl p-6">
          
          {/* SELETOR DE MESES */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <Button variant="ghost" size="icon" className="text-[#10b981] hover:bg-[#10b981]/10"><ChevronLeft className="w-5 h-5" /></Button>
            <span className="text-[#10b981] font-bold text-sm">2026</span>
            <Button variant="ghost" size="icon" className="text-[#10b981] hover:bg-[#10b981]/10"><ChevronRight className="w-5 h-5" /></Button>
          </div>
          <div className="flex justify-between overflow-x-auto pb-4 scrollbar-hide gap-2 mb-6">
            {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map(m => (
              <button key={m} onClick={() => setMes(m)} className={cn("px-4 py-1.5 rounded-full text-xs font-bold border transition-colors", mes === m ? "border-[#10b981] text-[#10b981] bg-[#10b981]/10" : "border-white/10 text-zinc-500 hover:border-[#10b981]/50")}>
                {m}
              </button>
            ))}
          </div>

          {/* LISTA DE TRANSAÇÕES */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-zinc-400 font-bold uppercase border-b border-white/5">
                <tr><th className="pb-3">Data</th><th className="pb-3">Descrição / Observação</th><th className="pb-3">Categoria</th><th className="pb-3 text-right">Valor</th><th className="pb-3 text-center">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transacoesFatura.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02]">
                    <td className="py-4 text-zinc-300">{new Date(t.data).toLocaleDateString('pt-BR')}</td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{t.desc}</span>
                        {t.obs && <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5"><FileText className="w-3 h-3" /> {t.obs}</span>}
                      </div>
                    </td>
                    <td className="py-4"><span className="bg-white/5 px-2.5 py-1 rounded-full text-xs text-zinc-300">{t.cat}</span></td>
                    <td className="py-4 text-right font-bold text-[#e74c3c]">- R$ {t.valor.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td className="py-4 text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white"><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* LADO DIREITO: RESUMO DA FATURA */}
        <div className="space-y-4">
          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Valor da fatura</p><p className="text-2xl font-bold text-white">R$ 6.927,37</p></div>
            <div className="w-10 h-10 rounded-full bg-[#10b981]/20 flex items-center justify-center"><DollarSign className="w-5 h-5 text-[#10b981]" /></div>
          </div>
          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Status</p><p className="text-xl font-bold text-white">Fatura aberta</p></div>
            <div className="w-10 h-10 rounded-full bg-[#3498db]/20 flex items-center justify-center"><Receipt className="w-5 h-5 text-[#3498db]" /></div>
          </div>
          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Dia de fechamento</p><p className="text-xl font-bold text-white">28 de {mes}</p></div>
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center"><Calendar className="w-5 h-5 text-amber-500" /></div>
          </div>
          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Data vencimento</p><p className="text-xl font-bold text-white">05 de {mes}</p></div>
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center"><Calendar className="w-5 h-5 text-red-500" /></div>
          </div>
        </div>

      </div>
    </div>
  );
}