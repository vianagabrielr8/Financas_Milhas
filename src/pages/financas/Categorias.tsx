import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Edit2, Trash2, Plus, Tags, Briefcase, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Categorias() {
  const [modalCatAberto, setModalCatAberto] = useState(false);
  const [formCat, setFormCat] = useState({ id: '', nome: '', icone: '🏷️', centro_custo_id: '' });

  const [modalSubAberto, setModalSubAberto] = useState(false);
  const [formSub, setFormSub] = useState({ id: '', categoria_id: '', nome: '' });

  // 1. Busca Centros de Custo (Gavetas Principais)
  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros_custo_projeto'],
    queryFn: async () => {
      const { data, error } = await supabase.from('centro_custo_projeto').select('*').order('nome');
      if (error) throw error; return data || [];
    }
  });

  // 2. Busca Categorias e Subcategorias
  const { data: categorias = [], refetch, isLoading } = useQuery({
    queryKey: ['categorias_pessoais'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categoria_pessoal')
        .select('*, subcategoria_pessoal(*)')
        .order('nome');
      if (error) throw error; return data || [];
    }
  });

  // Agrupa Categorias por Centro de Custo para visualização
  const categoriasAgrupadas = centrosCusto.map((cc: any) => {
    return {
      ...cc,
      categorias: categorias.filter((cat: any) => cat.centro_custo_id === cc.id)
    };
  });

  // Pega as categorias que estão "soltas" (sem centro de custo vinculado ainda)
  const categoriasGlobais = categorias.filter((cat: any) => !cat.centro_custo_id);

  const abrirNovaCategoria = () => {
    setFormCat({ id: '', nome: '', icone: '🏷️', centro_custo_id: centrosCusto[0]?.id || '' });
    setModalCatAberto(true);
  };

  const abrirEdicaoCategoria = (cat: any) => {
    setFormCat({ id: cat.id, nome: cat.nome, icone: cat.icone, centro_custo_id: cat.centro_custo_id || '' });
    setModalCatAberto(true);
  };

  const salvarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formCat.id) {
      await supabase.from('categoria_pessoal').update({ 
        nome: formCat.nome, 
        icone: formCat.icone,
        centro_custo_id: formCat.centro_custo_id || null 
      }).eq('id', formCat.id);
    } else {
      await supabase.from('categoria_pessoal').insert([{ 
        nome: formCat.nome, 
        icone: formCat.icone,
        centro_custo_id: formCat.centro_custo_id || null 
      }]);
    }
    setModalCatAberto(false);
    refetch();
  };

  const deletarCategoria = async (id: string) => {
    if (!window.confirm('Tem certeza? Isso apagará a categoria e TODAS as subcategorias dentro dela.')) return;
    await supabase.from('categoria_pessoal').delete().eq('id', id);
    refetch();
  };

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

  if (isLoading) return <div className="p-6 text-zinc-400">Carregando categorias...</div>;

  return (
    <div className="flex flex-col w-full pb-20 p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl text-white font-bold tracking-tight flex items-center gap-3">
            <Tags className="text-[#10b981]" /> Categorias e Subcategorias
          </h1>
          <p className="text-zinc-400 mt-1">Defina as gavetas exatas para onde vai cada centavo.</p>
        </div>
        <button 
          onClick={abrirNovaCategoria}
          className="bg-[#10b981] hover:bg-[#059669] text-black px-6 py-2.5 rounded-lg font-bold transition-all shadow-lg flex items-center gap-2"
        >
          <Plus size={18} /> Nova Categoria Pai
        </button>
      </div>

      <div className="space-y-12">
        {categoriasAgrupadas.map((grupo: any) => (
          <div key={grupo.id} className="relative">
            <div className="flex items-center gap-3 mb-6 bg-gradient-to-r from-[#141417] to-transparent p-3 rounded-xl border-l-4 border-[#10b981]">
              <Briefcase className="w-5 h-5 text-[#10b981]" />
              <h2 className="text-xl font-bold text-white tracking-wide">{grupo.nome}</h2>
              <span className="bg-[#10b981]/10 text-[#10b981] px-2 py-0.5 rounded text-xs font-bold ml-2">
                {grupo.categorias.length} Categorias
              </span>
            </div>

            {grupo.categorias.length === 0 ? (
              <div className="bg-[#141417] border border-dashed border-white/10 rounded-xl p-8 text-center">
                <p className="text-zinc-500 text-sm">Nenhuma categoria vinculada a este Centro de Custo.</p>
                <button onClick={() => { setFormCat({ id: '', nome: '', icone: '🏷️', centro_custo_id: grupo.id }); setModalCatAberto(true); }} className="text-[#10b981] text-xs font-bold mt-2 hover:underline">
                  Criar a primeira categoria aqui
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {grupo.categorias.map((cat: any) => (
                  <div key={cat.id} className="bg-[#141417] border border-white/5 hover:border-white/10 rounded-xl p-5 flex flex-col transition-colors shadow-sm">
                    <div className="flex justify-between items-start mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center text-xl border border-white/5">
                          {cat.icone}
                        </div>
                        <div>
                          <h3 className="text-white font-bold">{cat.nome}</h3>
                          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{cat.subcategoria_pessoal?.length || 0} subcategorias</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => abrirEdicaoCategoria(cat)} className="text-zinc-500 hover:text-white p-1 rounded transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => deletarCategoria(cat.id)} className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 mb-5 flex-1">
                      {cat.subcategoria_pessoal?.map((sub: any) => (
                        <div key={sub.id} className="group flex items-center justify-between bg-black/20 hover:bg-black/40 rounded-lg px-3 py-2 transition-all">
                          <span className="text-xs text-zinc-300 font-medium flex items-center gap-2">
                            <ChevronRight className="w-3 h-3 text-zinc-600" /> {sub.nome}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => abrirEdicaoSubcategoria(sub)} className="text-zinc-500 hover:text-white"><Edit2 size={12} /></button>
                            <button onClick={() => deletarSubcategoria(sub.id)} className="text-zinc-500 hover:text-red-400"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button onClick={() => abrirNovaSubcategoria(cat.id)} className="w-full py-2 border border-dashed border-white/10 hover:border-[#10b981]/50 text-zinc-500 hover:text-[#10b981] rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2">
                      <Plus size={14} /> Nova Subcategoria
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {categoriasGlobais.length > 0 && (
          <div className="relative pt-8 border-t border-white/5">
            <div className="flex items-center gap-3 mb-6 bg-gradient-to-r from-[#141417] to-transparent p-3 rounded-xl border-l-4 border-zinc-600">
              <Tags className="w-5 h-5 text-zinc-500" />
              <h2 className="text-xl font-bold text-zinc-400 tracking-wide">Gavetas Globais / Sem Vínculo</h2>
              <span className="bg-white/5 text-zinc-400 px-2 py-0.5 rounded text-xs font-bold ml-2">Recomendamos vincular</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categoriasGlobais.map((cat: any) => (
                <div key={cat.id} className="bg-[#141417] border border-white/5 rounded-xl p-5 flex flex-col">
                  <div className="flex justify-between items-start mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-black/40 rounded-xl flex items-center justify-center text-xl border border-white/5">{cat.icone}</div>
                      <div>
                        <h3 className="text-zinc-300 font-bold">{cat.nome}</h3>
                        <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">{cat.subcategoria_pessoal?.length || 0} subcategorias</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => abrirEdicaoCategoria(cat)} className="text-zinc-500 hover:text-white"><Edit2 size={14} /></button>
                      <button onClick={() => deletarCategoria(cat.id)} className="text-zinc-500 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    {cat.subcategoria_pessoal?.map((sub: any) => (
                      <div key={sub.id} className="group flex items-center justify-between bg-black/20 rounded-lg px-3 py-2">
                        <span className="text-xs text-zinc-400 flex items-center gap-2"><ChevronRight className="w-3 h-3 text-zinc-700" /> {sub.nome}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                          <button onClick={() => abrirEdicaoSubcategoria(sub)} className="text-zinc-600 hover:text-white"><Edit2 size={12} /></button>
                          <button onClick={() => deletarSubcategoria(sub.id)} className="text-zinc-600 hover:text-red-400"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modalCatAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a20] p-6 rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl">
            <h2 className="text-xl text-white font-bold mb-6 flex items-center gap-2">
              <Tags className="text-[#10b981]" size={20} /> {formCat.id ? 'Editar Categoria' : 'Nova Categoria'}
            </h2>
            <form onSubmit={salvarCategoria} className="flex flex-col gap-5">
              <div>
                <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Ícone (Emoji)</label>
                <input type="text" required value={formCat.icone} onChange={(e) => setFormCat({...formCat, icone: e.target.value})} className="w-full bg-[#141417] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none text-xl text-center" />
              </div>
              
              <div>
                <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Nome da Categoria</label>
                <input type="text" required value={formCat.nome} onChange={(e) => setFormCat({...formCat, nome: e.target.value})} className="w-full bg-[#141417] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none" placeholder="Ex: Moradia" />
              </div>

              <div>
                <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Centro de Custo Pertencente</label>
                <select 
                  required 
                  value={formCat.centro_custo_id} 
                  onChange={(e) => setFormCat({...formCat, centro_custo_id: e.target.value})} 
                  className="w-full bg-[#141417] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none text-sm cursor-pointer appearance-none"
                >
                  <option value="" disabled>Selecione um Centro de Custo...</option>
                  {centrosCusto.map((cc: any) => (
                    <option key={cc.id} value={cc.id}>{cc.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setModalCatAberto(false)} className="px-5 py-2 text-sm font-bold text-zinc-400 hover:text-white">CANCELAR</button>
                <button type="submit" className="bg-[#10b981] hover:bg-[#059669] text-black px-6 py-2.5 rounded-lg text-sm font-bold">SALVAR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalSubAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a20] p-6 rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl">
            <h2 className="text-xl text-white font-bold mb-6 flex items-center gap-2">
              <ChevronRight className="text-[#10b981]" size={20} /> {formSub.id ? 'Editar Subcategoria' : 'Nova Subcategoria'}
            </h2>
            <form onSubmit={salvarSubcategoria} className="flex flex-col gap-5">
              <div>
                <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider block mb-1.5">Nome da Subcategoria</label>
                <input type="text" required value={formSub.nome} onChange={(e) => setFormSub({...formSub, nome: e.target.value})} className="w-full bg-[#141417] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none" placeholder="Ex: Energia Elétrica" />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setModalSubAberto(false)} className="px-5 py-2 text-sm font-bold text-zinc-400 hover:text-white">CANCELAR</button>
                <button type="submit" className="bg-[#10b981] hover:bg-[#059669] text-black px-6 py-2.5 rounded-lg text-sm font-bold">SALVAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
