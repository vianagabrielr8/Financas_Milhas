import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRightLeft, Calendar, ShoppingCart, User, Plus, X, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TransferenciasInteligente() {
  // ==========================================
  // ESTADOS DA TRANSFERÊNCIA
  // ==========================================
  const [titularId, setTitularId] = useState('');
  const [origemId, setOrigemId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  
  const [paridadeOrigem, setParidadeOrigem] = useState<number>(1);
  const [paridadeDestino, setParidadeDestino] = useState<number>(1);
  
  const [qtdSaida, setQtdSaida] = useState<string>('');
  const [bonusPromo, setBonusPromo] = useState<string>('0');
  const [dataOperacao, setDataOperacao] = useState(new Date().toISOString().split('T')[0]);

  // ==========================================
  // ESTADOS DO MODAL (Compra de Pontos)
  // ==========================================
  const [modalAberto, setModalAberto] = useState(false);
  const [contaIdModal, setContaIdModal] = useState('');
  const [programaIdModal, setProgramaIdModal] = useState('');
  const [tipoTransacaoModal, setTipoTransacaoModal] = useState('Compra');
  const [qtdMilhasModal, setQtdMilhasModal] = useState('');
  const [modoValorModal, setModoValorModal] = useState<'MILHEIRO' | 'TOTAL'>('MILHEIRO');
  const [valorInputModal, setValorInputModal] = useState('');
  const [dataTransacaoModal, setDataTransacaoModal] = useState(new Date().toISOString().split('T')[0]);
  const [dataExpiracaoModal, setDataExpiracaoModal] = useState('');
  const [usouCartaoModal, setUsouCartaoModal] = useState(false);
  const [dataPagamentoModal, setDataPagamentoModal] = useState(new Date().toISOString().split('T')[0]);
  const [cartaoIdModal, setCartaoIdModal] = useState('');
  const [parcelasModal, setParcelasModal] = useState('1');
  const [observacoesModal, setObservacoesModal] = useState('');

  // ==========================================
  // BUSCAS NO BANCO
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
  // CÁLCULOS
  // ==========================================
  const titularSelecionado = titulares.find((t: any) => t.id === titularId);
  const programaOrigem = programas.find((p: any) => p.id === origemId);
  const programaDestino = programas.find((p: any) => p.id === destinoId);

  const calculosResumo = useMemo(() => {
    const saida = parseFloat(qtdSaida) || 0;
    const bonus = parseFloat(bonusPromo) || 0;
    const pOrigem = paridadeOrigem || 1;
    const pDestino = paridadeDestino || 1;

    const conversaoBase = (saida / pOrigem) * pDestino;
    const saldoFinal = conversaoBase + (conversaoBase * (bonus / 100));

    return { saida, conversaoBase, saldoFinal };
  }, [qtdSaida, bonusPromo, paridadeOrigem, paridadeDestino]);

  const totalFinanceiroModal = useMemo(() => {
    const qtd = parseFloat(qtdMilhasModal) || 0;
    const val = parseFloat(valorInputModal) || 0;
    if (modoValorModal === 'MILHEIRO') return (qtd / 1000) * val;
    return val;
  }, [qtdMilhasModal, valorInputModal, modoValorModal]);

  // ==========================================
  // HANDLERS
  // ==========================================
  const resetFormModal = () => {
    setContaIdModal(''); setProgramaIdModal(''); setTipoTransacaoModal('Compra');
    setQtdMilhasModal(''); setModoValorModal('MILHEIRO'); setValorInputModal('');
    setDataTransacaoModal(new Date().toISOString().split('T')[0]); setDataExpiracaoModal('');
    setUsouCartaoModal(false); setDataPagamentoModal(new Date().toISOString().split('T')[0]);
    setCartaoIdModal(''); setParcelasModal('1'); setObservacoesModal('');
  };

  const handleSalvarTransferencia = () => {
    if (!titularId || !origemId || !destinoId) return alert("Preencha a rota da transferência.");
    alert("Transferência pronta para registrar!");
  };

  const abrirModalComDados = () => {
    setContaIdModal(titularId);
    setProgramaIdModal(origemId);
    setTipoTransacaoModal('Compra');
    setModalAberto(true);
  };

  return (
    <div className="flex flex-col w-full min-h-screen pb-10 p-4 md:p-8 text-gray-200">
      
      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-3xl text-white font-bold tracking-tight">Transferência Inteligente</h1>
        <p className="text-gray-400 mt-1 text-sm">Transfira pontos com paridade personalizada, bônus real e vincule compras detalhadas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA (FORMULÁRIO) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* BLOCO 1: Rota */}
          <div className="bg-[#111114] border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-bold flex items-center gap-2 mb-6">
              <ArrowRightLeft className="w-5 h-5 text-[#12b886]" /> 1. Rota da Transferência
            </h3>
            
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold text-[#12b886] flex items-center gap-1 mb-2 uppercase tracking-wide"><User className="w-3 h-3" /> Quem é o titular?</label>
                <select value={titularId} onChange={(e) => setTitularId(e.target.value)} className="w-full bg-[#1a1a20] text-gray-300 border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors appearance-none">
                  <option value="" disabled>Selecione o dono dos pontos</option>
                  {titulares.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block">Sai de (Origem)</label>
                  <select value={origemId} onChange={(e) => setOrigemId(e.target.value)} className="w-full bg-[#1a1a20] text-gray-300 border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors appearance-none">
                    <option value="" disabled>Ex: Esfera</option>
                    {programas.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 mb-2 block">Entra em (Destino)</label>
                  <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className="w-full bg-[#1a1a20] text-gray-300 border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none transition-colors appearance-none">
                    <option value="" disabled>Ex: Iberia</option>
                    {programas.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 2: Regras */}
          <div className="bg-[#111114] border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-bold flex items-center gap-2 mb-6 text-lg">
              <span className="text-[#12b886] text-xl">⚖</span> 2. Regras e Quantidade
            </h3>
            
            <div className="mb-6">
              <label className="text-sm font-bold text-white mb-3 block">Paridade (Fator de Conversão)</label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold block mb-1 text-center">Origem</label>
                  <input type="number" min="1" value={paridadeOrigem} onChange={(e) => setParidadeOrigem(Number(e.target.value))} className="w-full bg-[#1a1a20] text-white text-center border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none" />
                </div>
                <div className="flex flex-col items-center justify-center mt-4">
                  <ArrowRightLeft className="w-4 h-4 text-gray-500" />
                  <span className="text-[9px] uppercase font-bold text-gray-500 mt-1 tracking-wider">Equivale A</span>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold block mb-1 text-center">Destino</label>
                  <input type="number" min="1" value={paridadeDestino} onChange={(e) => setParidadeDestino(Number(e.target.value))} className="w-full bg-[#1a1a20] text-white text-center border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-red-400 mb-2 block">Qtd. de Saída</label>
                <input type="number" value={qtdSaida} onChange={(e) => setQtdSaida(e.target.value)} placeholder="0" className="w-full bg-[#1a1a20] text-white border border-red-900/30 rounded-lg p-3 focus:border-red-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#12b886] mb-2 block">Bônus Promo (%)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#12b886] font-bold">%</span>
                  <input type="number" value={bonusPromo} onChange={(e) => setBonusPromo(e.target.value)} placeholder="0" className="w-full bg-[#1a1a20] text-white border border-[#12b886]/30 rounded-lg p-3 pl-8 focus:border-[#12b886] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-white mb-2 block">Data da Operação</label>
                <div className="relative">
                  <input type="date" value={dataOperacao} onChange={(e) => setDataOperacao(e.target.value)} className="w-full bg-[#1a1a20] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none [color-scheme:dark]" />
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 3: Compra Opcional */}
          <div className="bg-[#111114] border border-gray-800 rounded-xl p-6">
            <h3 className="text-white font-bold flex items-center gap-2 mb-2 text-lg">
              <ShoppingCart className="w-5 h-5 text-gray-500" /> 3. Compra de Pontos (Opcional)
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Faltaram milhas na conta de origem? Registre a compra que você fez no carrinho para que o sistema atualize seu estoque e alimente o <strong>Contas a Pagar</strong> corretamente.
            </p>
            <button onClick={abrirModalComDados} className="bg-transparent border border-[#12b886] text-[#12b886] hover:bg-[#12b886]/10 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
              <ShoppingCart className="w-4 h-4" /> + Registrar Compra de Pontos
            </button>
          </div>
        </div>

        {/* COLUNA DIREITA (RESUMO) */}
        <div className="bg-[#111114] border border-gray-800 rounded-xl p-6 flex flex-col h-max sticky top-6">
          <h3 className="text-[#12b886] font-bold flex items-center justify-center gap-2 mb-8 text-lg">
            <ArrowRightLeft className="w-5 h-5" /> Resumo da Operação
          </h3>

          <div className="text-center mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Titular da Conta</p>
            <p className="text-white font-bold flex items-center justify-center gap-1">
              <User className="w-4 h-4 text-[#12b886]" /> {titularSelecionado ? titularSelecionado.nome : 'Titular'}
            </p>
          </div>

          <div className="border border-gray-800 bg-[#1a1a20] rounded-xl p-4 mb-8">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-gray-400">SAI DE</span>
              <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-[10px] font-black tracking-wider">ORIGEM</span>
            </div>
            <div className="flex justify-center mb-4">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                <ArrowRightLeft className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-400">ENTRA EM</span>
              <span className="bg-[#12b886]/20 text-[#12b886] px-2 py-0.5 rounded text-[10px] font-black tracking-wider">DESTINO</span>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-sm text-gray-400 font-medium">Saída (Origem)</span>
              <span className="text-red-400 font-bold">- {calculosResumo.saida.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-800 pb-2">
              <span className="text-sm text-gray-400 font-medium">Conversão Base ({paridadeOrigem}:{paridadeDestino})</span>
              <span className="text-white font-bold">{calculosResumo.conversaoBase.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          <div className="bg-[#12b886]/10 border border-[#12b886]/30 rounded-xl p-4 text-center mb-8">
            <p className="text-[10px] text-[#12b886] uppercase tracking-wider font-black mb-1">Saldo Final a Receber</p>
            <p className="text-3xl text-[#12b886] font-black">{calculosResumo.saldoFinal.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-gray-400 mt-1">creditados em Destino</p>
          </div>

          <button onClick={handleSalvarTransferencia} className="w-full bg-[#1cd4a0] hover:bg-[#12b886] text-[#0a0a0b] py-3.5 rounded-xl font-black text-sm transition-colors mt-auto">
            Confirmar Transferência
          </button>
        </div>
      </div>

      {/* ==========================================
          MODAL: COMPRA DE PONTOS (Opcional)
          ========================================== */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#15151a] w-full max-w-2xl border border-gray-800 rounded-2xl shadow-2xl flex flex-col max-h-[95vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-800 shrink-0">
              <div className="flex items-center gap-2 text-white">
                <TrendingDown className="w-5 h-5 text-red-500" />
                <h2 className="text-xl font-bold">Nova Transação (Compra)</h2>
              </div>
              <button onClick={() => { setModalAberto(false); resetFormModal(); }} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <form className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Conta *</label>
                  <select required value={contaIdModal} onChange={(e) => setContaIdModal(e.target.value)} className="w-full bg-[#0a0a0b] text-gray-300 border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none">
                    <option value="" disabled>Buscar Conta</option>
                    {titulares.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Programa *</label>
                  <select required value={programaIdModal} onChange={(e) => setProgramaIdModal(e.target.value)} className="w-full bg-[#0a0a0b] text-gray-300 border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none">
                    <option value="" disabled>Buscar Programa</option>
                    {programas.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-white mb-2">Tipo de Transação *</label>
                <select disabled value={tipoTransacaoModal} className="w-full bg-[#0a0a0b] text-gray-500 border border-gray-800 rounded-lg p-3 outline-none cursor-not-allowed">
                  <option value="Compra">Compra</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 items-start">
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Quantidade de Milhas (Base) *</label>
                  <input type="number" required value={qtdMilhasModal} onChange={(e) => setQtdMilhasModal(e.target.value)} placeholder="Ex: 50000" className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-white">Valor da Compra *</label>
                    <div className="flex bg-[#0a0a0b] border border-gray-800 rounded-lg p-0.5">
                      <button type="button" onClick={() => setModoValorModal('MILHEIRO')} className={cn("px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all", modoValorModal === 'MILHEIRO' ? "bg-white/10 text-white" : "text-gray-500")}>Por Milheiro</button>
                      <button type="button" onClick={() => setModoValorModal('TOTAL')} className={cn("px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all", modoValorModal === 'TOTAL' ? "bg-white/10 text-white" : "text-gray-500")}>Valor Total</button>
                    </div>
                  </div>
                  <input type="number" step="0.01" value={valorInputModal} onChange={(e) => setValorInputModal(e.target.value)} placeholder={modoValorModal === 'MILHEIRO' ? "Ex: 20.50 (Preço por milheiro)" : "Ex: 1025.00"} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none" />
                  <p className="text-right text-xs text-gray-500 mt-2 font-medium">Total Financeiro: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFinanceiroModal)}</p>
                </div>
              </div>

              <div className="p-5 border border-gray-800 rounded-xl bg-[#1a1a20]/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-white font-bold text-sm"><Calendar className="w-4 h-4 text-gray-400" />Usou Cartão de Crédito?</div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={usouCartaoModal} onChange={(e) => setUsouCartaoModal(e.target.checked)}/>
                    <div className="w-11 h-6 bg-gray-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-400 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#12b886]"></div>
                  </label>
                </div>

                {!usouCartaoModal ? (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-bold text-white">Data do Pagamento (Vencimento)</label>
                    </div>
                    <input type="date" value={dataPagamentoModal} onChange={(e) => setDataPagamentoModal(e.target.value)} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none [color-scheme:dark]" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-white mb-2">Cartão</label>
                      <select required value={cartaoIdModal} onChange={(e) => setCartaoIdModal(e.target.value)} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none">
                        <option value="" disabled>Selecione</option>
                        {cartoes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-white mb-2">Parcelas</label>
                      <select value={parcelasModal} onChange={(e) => setParcelasModal(e.target.value)} className="w-full bg-[#0a0a0b] text-white border border-gray-800 rounded-lg p-3 focus:border-[#12b886] outline-none">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                          <option key={num} value={num}>{num}x de {(totalFinanceiroModal / num).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </form>

            <div className="p-6 border-t border-gray-800 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => { setModalAberto(false); resetFormModal(); }} className="px-5 py-2.5 text-sm font-bold text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border border-gray-800">Cancelar</button>
              <button type="button" onClick={() => { alert("Compra base registrada!"); setModalAberto(false); resetFormModal(); }} className="bg-[#12b886] hover:bg-[#0ca678] text-[#0a0a0b] px-6 py-2.5 rounded-lg text-sm font-extrabold transition-all">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}