import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CalendarDays, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';

export default function FluxoCaixa() {
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);

  // Busca todas as transações, cartões e contas associadas
  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ['fluxo_caixa_geral'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transacao_pessoal')
        .select('*, cartao_pessoal(nome, dia_vencimento), conta_financeira_pessoal(nome)');
      if (error) throw error;
      return data || [];
    }
  });

  const diaFiltrado = useMemo(() => {
    if (!transacoes.length) return null;

    const [anoSel, mesSel, diaSel] = dataSelecionada.split('-');
    const dataAlvo = new Date(Number(anoSel), Number(mesSel) - 1, Number(diaSel));
    
    // Nomes dos meses para comparar com "mes_fatura" (ex: "Set/2026")
    const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const mascaraFatura = `${mesesNomes[Number(mesSel) - 1]}/${anoSel}`;

    // Filtra as transações cujo fluxo de caixa acontece NA DATA SELECIONADA
    const itensDoDia = transacoes.filter((t: any) => {
      // REGRA 1: É de Cartão de Crédito?
      // O fluxo de caixa ocorre no DIA DO VENCIMENTO DA FATURA
      if (t.cartao_id && t.cartao_pessoal) {
        return (
          t.mes_fatura === mascaraFatura && 
          Number(t.cartao_pessoal.dia_vencimento) === Number(diaSel)
        );
      } 
      
      // REGRA 2: É Conta Corrente / Dinheiro?
      // O fluxo de caixa ocorre na PRÓPRIA DATA DA TRANSAÇÃO
      if (t.data) {
        return t.data === dataSelecionada;
      }

      return false;
    });

    if (itensDoDia.length === 0) return null;

    let totalDia = 0;
    const itens = itensDoDia.map((t: any) => {
      const valor = Number(t.valor);
      const isDespesa = t.tipo === 'DESPESA';
      totalDia += isDespesa ? -valor : valor;

      return {
        id: t.id,
        desc: t.descricao,
        valor: valor,
        tipo: t.tipo,
        status: t.situacao,
        origem: t.cartao_id ? `💳 ${t.cartao_pessoal.nome}` : `🏦 ${t.conta_financeira_pessoal?.nome || 'Caixa'}`,
      };
    });

    return {
      formatado: format(dataAlvo, "dd 'de' MMMM", { locale: ptBR }),
      totalDia,
      itens
    };
  }, [transacoes, dataSelecionada]);


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

      {isLoading ? (
         <div className="text-center py-20 text-emerald-500 font-medium">Carregando fluxo de caixa...</div>
      ) : diaFiltrado ? (
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#141417] p-4 border-b border-white/5 flex justify-between items-center">
            <h3 className="font-bold text-white flex items-center gap-2 capitalize">
              <CalendarDays className="w-4 h-4 text-[#10b981]" /> {diaFiltrado.formatado}
            </h3>
            <span className={`font-black text-lg ${diaFiltrado.totalDia >= 0 ? 'text-[#10b981]' : 'text-[#ef4444]'}`}>
              R$ {Math.abs(diaFiltrado.totalDia).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {diaFiltrado.itens.map((item: any) => (
              <div key={item.id} className="p-5 flex justify-between items-center hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  {item.tipo === 'DESPESA' ? <ArrowDownCircle className="w-6 h-6 text-[#ef4444]" /> : <ArrowUpCircle className="w-6 h-6 text-[#10b981]" />}
                  <div>
                    <p className="text-base font-semibold text-white">{item.desc}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${item.status === 'PAGO' || item.status === 'RECEBIDO' ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                        {item.status}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-medium">{item.origem}</span>
                    </div>
                  </div>
                </div>
                <span className={`font-bold text-base whitespace-nowrap ${item.tipo === 'DESPESA' ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
                  {item.tipo === 'DESPESA' ? '-' : '+'} R$ {Math.abs(item.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-24 bg-[#141417] rounded-2xl border border-white/5">
          <CalendarDays className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-lg font-bold text-white mb-1">Dia Livre!</h3>
          <p className="text-sm text-zinc-400">Nenhum pagamento ou recebimento agendado para esta data.</p>
        </div>
      )}
    </div>
  );
}
