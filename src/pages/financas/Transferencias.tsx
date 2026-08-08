import { useState, useMemo } from 'react';
import { 
  ArrowRight, CalendarIcon, User, Wallet, ArrowRightLeft, 
  Scale, Percent, ShoppingCart 
} from 'lucide-react';

const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Dados estáticos para a tela não quebrar (Substitua pelos hooks do Supabase depois)
const mockAccounts = [{ id: '1', name: 'Gabriel Viana' }, { id: '2', name: 'Ingrid Bittencourt' }];
const mockPrograms = [
    { id: 'p1', name: 'Esfera' }, { id: 'p2', name: 'Livelo' },
    { id: 'p3', name: 'Iberia' }, { id: 'p4', name: 'Latam Pass' }
];

export default function Transferencias() {
  const [selectedAccount, setSelectedAccount] = useState('');
  const [sourceProgram, setSourceProgram] = useState('');
  const [destProgram, setDestProgram] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayString());
  
  const [parityIn, setParityIn] = useState('1');
  const [parityOut, setParityOut] = useState('1');
  const [bonusPercent, setBonusPercent] = useState('0');

  const accountName = mockAccounts.find(a => a.id === selectedAccount)?.name || 'Titular';
  const sourceProgramName = mockPrograms.find(p => p.id === sourceProgram)?.name || 'Origem';
  const destProgramName = mockPrograms.find(p => p.id === destProgram)?.name || 'Destino';

  // Lógica matemática complexa preservada
  const calculation = useMemo(() => {
    const qtdOrigem = parseFloat(amount) || 0;
    const pIn = parseFloat(parityIn) || 1;
    const pOut = parseFloat(parityOut) || 1;
    const bonus = parseFloat(bonusPercent) || 0;
    
    const baseDestino = Math.floor((qtdOrigem / pIn) * pOut);
    const bonusAmount = Math.floor(baseDestino * (bonus / 100));
    const totalDestino = baseDestino + bonusAmount;
    
    return { qtdOrigem, pIn, pOut, baseDestino, bonus, bonusAmount, totalDestino };
  }, [amount, parityIn, parityOut, bonusPercent]);

  return (
    <div className="p-6 md:p-8 text-zinc-100 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Transferência Inteligente</h1>
        <p className="text-zinc-400 text-sm">Transfira pontos com paridade personalizada, bônus real e vincule compras detalhadas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA: INPUTS */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* BLOCO 1: ROTA */}
          <div className="bg-[#141417] border border-emerald-900/50 p-6 rounded-xl shadow-lg relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
            <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-500" /> 1. Rota da Transferência
            </h2>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-emerald-500 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Quem é o titular?</label>
                <select 
                  value={selectedAccount} 
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full bg-[#0d0d0f] border border-white/10 p-3 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="">Selecione o dono dos pontos</option>
                  {mockAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">Sai de (Origem)</label>
                  <select 
                    value={sourceProgram} 
                    onChange={(e) => setSourceProgram(e.target.value)}
                    className="w-full bg-[#0d0d0f] border border-white/10 p-3 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/50"
                  >
                    <option value="">Ex: Esfera</option>
                    {mockPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">Entra em (Destino)</label>
                  <select 
                    value={destProgram} 
                    onChange={(e) => setDestProgram(e.target.value)}
                    className="w-full bg-[#0d0d0f] border border-white/10 p-3 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="">Ex: Iberia</option>
                    {mockPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 2: REGRAS */}
          <div className="bg-[#141417] border border-white/5 p-6 rounded-xl shadow-lg">
            <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
              <Scale className="w-4 h-4 text-zinc-500" /> 2. Regras e Quantidade
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">Paridade (Fator de Conversão)</label>
                  <div className="flex items-center justify-between bg-[#0d0d0f] p-4 rounded-xl border border-white/5">
                      <div className="flex flex-col items-center gap-2 w-1/3">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center truncate w-full">ORIGEM</span>
                          <input type="number" value={parityIn} onChange={e => setParityIn(e.target.value)} className="w-full h-10 bg-[#1a1a1f] border border-white/10 rounded-md text-lg font-black text-center text-white focus:outline-none" />
                      </div>
                      <div className="flex flex-col items-center justify-center w-1/3 pt-6">
                          <ArrowRight className="h-5 w-5 text-zinc-600 mb-1" />
                          <span className="text-[9px] font-bold text-zinc-600 uppercase bg-white/5 px-2 py-0.5 rounded-full">Equivale A</span>
                      </div>
                      <div className="flex flex-col items-center gap-2 w-1/3">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center truncate w-full">DESTINO</span>
                          <input type="number" value={parityOut} onChange={e => setParityOut(e.target.value)} className="w-full h-10 bg-[#1a1a1f] border border-white/10 rounded-md text-lg font-black text-center text-white focus:outline-none" />
                      </div>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-red-400">Qtd. de Saída</label>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0" 
                    className="w-full bg-[#0d0d0f] border border-red-900/30 p-3 rounded-lg text-sm text-white focus:outline-none focus:border-red-500/50 font-bold" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-emerald-400">Bônus Promo (%)</label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-3 h-4 w-4 text-emerald-500/50" />
                    <input 
                      type="number" 
                      value={bonusPercent}
                      onChange={e => setBonusPercent(e.target.value)}
                      placeholder="0" 
                      className="w-full bg-[#0d0d0f] border border-emerald-900/30 p-3 pl-9 rounded-lg text-sm text-emerald-400 font-bold focus:outline-none focus:border-emerald-500/50" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-white">Data da Operação</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input 
                      type="date" 
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full bg-[#0d0d0f] border border-white/10 p-3 pl-9 rounded-lg text-sm text-white focus:outline-none" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 3: COMPRA DE PONTOS */}
          <div className="bg-[#141417] border border-white/5 p-6 rounded-xl shadow-lg">
             <h2 className="text-sm font-bold text-zinc-500 mb-3 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> 3. Compra de Pontos (Opcional)
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Faltaram milhas na conta de origem? Registre a compra que você fez no carrinho para que o sistema atualize seu estoque e alimente o <strong className="text-zinc-300">Contas a Pagar</strong> corretamente.
            </p>
            <button className="bg-[#1a1a1f] hover:bg-[#222229] border border-emerald-900/50 text-emerald-500 font-semibold text-xs py-2 px-4 rounded-md flex items-center gap-2 transition-colors">
              <ShoppingCart className="w-3.5 h-3.5" /> + Registrar Compra de Pontos
            </button>
          </div>

        </div>

        {/* COLUNA DIREITA: RESUMO (STICKY) */}
        <div className="lg:col-span-4">
          <div className="bg-[#141417] border border-white/5 p-6 rounded-xl shadow-xl sticky top-8 flex flex-col min-h-[500px]">
            <h2 className="text-base font-bold mb-6 text-emerald-500 flex items-center gap-2 border-b border-white/5 pb-4">
              <Wallet className="w-4 h-4" /> Resumo da Operação
            </h2>
            
            <div className="flex-1 space-y-6">
              <div className="text-center">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Titular da Conta</p>
                  <p className="font-bold text-white flex items-center justify-center gap-2"><User className="w-4 h-4 text-emerald-500" /> {accountName}</p>
              </div>

              <div className="bg-[#0d0d0f] border border-white/5 p-4 rounded-xl relative">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">SAI DE</span>
                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">{sourceProgramName}</span>
                </div>
                
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#141417] p-1.5 rounded-full border border-white/10">
                  <ArrowRight className="w-4 h-4 text-zinc-600" />
                </div>

                <div className="flex justify-between items-center mt-6">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ENTRA EM</span>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">{destProgramName}</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Saída (Origem)</span>
                  <span className="font-bold text-red-400">- {calculation.qtdOrigem.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Conversão Base ({calculation.pIn}:{calculation.pOut})</span>
                  <span className="font-bold text-white">{calculation.baseDestino.toLocaleString('pt-BR')}</span>
                </div>
                {calculation.bonus > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-400">Bônus Real (+{calculation.bonus}%)</span>
                    <span className="font-bold text-emerald-400">+ {calculation.bonusAmount.toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>

              <div className="bg-[#0a0f0d] p-6 rounded-xl border border-emerald-900/40 text-center mt-6">
                  <p className="text-[10px] uppercase text-emerald-500 font-bold tracking-widest">Saldo final a receber</p>
                  <p className="text-4xl font-black text-emerald-400 mt-2">{calculation.totalDestino.toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] text-zinc-500 mt-2">creditados em {destProgramName}</p>
              </div>
            </div>

            <button className="w-full bg-[#00d0b0] hover:bg-[#00ebd0] text-black font-bold py-3.5 rounded-lg mt-6 transition-colors shadow-lg shadow-emerald-900/20">
              Confirmar Transferência
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}