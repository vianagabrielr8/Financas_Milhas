import { useState } from 'react';
import { Users, Search, Filter, MoreVertical, Plus, Plane, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const mockPassageiros = [
  { id: 1, nome: 'Gabriel Viana Rodrigues', documento: '***.***.***-**', totalEmissoes: 12, ultimaEmissao: '20/06/2026', status: 'Frequente' },
  { id: 2, nome: 'Ingrid Bittencourt', documento: '***.***.***-**', totalEmissoes: 8, ultimaEmissao: '12/05/2026', status: 'Frequente' },
  { id: 3, nome: 'Bento Rodrigues', documento: '***.***.***-**', totalEmissoes: 2, ultimaEmissao: '14/01/2026', status: 'Regular' },
  { id: 4, nome: 'Cliente Balcão Exemplo 1', documento: '***.***.***-**', totalEmissoes: 1, ultimaEmissao: '04/07/2026', status: 'Avulso' }
];

export default function Passageiros() {
  const [busca, setBusca] = useState('');

  const filtrados = mockPassageiros.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-4 md:p-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-500" /> Passageiros Voados
          </h1>
          <p className="text-zinc-400 text-xs mt-0.5">Banco de dados de clientes e beneficiários associados às emissões de passagens.</p>
        </div>
        <Button className="bg-[#10b981] hover:bg-[#059669] text-black font-semibold h-9 rounded-md text-xs px-4 flex items-center gap-1.5 ml-auto">
          <Plus className="w-4 h-4" /> Novo Passageiro
        </Button>
      </div>

      <div className="flex items-center gap-3 bg-[#141417] p-3 rounded-xl border border-white/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome do passageiro..." 
            className="pl-9 h-9 bg-black/40 border-white/10 text-white text-xs"
          />
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent hover:bg-white/5"><Filter className="w-4 h-4 text-zinc-400" /></Button>
      </div>

      <div className="bg-[#141417] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 font-semibold border-b border-white/5 bg-black/20">
              <tr>
                <th className="px-6 py-4">Nome Completo</th>
                <th className="px-6 py-4">Documento (CPF)</th>
                <th className="px-6 py-4 text-center">Total de Emissões</th>
                <th className="px-6 py-4 text-center">Último Voo</th>
                <th className="px-6 py-4 text-center">Classificação</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtrados.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">{p.nome}</td>
                  <td className="px-6 py-4 text-zinc-400 text-xs font-mono">
                    <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> {p.documento}</span>
                  </td>
                  <td className="px-6 py-4 text-center text-zinc-300 font-medium">{p.totalEmissoes}</td>
                  <td className="px-6 py-4 text-center text-zinc-400 text-xs">
                    <span className="flex items-center justify-center gap-1"><Plane className="w-3.5 h-3.5 text-zinc-500" /> {p.ultimaEmissao}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border",
                      p.status === 'Frequente' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      p.status === 'Regular' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                      "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                    )}>
                      {p.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white"><MoreVertical className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}