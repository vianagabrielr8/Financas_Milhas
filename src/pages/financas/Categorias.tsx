import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Edit2, Trash2, Plus, Tags } from 'lucide-react';

export default function Categorias() {
  // Estados para Modal de Categoria Pai
  const [modalCatAberto, setModalCatAberto] = useState(false);
  const [formCat, setFormCat] = useState({ id: '', nome: '', icone: '🏷️' });

  // Estados para Modal de Subcategoria
  const [modalSubAberto, setModalSubAberto] = useState(false);
  const [formSub, setFormSub] = useState({ id: '', categoria_id: '', nome: '' });

  // Busca Categorias e suas Subcategorias aninhadas
  const { data: categorias = [], refetch } = useQuery({
    queryKey: ['categorias_pessoais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categoria_pessoal')
        .select('*, subcategoria_pessoal(*)')
        .order('nome');
      
      if (error) throw error;
      return data || [];
    }
  });

  // ================= AÇÕES DE CATEGORIA PAI =================
  const abrirNovaCategoria = () => {
    setFormCat({ id: '', nome: '', icone: '🏷️' });
    setModalCatAberto(true);
  };

  const abrirEdicaoCategoria = (cat: any) => {
    setFormCat({ id: cat.id, nome: cat.nome, icone: cat.icone });
    setModalCatAberto(true);
  };

  const salvarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formCat.id) {
      await supabase.from('categoria_pessoal').update({ nome: formCat.nome, icone: formCat.icone }).eq('id', formCat.id);
    } else {
      await supabase.from('categoria_pessoal').insert([{ nome: formCat.nome, icone: formCat.icone }]);
    }
    setModalCatAberto(false);
    refetch();
  };

  const deletarCategoria = async (id: string) => {
    if (!window.confirm('Tem certeza? Isso apagará a categoria e TODAS as subcategorias dentro dela.')) return;
    await supabase.from('categoria_pessoal').delete().eq('id', id);
    refetch();
  };

  // ================= AÇÕES DE SUBCATEGORIA =================
  const abrirNovaSubcategoria = (categoriaId: string) => {
    setFormSub({ id: '', categoria_id: categoriaId, nome: '' });
    setModalSubAberto(true);
  };

  const abrirEdicaoSubcategoria = (sub: any) => {
    setFormSub({ id: sub.id, categoria_id: sub.categoria_id, nome: sub.nome });
    setModalSubAberto(true);
  };

  const salvarSubcategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formSub.id) {
      await supabase.from('subcategoria_pessoal').update({ nome: formSub.nome }).eq('id', formSub.id);
    } else {
      await supabase.from('subcategoria_pessoal').insert([{ nome: formSub.nome, categoria_id: formSub.categoria_id }]);
    }
    setModalSubAberto(false);
    refetch();
  };

  const deletarSubcategoria = async (id: string) => {
    if (!window.confirm('Deletar esta subcategoria?')) return;
    await supabase.from('subcategoria_pessoal').delete().eq('id', id);
    refetch();
  };

  return (
    <div className="flex flex-col w-full pb-10 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl text-white font-bold tracking-tight flex items-center gap-3">
            <Tags className="text-emerald-500" /> Categorias e Subcategorias
          </h1>
          <p className="text-gray-400 mt-1">Defina as gavetas exatas para onde vai cada centavo.</p>
        </div>
        <button 
          onClick={abrirNovaCategoria}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
        >
          <Plus size={18} /> Nova Categoria Pai
        </button>
      </div>

      {/* Grid de Categorias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categorias.map((cat: any) => (
          <div key={cat.id} className="bg-[#15151a] border border-gray-800 rounded-xl p-5 flex flex-col h-full shadow-sm">
            
            {/* Header do Card (Categoria Pai) */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#22222a] rounded-lg flex items-center justify-center text-xl border border-gray-800">
                  {cat.icone}
                </div>
                <div>
                  <h3 className="text-white font-bold">{cat.nome}</h3>
                  <span className="text-xs text-gray-500">{cat.subcategoria_pessoal?.length || 0} subcategorias</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => abrirEdicaoCategoria(cat)} className="text-gray-500 hover:text-blue-400 transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => deletarCategoria(cat.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Lista de Subcategorias */}
            <div className="flex flex-wrap gap-2 mb-6 flex-1">
              {cat.subcategoria_pessoal?.map((sub: any) => (
                <div key={sub.id} className="group flex items-center gap-3 bg-[#22222a] border border-gray-700/50 hover:border-gray-600 rounded-lg px-3 py-1.5 transition-all">
                  <span className="text-sm text-gray-300">↳ {sub.nome}</span>
                  
                  {/* Botões da Subcategoria (Aparecem no hover no PC, ou ficam sutis no mobile) */}
                  <div className="flex gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => abrirEdicaoSubcategoria(sub)} className="hover:text-blue-400 text-gray-400">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => deletarSubcategoria(sub.id)} className="hover:text-red-400 text-gray-400">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Botão Adicionar Subcategoria */}
            <button 
              onClick={() => abrirNovaSubcategoria(cat.id)}
              className="w-full py-2 border border-dashed border-gray-700 hover:border-emerald-500/50 text-gray-400 hover:text-emerald-400 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Adicionar Subcategoria
            </button>
          </div>
        ))}
      </div>

      {/* Modal Categoria Pai */}
      {modalCatAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#15151a] p-8 rounded-2xl w-full max-w-sm border border-gray-800 shadow-2xl">
            <h2 className="text-xl text-white font-bold mb-6">{formCat.id ? 'Editar Categoria' : 'Nova Categoria'}</h2>
            <form onSubmit={salvarCategoria} className="flex flex-col gap-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Ícone (Emoji)</label>
                <input 
                  type="text" 
                  required
                  value={formCat.icone}
                  onChange={(e) => setFormCat({...formCat, icone: e.target.value})}
                  className="w-full bg-[#22222a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Nome da Categoria</label>
                <input 
                  type="text" 
                  required
                  value={formCat.nome}
                  onChange={(e) => setFormCat({...formCat, nome: e.target.value})}
                  className="w-full bg-[#22222a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                  placeholder="Ex: Moradia"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setModalCatAberto(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Subcategoria */}
      {modalSubAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#15151a] p-8 rounded-2xl w-full max-w-sm border border-gray-800 shadow-2xl">
            <h2 className="text-xl text-white font-bold mb-6">{formSub.id ? 'Editar Subcategoria' : 'Nova Subcategoria'}</h2>
            <form onSubmit={salvarSubcategoria} className="flex flex-col gap-4">
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Nome da Subcategoria</label>
                <input 
                  type="text" 
                  required
                  value={formSub.nome}
                  onChange={(e) => setFormSub({...formSub, nome: e.target.value})}
                  className="w-full bg-[#22222a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none"
                  placeholder="Ex: Energia Elétrica"
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setModalSubAberto(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}