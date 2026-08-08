import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTransactions, usePrograms, useAccounts, useDeleteTransaction, useUpdateTransaction } from '@/hooks/useSupabaseData';
import { formatCurrency, formatNumber, formatCPM } from '@/utils/financeLogic'; // Adicionei formatCPM se existir, senão use formatCurrency
import { ArrowLeft, History, ArrowUpRight, ArrowDownRight, Filter, Plus, Trash2, Pencil, Save, TrendingUp } from 'lucide-react';
import { TransactionModal } from '@/components/transactions/TransactionModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ProgramDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [isEditOpen, setIsEditOpen] = useState(false);   
  const [editingTrans, setEditingTrans] = useState<any>(null); 

  const deleteTransactionMutation = useDeleteTransaction();
  const updateTransactionMutation = useUpdateTransaction();

  const urlAccountId = searchParams.get('accountId') || 'all';
  const [selectedAccount, setSelectedAccount] = useState(urlAccountId);

  const { data: transactions } = useTransactions();
  const { data: programs } = usePrograms();
  const { data: accounts } = useAccounts();

  useEffect(() => {
    setSelectedAccount(urlAccountId);
  }, [urlAccountId]);

  const handleAccountChange = (newValue: string) => {
    setSelectedAccount(newValue);
    const params = new URLSearchParams(searchParams);
    if (newValue === 'all') {
      params.delete('accountId');
    } else {
      params.set('accountId', newValue);
    }
    setSearchParams(params);
  };

  const handleProgramChange = (newProgramId: string) => {
    let url = `/estoque/${newProgramId}`;
    if (selectedAccount !== 'all') url += `?accountId=${selectedAccount}`;
    navigate(url);
  };

  const handleDelete = (transactionId: string) => {
    if (confirm('Tem certeza que deseja excluir esta transação? O saldo será recalculado.')) {
        deleteTransactionMutation.mutate(transactionId);
    }
  };

  const handleEditClick = (t: any) => {
      setEditingTrans({
          id: t.id,
          transaction_date: t.transaction_date,
          quantity: t.quantity,
          total_cost: t.total_cost,
          description: t.description || ''
      });
      setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
      if (!editingTrans) return;
      
      updateTransactionMutation.mutate({
          id: editingTrans.id,
          transaction_date: editingTrans.transaction_date,
          quantity: parseInt(editingTrans.quantity),
          total_cost: editingTrans.total_cost,
          description: editingTrans.description
      }, {
          onSuccess: () => setIsEditOpen(false)
      });
  };

  const currentProgramName = programs?.find(p => String(p.id) === String(id))?.name || 'Detalhes';

  const history = useMemo(() => {
    if (!transactions || !id) return [];
    
    return transactions
      .filter(t => {
        const matchProgram = String(t.program_id) === String(id);
        const matchAccount = selectedAccount === 'all' || String(t.account_id) === String(selectedAccount);
        return matchProgram && matchAccount;
      })
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }, [transactions, id, selectedAccount]);

  // --- CÁLCULO CORRIGIDO (NETO) ---
  const totals = useMemo(() => {
    const entradas = history.filter(t => t.quantity > 0).reduce((acc, t) => acc + t.quantity, 0);
    const saidas = history.filter(t => t.quantity < 0).reduce((acc, t) => acc + Math.abs(t.quantity), 0);
    const saldo = entradas - saidas;
    
    // Calcula o "Dinheiro em Estoque": Soma custo das entradas, Subtrai custo das saídas
    const investidoLiquido = history.reduce((acc, t) => {
        if (t.quantity > 0) return acc + (Number(t.total_cost) || 0);
        else return acc - (Number(t.total_cost) || 0); // Saídas reduzem o investimento
    }, 0);

    // CPM = Dinheiro no Estoque / Milhas no Estoque
    const cpmAtual = saldo > 0 ? (investidoLiquido / saldo) * 1000 : 0;
    
    return { entradas, saidas, saldo, cpmAtual };
  }, [history]);

  const getTypeStyle = (type: string) => {
    const styles: Record<string, string> = {
      'COMPRA': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      'BONUS': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      'VENDA': 'bg-red-500/10 text-red-500 border-red-500/20',
      'TRANSF_ENTRADA': 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      'TRANSF_SAIDA': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    };
    return styles[type] || 'bg-gray-500/10 text-gray-500';
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        
        {/* TOPO */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b pb-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate('/estoque')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{currentProgramName}</h1>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <History className="h-3 w-3" />
                      <span>Extrato Detalhado</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-card border p-2 rounded-lg shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-2">
                      <Filter className="h-4 w-4" />
                      <span className="hidden sm:inline">Filtrar:</span>
                    </div>
                    
                    <Select value={selectedAccount} onValueChange={handleAccountChange}>
                        <SelectTrigger className="w-full sm:w-[180px] bg-background h-9 border-input">
                            <SelectValue placeholder="Conta" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="font-semibold">Todas as Contas</SelectItem>
                            {accounts?.map(a => (
                                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="w-px h-5 bg-border hidden sm:block"></div>
                    
                    <Select value={id} onValueChange={handleProgramChange}>
                        <SelectTrigger className="w-full sm:w-[150px] bg-background h-9 border-input">
                            <SelectValue placeholder="Programa" />
                        </SelectTrigger>
                        <SelectContent>
                            {programs?.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto shadow-md">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Transação
                </Button>
            </div>
        </div>

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-muted/5 border-muted">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Saldo (Filtrado)</CardTitle></CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-foreground">{formatNumber(totals.saldo)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedAccount === 'all' ? 'Todas as contas' : accounts?.find(a => String(a.id) === String(selectedAccount))?.name || 'Conta selecionada'}
                    </p>
                </CardContent>
            </Card>
            <Card>
                {/* RÓTULO CORRIGIDO: CPM Atual */}
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4"/> CPM Atual</CardTitle></CardHeader>
                <CardContent>
                    {/* FÓRMULA CORRIGIDA */}
                    <div className="text-3xl font-bold text-primary">R$ {totals.cpmAtual.toFixed(2).replace('.', ',')}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Fluxo Total</CardTitle></CardHeader>
                <CardContent className="flex justify-between items-center">
                    <div className="text-emerald-600 flex items-center gap-1 font-bold">
                        <ArrowUpRight className="h-4 w-4"/> {formatNumber(totals.entradas)}
                    </div>
                    <div className="h-8 w-px bg-border mx-2"></div>
                    <div className="text-rose-600 flex items-center gap-1 font-bold">
                        <ArrowDownRight className="h-4 w-4"/> {formatNumber(totals.saidas)}
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* TABELA */}
        <Card>
            <CardHeader className="border-b bg-muted/20">
                <CardTitle className="text-base flex items-center gap-2">
                    Transações Encontradas
                    <Badge variant="secondary" className="text-xs">{history.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <History className="h-10 w-10 mb-4 opacity-20" />
                        <p>Nenhuma transação encontrada com os filtros atuais.</p>
                        {selectedAccount !== 'all' && (
                           <Button variant="link" onClick={() => handleAccountChange('all')}>
                             Limpar filtro de conta
                           </Button>
                        )}
                        <Button variant="outline" className="mt-4" onClick={() => setIsModalOpen(true)}>
                           <Plus className="h-4 w-4 mr-2" />
                           Lançar primeira transação
                        </Button>
                    </div>
                ) : (
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Data</th>
                                    <th className="px-6 py-3 font-medium">Conta</th>
                                    <th className="px-6 py-3 font-medium">Tipo</th>
                                    <th className="px-6 py-3 font-medium text-right">Qtd</th>
                                    <th className="px-6 py-3 font-medium text-right">Custo Total</th>
                                    <th className="px-6 py-3 font-medium text-right">CPM Op.</th>
                                    <th className="px-6 py-3 font-medium text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {history.map((t) => {
                                    const isPositive = t.quantity > 0;
                                    const cpmOperacao = t.quantity !== 0 ? (t.total_cost / Math.abs(t.quantity)) * 1000 : 0;
                                    const accountName = accounts?.find(a => String(a.id) === String(t.account_id))?.name || '-';
                                    
                                    return (
                                        <tr key={t.id} className="hover:bg-muted/5 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                                                {format(new Date(t.transaction_date), 'dd/MM/yyyy', { locale: ptBR })}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {accountName}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className={`${getTypeStyle(t.type)} font-normal`}>
                                                    {t.type}
                                                </Badge>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {isPositive ? '+' : ''}{formatNumber(t.quantity)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-muted-foreground">
                                                {t.total_cost > 0 ? formatCurrency(t.total_cost) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs text-muted-foreground font-mono">
                                                {t.total_cost > 0 ? formatCurrency(cpmOperacao) : '-'}
                                            </td>
                                            
                                            {/* COLUNA DE AÇÕES (EDITAR + EXCLUIR) */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        onClick={() => handleEditClick(t)}
                                                        title="Editar Transação"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={() => handleDelete(t.id)}
                                                        disabled={deleteTransactionMutation.isPending}
                                                        title="Excluir Transação"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>

      <TransactionModal open={isModalOpen} onOpenChange={setIsModalOpen} />

      {/* MODAL DE EDIÇÃO */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>Editar Transação</DialogTitle>
            </DialogHeader>
            {editingTrans && (
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Data</Label>
                        <Input 
                            type="date" 
                            value={editingTrans.transaction_date} 
                            onChange={e => setEditingTrans({...editingTrans, transaction_date: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <Input 
                            type="number" 
                            value={editingTrans.quantity} 
                            onChange={e => setEditingTrans({...editingTrans, quantity: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Custo Total (R$)</Label>
                        <Input 
                            type="number" 
                            step="0.01"
                            value={editingTrans.total_cost} 
                            onChange={e => setEditingTrans({...editingTrans, total_cost: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Input 
                            value={editingTrans.description} 
                            onChange={e => setEditingTrans({...editingTrans, description: e.target.value})} 
                        />
                    </div>
                </div>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit} className="gradient-primary">
                    <Save className="h-4 w-4 mr-2" /> Salvar Alterações
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </MainLayout>
  );
};

export default ProgramDetails;
