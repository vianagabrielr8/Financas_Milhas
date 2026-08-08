import { useState } from 'react';
import { User, Search, Filter, MoreVertical, Plus, Mail, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Contas() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  
  // Estados para o formulário de nova conta bancária/caixa
  const [formNome, setFormNome] = useState('');
  const [formSaldoInicial, setFormSaldoInicial] = useState('0');

  // Busca as contas financeiras reais do seu banco de dados
  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas_financeiras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conta_financeira_pessoal')
        .select('*')
        .order('nome');
      
      if (error) throw error;
      return data || [];
    }
  });

  // Mutação para salvar a nova conta no banco
  const cadastrarContaMutation = useMutation({
    mutationFn: async (novaConta: { nome: string; saldo_inicial: number }) => {
      const { data, error } = await supabase
        .from('conta_financeira_pessoal')
        .insert([novaConta]);
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas_financeiras'] });
      toast.success('Conta financeira cadastrada com sucesso!');
      setModalAberto(false);
      setFormNome('');
      setFormSaldoInicial('0');
    },
    onError: (error: any) => {
      toast.error('Erro ao cadastrar conta: ' + error.message);
    }
  });

  // Mutação para deletar uma conta
  const deletarContaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('conta_financeira_pessoal')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas_financeiras'] });
      toast.success('Conta removida com sucesso.');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover conta: ' + error.message);
    }
  });

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) {
      toast.error('Insira o nome da conta.');
      return;
    }
    cadastrarContaMutation.mutate({
      nome: formNome,
      saldo_inicial: parseFloat(formSaldoInicial) || 0
    });
  };

  const filtradas = contas.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-emerald-500" /> Contas & Caixas
          </h1>
          <p className="text-zinc-400 text-xs mt-0.5">Gerencie suas contas bancárias, carteiras e saldos de caixas ativos.</p>
        </div>

        {/* Modal de Nova Conta */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogTrigger asChild>
            <Button className="bg-[#10b981] hover:bg-[#059669] text-black font-semibold h-9 rounded-md text-xs px-4 flex items-center gap-1.5 ml-auto">
              <Plus className="w-4 h-4" /> Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#15151a] border border-gray-800 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-white">Nova Conta Financeira</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSalvar} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-zinc-400 text-xs">Nome da Conta / Banco</Label>
                <Input 
                  id="nome"
                  value={formNome} 
                  onChange={e => setFormNome(e.target.value)} 
                  placeholder="Ex: Itaú, C6 Bank, Dinheiro em Espécie" 
                  className="bg-[#22222a] border-zinc-700 text-white text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="saldo" className="text-zinc-400 text-xs">Saldo Inicial (R$)</Label>
                <Input 
                  id="saldo"
                  type="number" 
                  step="0.01"
                  value={formSaldoInicial} 
                  onChange={e => setFormSaldoInicial(e.target.value)} 
                  className="bg-[#22222a] border-zinc-700 text-white text-sm"
                />
              </div>
              <Button type="submit" className="w-full bg-[#10b981] hover:bg-[#059669] text-black font-bold mt-2">
                Salvar Conta
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3 bg-[#141417] p-3 rounded-xl border border-white/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome da conta..." 
            className="pl-9 h-9 bg-black/40 border-white/10 text-white text-xs"
          />
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent hover:bg-white/5">
          <Filter className="w-4 h-4 text-zinc-400" />
        </Button>
      </div>

      <div className="bg-[#141417] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 font-semibold border-b border-white/5 bg-black/20">
              <tr>
                <th className="px-6 py-4">Nome da Conta</th>
                <th className="px-6 py-4 text-right">Saldo Inicial</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-emerald-500 font-medium">Carregando contas bancárias...</td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-zinc-500">Nenhum caixa ou conta cadastrada.</td>
                </tr>
              ) : (
                filtradas.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4 font-semibold text-white">{c.nome}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.saldo_inicial || 0)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-zinc-500 hover:text-red-500"
                        onClick={() => deletarContaMutation.mutate(c.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}