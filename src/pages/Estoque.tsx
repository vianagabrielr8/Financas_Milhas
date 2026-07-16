import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plane, Plus, Filter, AlertTriangle } from 'lucide-react';
import { useMilesBalance, useAccounts } from '@/hooks/useSupabaseData';
import { formatCPM, formatCurrency, formatNumber } from '@/utils/financeLogic';
import { TransactionModal } from '@/components/transactions/TransactionModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Estoque() {
  const { data: milesBalance = [], isLoading, error } = useMilesBalance();
  const { data: accounts = [] } = useAccounts();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string>('all');

  if (error) {
    console.error("Erro Supabase:", error);
    return <MainLayout><div className="p-10 text-red-500">Erro ao carregar dados do banco. Verifique o console.</div></MainLayout>;
  }

  const filteredBalance = useMemo(() => {
    return accountFilter === 'all' ? milesBalance : milesBalance.filter(m => m.account_id === accountFilter);
  }, [milesBalance, accountFilter]);

  const balanceByProgram = useMemo(() => {
    return filteredBalance.reduce((acc: any, item: any) => {
      const name = item.program_name || 'Sem Programa';
      if (!acc[name]) acc[name] = { totalBalance: 0, totalInvested: 0, subcontas: [] };
      acc[name].totalBalance += item.balance || 0;
      acc[name].totalInvested += item.total_invested || 0;
      acc[name].subcontas.push({ 
        titular: item.account_name || 'Sem Conta', 
        saldo: item.balance || 0, 
        inv: item.total_invested || 0, 
        cpm: item.avg_cpm || 0 
      });
      return acc;
    }, {});
  }, [filteredBalance]);

  return (
    <div className="w-full">
      <PageHeader title="Estoque de Milhas" action={<Button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white"><Plus className="w-4 h-4 mr-2" /> Nova Transação</Button>} />

      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-zinc-500" />
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-[200px] bg-[#141417] border-white/5 text-white"><SelectValue placeholder="Todas as contas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-zinc-500 animate-pulse">Carregando dados do servidor...</div>
      ) : Object.keys(balanceByProgram).length === 0 ? (
        <div className="p-10 text-center border border-dashed border-white/10 rounded-xl text-zinc-500">
            <AlertTriangle className="mx-auto mb-2 w-8 h-8 opacity-50" />
            Nenhum dado encontrado no Supabase.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(balanceByProgram).map(([name, data]: any) => (
            <div key={name} className="bg-[#141417] border border-white/5 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-zinc-200">{name}</h3>
                </div>
                <div className="space-y-3">
                    {data.subcontas.map((sub: any, sIdx: number) => (
                        <div key={sIdx} className="flex justify-between items-center bg-black/20 p-2.5 rounded-lg border border-white/5">
                            <div><p className="text-xs font-semibold text-zinc-300">{sub.titular}</p><p className="text-[10px] text-zinc-500">CPM: R$ {sub.cpm?.toFixed(2)}</p></div>
                            <div className="text-right"><p className="text-xs font-bold text-zinc-200">{formatNumber(sub.saldo)}</p><p className="text-[10px] text-zinc-500">{formatCurrency(sub.inv)}</p></div>
                        </div>
                    ))}
                </div>
            </div>
            ))}
        </div>
      )}
      
      {/* O SEGREDO ESTÁ AQUI: Renderização condicional para não travar a página */}
      {isModalOpen && (
        <TransactionModal open={isModalOpen} onOpenChange={setIsModalOpen} />
      )}
    </div>
  );
}