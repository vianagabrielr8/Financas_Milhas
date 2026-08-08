import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Plus, X, Calendar, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Estoque() {
  const [modalAberto, setModalAberto] = useState(false);

  // ==========================================
  // ESTADOS DO MODAL (Nova Transação)
  // ==========================================
  const [contaId, setContaId] = useState('');
  const [programaId, setProgramaId] = useState('');
  const [tipoTransacao, setTipoTransacao] = useState('Compra');
  
  const [qtdMilhas, setQtdMilhas] = useState('');
  const [modoValor, setModoValor] = useState<'MILHEIRO' | 'TOTAL'>('MILHEIRO');
  const [valorInput, setValorInput] = useState('');
  
  const [dataTransacao, setDataTransacao] = useState(new Date().toISOString().split('T')[0]);
  const [dataExpiracao, setDataExpiracao] = useState('');
  
  const [usouCartao, setUsouCartao] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [cartaoId, setCartaoId] = useState('');
  const [parcelas, setParcelas] = useState('1');
  
  const [observacoes, setObservacoes] = useState('');

  // ==========================================
  // BUSCAS NO BANCO (Protegidas contra undefined)
  // ==========================================
  const { data: titulares = [] } = useQuery({
    queryKey: ['contas_titulares_milhas'],
    queryFn: async () => {
      const { data } = await supabase.from('contas_titulares').select('*').order('nome');
      return data || [];
    }
  });

  const { data: programas = [] } = useQuery({
    queryKey: ['programas_fidelidade_milhas'],
    queryFn: async () => {
      const { data } = await supabase.from('programas_fidelidade').select('*').order('nome');
      return data || [];
    }
  });

  const { data: cartoes = [] } = useQuery({
    queryKey: ['cartoes_pessoais_milhas'],
    queryFn: async () => {
      const { data } = await supabase.from('cartao_pessoal').select('*').order('nome');
      return data || [];
    }
  });

  // ==========================================
  // LÓGICA E CÁLCULOS DINÂMICOS
  // ==========================================
  const TIPOS_TRANSACAO = [
    "Compra", "Venda", "Bônus", "Transferência Entrada", 
    "Transferência Saída", "Uso/Resgate", "Expirado"
  ];

  const totalFinanceiro = useMemo(() => {
    const qtd = parseFloat(qtdMilhas) || 0;
    const val = parseFloat(valorInput) || 0;
    
    if (modoValor === 'MILHEIRO') {
      return (qtd / 1000) * val;
    }
    return val;
  }, [qtdMilhas, valorInput, modoValor]);

  const resetForm = () => {
    setContaId(''); setProgramaId(''); setTipoTransacao('Compra');
    setQtdMilhas(''); setModoValor('MILHEIRO'); setValorInput('');
    setDataTransacao(new Date().toISOString().split('T')[0]); setDataExpiracao('');
    setUsouCartao(false); setDataPagamento(new Date().toISOString().split('T')[0]);
    setCartaoId(''); setParcelas('1'); setObservacoes('');
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contaId || !programaId) return alert("Preencha Conta e Programa.");
    
    alert("Dados prontos para salvar no Supabase! (Falta conectar a função de insert)");
    // Aqui entrará o seu insert na tabela movimentacao_milhas depois
    
    setModalAberto(false);
    resetForm();
  };

  return (
    <div className="flex flex-col w-full min-h-screen pb-10 p-4 md:p-6 text-gray-200">
      
      {/* HEADER DA PÁGINA (Exemplo) */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl text-white font-bold tracking-tight">Estoque de Milhas</h1>
          <p className="text-gray-400 mt-1 text-sm">Gerencie suas entradas e saídas de milhas.</p>
        </div>
        
        <button 
          onClick={() => setModalAberto(true)} 
          className="bg-[#12b886] hover:bg-[#0ca678] text-white px-5 py-2.5 rounded-lg font-bold transition-all flex items-center gap-2 shadow-lg shadow-[#12b886]/20"
        >
          <Plus className="w-5 h-5" /> Nova Transação
        </button>
      </div>

      <div className="bg-[#1a1a20] border border-gray-800 rounded-xl p-8 flex justify-center items-center h-64 text-gray-500">
        Tabela de estoque aparecerá aqui...
      </div>

      {/* ==========================================
          MODAL: NOVA TRANSAÇÃO
          ========================================== */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          
          <div className="bg-[#15151a] w-full max-w-2xl border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2 text-white">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <h2 className="text-xl font-bold">Nova Transação</h2>
              </div>
              <button onClick={() => { setModalAberto(false); resetForm(); }} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form onSubmit={handleSalvar} className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              
              {/* LINHA 1: Conta e Programa */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Conta *</label>
                  <select required value={contaId} onChange={(e) => setContaId(e.target.value)} className="w-full bg-[#0a0a0b] text-gray-300 border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors appearance-none">
                    <option value="" disabled>Buscar Conta</option>
                    {titulares.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Programa *</label>
                  <select required value={programaId} onChange={(e) => setProgramaId(e.target.value)} className="w-full bg-[#0a0a0b] text-gray-300 border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors appearance-none">
                    <option value="" disabled>Buscar Programa</option>
                    {programas.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* LINHA 2: Tipo de Transação */}
              <div>
                <label className="block text-sm font-bold text-white mb-2">Tipo de Transação *</label>
                <select required value={tipoTransacao} onChange={(e) => setTipoTransacao(e.target.value)} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors appearance-none">
                  {TIPOS_TRANSACAO.map(tipo => <option key={tipo} value={tipo} className="text-white bg-[#15151a]">{tipo}</option>)}
                </select>
              </div>

              {/* LINHA 3: Quantidade e Valor */}
              <div className="grid grid-cols-2 gap-4 items-start">
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Quantidade de Milhas (Base) *</label>
                  <input type="number" required value={qtdMilhas} onChange={(e) => setQtdMilhas(e.target.value)} placeholder="Ex: 50000" className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors placeholder-gray-600" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-white">Valor da Compra *</label>
                    <div className="flex bg-[#0a0a0b] border border-gray-800 rounded-lg p-0.5 overflow-hidden">
                      <button type="button" onClick={() => setModoValor('MILHEIRO')} className={cn("px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all", modoValor === 'MILHEIRO' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}>Por Milheiro</button>
                      <button type="button" onClick={() => setModoValor('TOTAL')} className={cn("px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all", modoValor === 'TOTAL' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300")}>Valor Total</button>
                    </div>
                  </div>
                  <input type="number" step="0.01" value={valorInput} onChange={(e) => setValorInput(e.target.value)} placeholder={modoValor === 'MILHEIRO' ? "Ex: 20.50 (Preço por milheiro)" : "Ex: 1025.00 (Valor Total)"} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors placeholder-gray-600" />
                  <p className="text-right text-xs text-gray-500 mt-2 font-medium">
                    Total Financeiro: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFinanceiro)}
                  </p>
                </div>
              </div>

              {/* LINHA 4: Datas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Data da Transação</label>
                  <div className="relative">
                    <input type="date" required value={dataTransacao} onChange={(e) => setDataTransacao(e.target.value)} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors [color-scheme:dark]" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Data de Expiração</label>
                  <div className="relative">
                    <input type="date" value={dataExpiracao} onChange={(e) => setDataExpiracao(e.target.value)} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors [color-scheme:dark]" />
                  </div>
                </div>
              </div>

              {/* LINHA 5: Seção Cartão de Crédito / Pagamento */}
              <div className="p-5 border border-gray-800 rounded-xl bg-[#1a1a20]/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    Usou Cartão de Crédito?
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={usouCartao} onChange={(e) => setUsouCartao(e.target.checked)}/>
                    <div className="w-11 h-6 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#12b886]"></div>
                  </label>
                </div>

                {!usouCartao ? (
                  // OFF: Pagar à vista
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-bold text-white">Data do Pagamento (Vencimento)</label>
                      <button type="button" onClick={() => setDataPagamento(new Date().toISOString().split('T')[0])} className="text-[#12b886] text-xs font-bold hover:underline flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Pagar Hoje
                      </button>
                    </div>
                    <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors [color-scheme:dark]" />
                  </div>
                ) : (
                  // ON: Usou Cartão de Crédito
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                    <div>
                      <label className="block text-sm font-bold text-white mb-2">Cartão</label>
                      <select required value={cartaoId} onChange={(e) => setCartaoId(e.target.value)} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors appearance-none">
                        <option value="" disabled>Selecione</option>
                        {cartoes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-white mb-2">Parcelas</label>
                      <select value={parcelas} onChange={(e) => setParcelas(e.target.value)} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors appearance-none">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>
                            {num}x de {(totalFinanceiro / num).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* LINHA 6: Observações */}
              <div>
                <label className="block text-sm font-bold text-white mb-2">Observações</label>
                <textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações (opcional)" className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors placeholder-gray-600 resize-none" />
              </div>

            </form>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-800 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => { setModalAberto(false); resetForm(); }} className="px-5 py-2.5 text-sm font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border border-gray-800">
                Cancelar
              </button>
              <button type="button" onClick={handleSalvar} className="bg-[#12b886] hover:bg-[#0ca678] text-[#0a0a0b] px-6 py-2.5 rounded-lg text-sm font-extrabold transition-all">
                Registrar
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}