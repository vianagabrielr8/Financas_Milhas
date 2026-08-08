import { useState } from 'react';
import { User, Search, Filter, MoreVertical, Plus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const mockContas = [
  { id: 1, nome: 'Gabriel Viana Rodrigues', email: 'gvianacomercial@gmail.com', status: 'Ativa', totalMilhas: 1759604, programasAtivos: 4 },
  { id: 2, nome: 'Ingrid Bittencourt', email: 'ingrid.b@teste.com', status: 'Ativa', font: 'Azul, Latam, Livelo', totalMilhas: 95404, programasAtivos: 3 },
  { id: 3, nome: 'Bento Rodrigues (Infantil)', email: 'bento.r@teste.com', status: 'Ativa', totalMilhas: 0, programasAtivos: 1 },
];

export default function Titulares() {
  const [busca, setBusca] = useState('');

  const filtradas = mockContas.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-emerald-500" /> Contas & CPFs Gerenciados
          </h1>
          <p className="text-zinc-400 text-xs mt-0.5">Cadastro de titulares, controle de acessos a programas e centralização de saldos.</p>
        </div>
        <Button className="bg-[#10b981] hover:bg-[#059669] text-black font-semibold h-9 rounded-md text-xs px-4 flex items-center gap-1.5 ml-auto">
          <Plus className="w-4 h-4" /> Nova Conta (CPF)
        </Button>
      </div>

      <div className="flex items-center gap-3 bg-[#141417] p-3 rounded-xl border border-white/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome do titular..." 
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
                <th className="px-6 py-4">Titular</th>
                <th className="px-6 py-4">E-mail de Cadastro</th>
                <th className="px-6 py-4 text-center">Programas Ativos</th>
                <th className="px-6 py-4 text-right">Saldo Consolidado</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtradas.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4 font-semibold text-white">{c.nome}</td>
                  <td className="px-6 py-4 text-zinc-400 text-xs">
                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {c.email}</span>
                  </td>
                  <td className="px-6 py-4 text-center text-zinc-300 font-medium">{c.programasAtivos}</td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-400">{c.totalMilhas.toLocaleString('pt-BR')}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {c.status.toUpperCase()}
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