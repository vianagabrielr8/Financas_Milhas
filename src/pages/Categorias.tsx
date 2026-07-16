import { useState } from 'react';
import { Tags, Plus, Trash2, Edit2, AlertTriangle, CornerDownRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const estadoInicial = [
  { id: 1, nome: 'Moradia', cor: '#3498db', icone: '🏠', subs: ['Financiamento', 'Condomínio', 'Energia', 'Água'] },
  { id: 2, nome: 'Alimentação', cor: '#f1c40f', icone: '🍕', subs: ['Supermercado', 'Delivery', 'Padaria'] },
  { id: 3, nome: 'Transporte', cor: '#e74c3c', icone: '🚗', subs: ['Uber/99', 'Combustível', 'Estacionamento'] },
  { id: 4, nome: 'Pessoal - Gabriel', cor: '#2f3542', icone: '👨', subs: ['Vestuário', 'Cabelereiro', 'Lazer'] }
];

export default function Categorias() {
  const [categorias, setCategorias] = useState(estadoInicial);
  const [modalAvisoDelete, setModalAvisoDelete] = useState<{aberto: boolean, itemNome: string, tipo: 'categoria'|'sub', idRef: any}>({aberto: false, itemNome: '', tipo: 'categoria', idRef: null});

  const iniciarExclusao = (nome: string, tipo: 'categoria'|'sub', id: any) => {
    setModalAvisoDelete({ aberto: true, itemNome: nome, tipo, idRef: id });
  };

  const confirmarExclusao = () => {
    if(modalAvisoDelete.tipo === 'categoria') {
      setCategorias(categorias.filter(c => c.id !== modalAvisoDelete.idRef));
    }
    setModalAvisoDelete({aberto: false, itemNome: '', tipo: 'categoria', idRef: null});
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-4 md:p-6 pb-24">
      
      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Tags className="w-6 h-6 text-emerald-500" /> Categorias e Subcategorias</h1>
          <p className="text-zinc-400 text-xs mt-0.5">Defina as gavetas exatas para onde vai cada centavo.</p>
        </div>
        <Button className="bg-[#10b981] hover:bg-[#059669] text-black font-semibold h-9 rounded-md text-xs px-4 w-full md:w-auto">
          <Plus className="w-4 h-4 mr-1.5" /> Nova Categoria Pai
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {categorias.map((cat) => (
          <div key={cat.id} className="bg-[#141417] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors flex flex-col">
            <div className="flex justify-between items-start border-b border-white/5 pb-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-lg border border-white/5 shadow-inner">
                  {cat.icone}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{cat.nome}</h3>
                  <p className="text-[10px] text-zinc-500">{cat.subs.length} subcategorias</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white rounded-md"><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" onClick={() => iniciarExclusao(cat.nome, 'categoria', cat.id)} className="h-7 w-7 text-zinc-500 hover:text-red-400 rounded-md"><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap gap-2">
                {cat.subs.map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.05] px-2.5 py-1 rounded-md">
                    <CornerDownRight className="w-3 h-3 text-zinc-600" />
                    <span className="text-xs text-zinc-300 font-medium">{sub}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button variant="ghost" className="w-full mt-4 h-8 border border-dashed border-white/10 text-xs text-zinc-400 hover:text-white hover:border-white/20">
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Subcategoria
            </Button>
          </div>
        ))}
      </div>

      {modalAvisoDelete.aberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#19191e] border border-red-500/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-2">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-white">Risco de Perda de Dados</h2>
              <p className="text-sm text-zinc-400">
                Você está tentando excluir a categoria <strong className="text-white">"{modalAvisoDelete.itemNome}"</strong>. Se você excluir, todas as transações passadas vinculadas a ela perderão a referência.
              </p>
            </div>
            <div className="p-5 border-t border-white/5 bg-black/20 flex gap-3">
              <Button onClick={() => setModalAvisoDelete({...modalAvisoDelete, aberto: false})} className="flex-1 bg-white hover:bg-zinc-200 text-black font-bold h-10 text-xs">Não, Cancelar</Button>
              <Button onClick={confirmarExclusao} variant="destructive" className="flex-1 font-bold h-10 text-xs bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20">Sim, Excluir</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}