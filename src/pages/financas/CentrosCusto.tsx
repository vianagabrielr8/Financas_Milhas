import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FolderTree, Plus, Trash2, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function CentrosCusto() {
  const [novoCentro, setNovoCentro] = useState('');

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
      nome: novoCentro.trim() 
    }]);

    if (error) {
      alert('Erro ao adicionar: ' + error.message);
    } else {
      setNovoCentro('');
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

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100">
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
                <div className="w-8 h-8 rounded-full bg-black/40 border border-white/5 flex items-center justify-center">
                  <Briefcase className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-sm text-white tracking-wide">{c.nome}</p>
                  <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Unidade de Negócio</p>
                </div>
              </div>
              
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => handleDeletarCentro(c.id)}
                className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {centros.length === 0 && (
            <div className="col-span-full text-center p-10 border border-white/5 rounded-xl text-zinc-500">
              Nenhum Centro de Custo cadastrado. Crie o primeiro acima.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
