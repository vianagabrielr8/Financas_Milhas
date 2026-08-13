import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FolderTree, Plus, Trash2, Edit2, Briefcase, Home, Building2, Plane, Users, Wallet, Car, ShoppingCart, Heart, Coffee, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Lista de ícones disponíveis para escolha
const LISTA_ICONES = [
  { id: 'Briefcase', icone: <Briefcase className="w-4 h-4" /> },
  { id: 'Home', icone: <Home className="w-4 h-4" /> },
  { id: 'Building2', icone: <Building2 className="w-4 h-4" /> },
  { id: 'Plane', icone: <Plane className="w-4 h-4" /> },
  { id: 'Users', icone: <Users className="w-4 h-4" /> },
  { id: 'Wallet', icone: <Wallet className="w-4 h-4" /> },
  { id: 'Car', icone: <Car className="w-4 h-4" /> },
  { id: 'ShoppingCart', icone: <ShoppingCart className="w-4 h-4" /> },
  { id: 'Heart', icone: <Heart className="w-4 h-4" /> },
  { id: 'Coffee', icone: <Coffee className="w-4 h-4" /> }
];

export default function CentrosCusto() {
  const [novoCentro, setNovoCentro] = useState('');
  
  // Estados do Modal de Edição
  const [modalAberto, setModalAberto] = useState(false);
  const [centroEditandoId, setCentroEditandoId] = useState<string | null>(null);
  const [nomeEditando, setNomeEditando] = useState('');
  const [iconeEditando, setIconeEditando] = useState('Briefcase');

  // BUSCA OS CENTROS DE CUSTO REAIS DO BANCO
  const { data: centros = [], refetch, isLoading } = useQuery({
    queryKey: ['centros_custo_projeto'],
    queryFn: async () => {
      const { data, error } = await supabase.from('centro_custo_projeto').select('*').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const handleAdicionarCentro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCentro.trim()) return alert('Digite um nome para o Centro de Custo.');

    const { error } = await supabase.from('centro_custo_projeto').insert([{ 
      nome: novoCentro.trim(),
      icone: 'Briefcase' // Ícone padrão na criação rápida
    }]);

    if (error) {
      alert('Erro ao adicionar: ' + error.message);
    } else {
      setNovoCentro('');
      refetch();
    }
  };

  const abrirModalEdicao = (c: any) => {
    setCentroEditandoId(c.id);
    setNomeEditando(c.nome);
    setIconeEditando(c.icone || 'Briefcase');
    setModalAberto(true);
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeEditando.trim() || !centroEditandoId) return;

    const { error } = await supabase.from('centro_custo_projeto').update({
      nome: nomeEditando.trim(),
      icone: iconeEditando
    }).eq('id', centroEditandoId);

    if (error) {
      alert('Erro ao editar. Verifique se você criou a coluna "icone" no Supabase: ' + error.message);
    } else {
      setModalAberto(false);
      refetch();
    }
  };

  const handleDeletarCentro = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este Centro de Custo? Se existirem transações vinculadas a ele, você precisará reclassificá-las depois.')) return;
    
    const { error } = await supabase.from('centro_custo_projeto').delete().eq('id', id);
    
    if (error) {
      alert('Erro ao excluir. Pode haver transações dependentes deste centro de custo: ' + error.message);
    } else {
      refetch();
    }
  };

  const renderIcone = (iconId: string) => {
    const found = LISTA_ICONES.find(i => i.id === iconId);
    return found ? found.icone : <Briefcase className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 relative">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderTree className="w-6 h-6 text-emerald-500" /> Centros de Custo (Unidades de Negócio)
        </h1>
        <p className="text-zinc-400 text-xs mt-0.5">As gavetas principais que dividem a sua vida financeira e empresarial.</p>
      </div>

      <div className="bg-[#141417] border border-white/5 rounded-xl p-5">
        <form onSubmit={handleAdicionarCentro} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">Nome do Novo Centro de Custo</label>
            <Input 
              value={novoCentro} 
              onChange={(e) => setNovoCentro(e.target.value)}
              placeholder="Ex: Novo Projeto..." 
              className="bg-black/40 border-white/10 text-white h-10 text-xs focus:border-emerald-500 transition-colors"
            />
          </div>
          <Button type="submit" className="bg-[#10b981] hover:bg-[#059669] text-black font-bold h-10 text-xs rounded-md flex items-center justify-center gap-1.5 transition-all">
            <Plus className="w-4 h-4" /> Adicionar Unidade
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="p-6 text-zinc-400">Carregando centros de custo...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {centros.map((c: any) => (
            <div key={c.id} className="bg-[#141417] border border-white/5 rounded-xl p-5 flex items-center justify-between hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-black/40 border border-white/5 flex items-center justify-center text-emerald-400">
                  {renderIcone(c.icone)}
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-sm text-white tracking-wide">{c.nome}</p>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Unidade de Negócio</p>
                </div>
              </div>
              
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => abrirModalEdicao(c)}
                  className="text-zinc-500 hover:text-white h-8 w-8 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleDeletarCentro(c.id)}
                  className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {centros.length === 0 && (
            <div className="col-span-full text-center p-10 border border-white/5 rounded-xl text-zinc-500">
              Nenhum Centro de Custo cadastrado. Crie o primeiro acima.
            </div>
          )}
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a20] rounded-2xl w-full max-w-md border border-white/10 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl text-white font-bold flex items-center gap-2">
                <Edit2 className="text-[#10b981] w-5 h-5" /> Editar Centro de Custo
              </h2>
              <button onClick={() => setModalAberto(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSalvarEdicao} className="p-6 space-y-6">
              <div>
                <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Nome</label>
                <input 
                  type="text" 
                  required 
                  value={nomeEditando} 
                  onChange={(e) => setNomeEditando(e.target.value)} 
                  className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all" 
                />
              </div>

              <div>
                <label className="text-zinc-400 text-xs font-bold uppercase block mb-3">Escolha um Ícone</label>
                <div className="flex gap-2 flex-wrap">
                  {LISTA_ICONES.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setIconeEditando(item.id)}
                      className={cn(
                        "p-3 rounded-xl border flex items-center justify-center transition-all", 
                        iconeEditando === item.id 
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" 
                          : "bg-black/40 border-white/10 text-zinc-400 hover:border-white/30 hover:text-white"
                      )}
                    >
                      {item.icone}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/5">
                <button type="button" onClick={() => setModalAberto(false)} className="px-6 py-2.5 text-sm text-zinc-400 font-bold hover:text-white transition-colors">CANCELAR</button>
                <button type="submit" className="bg-[#10b981] text-black hover:bg-[#059669] px-6 py-2.5 rounded-lg text-sm font-bold transition-all">SALVAR ALTERAÇÕES</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
