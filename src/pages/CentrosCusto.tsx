import { useState } from 'react';
import { FolderTree, Plus, Trash2, Building2, Home, Users, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const escoposOficiais = [
  { id: 1, nome: 'Familiar', tipo: 'Orçamento Doméstico', icon: <Home className="w-4 h-4 text-blue-400" /> },
  { id: 2, nome: '360 Gestão', tipo: 'Unidade de Negócio', icon: <Building2 className="w-4 h-4 text-emerald-400" /> },
  { id: 3, nome: 'Bitté', tipo: 'Unidade de Negócio', icon: <Building2 className="w-4 h-4 text-emerald-400" /> },
  { id: 4, nome: 'Operação de Milhas', tipo: 'Unidade de Negócio', icon: <Plane className="w-4 h-4 text-indigo-400" /> },
  { id: 5, nome: 'Terceiros / Reembolsos', tipo: 'Caixa de Passagem', icon: <Users className="w-4 h-4 text-amber-400" /> },
];

export default function CentrosCusto() {
  const [novoCentro, setNovoCentro] = useState('');

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderTree className="w-6 h-6 text-emerald-500" /> Centros de Custo (Unidades de Negócio)
        </h1>
        <p className="text-zinc-400 text-xs mt-0.5">Os 5 caixas principais que dividem a sua vida financeira e empresarial.</p>
      </div>

      <div className="bg-[#141417] border border-white/5 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">Nome do Novo Centro de Custo</label>
            <Input 
              value={novoCentro} 
              onChange={(e) => setNovoCentro(e.target.value)}
              placeholder="Ex: Novo Projeto..." 
              className="bg-black/40 border-white/10 text-white h-10 text-xs"
            />
          </div>
          <Button className="bg-[#10b981] hover:bg-[#059669] text-black font-bold h-10 text-xs rounded-md flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> Adicionar Unidade
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {escoposOficiais.map((c) => (
          <div key={c.id} className="bg-[#141417] border border-white/5 rounded-xl p-5 flex items-center justify-between hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-black/40 border border-white/5 flex items-center justify-center">
                {c.icon}
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-sm text-white tracking-wide">{c.nome}</p>
                <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">{c.tipo}</p>
              </div>
            </div>
            {c.id > 5 && (
              <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}