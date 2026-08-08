import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { usePayableInstallments, useCreditCards } from '@/hooks/useSupabaseData';
import { formatCurrency, formatDate } from '@/utils/financeLogic';
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Filter, Calendar, CreditCard, Pencil, Trash2, Save, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NewExpenseModal } from '@/components/finance/NewExpenseModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const ContasPagar = () => {
  const queryClient = useQueryClient();
  
  // Filtros
  const [mesSelecionado, setMesSelecionado] = useState(format(new Date(), 'yyyy-MM'));
  const [cartaoSelecionado, setCartaoSelecionado] = useState("all");

  // Modais
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ description: '', amount: '', due_date: '' });

  // Dados
  const { data: contasPagar } = usePayableInstallments();
  const { data: cartoes } = useCreditCards();

  // --- LÓGICA DE FILTRAGEM (DATA + CARTÃO) ---
  const { inicioMes, finalMes } = useMemo(() => {
    const [ano, mes] = mesSelecionado.split('-');
    const dataBase = new Date(parseInt(ano), parseInt(mes) - 1, 1);
    dataBase.setHours(12, 0, 0, 0);
    return { inicioMes: startOfMonth(dataBase), finalMes: endOfMonth(dataBase) };
  }, [mesSelecionado]);

  const aPagarFiltrado = useMemo(() => {
    return contasPagar?.filter(c => {
        // 1. Filtro de Data
        const data = new Date(c.due_date.includes('T') ? c.due_date : `${c.due_date}T12:00:00`);
        const isDataOk = isWithinInterval(data, { start: inicioMes, end: finalMes });
        
        // 2. Filtro de Cartão
        let isCartaoOk = false;

        if (cartaoSelecionado === "all") {
            isCartaoOk = true;
        } else if (cartaoSelecionado === "none") {
            // Sem cartão: Verifica se não tem ID e nem objeto de cartão
            isCartaoOk = !c.payables?.credit_card_id && !c.payables?.credit_cards;
        } else {
            // Com cartão: Verifica de 3 formas diferentes para não ter erro
            const matchIdDireto = c.payables?.credit_card_id === cartaoSelecionado;
            const matchIdObjeto = c.payables?.credit_cards?.id === cartaoSelecionado;
            
            // Bateu o NOME do cartão?
            const nomeCartaoSelecionado = cartoes?.find(x => x.id === cartaoSelecionado)?.name;
            const nomeCartaoDaConta = c.payables?.credit_cards?.name;
            const matchNome = nomeCartaoSelecionado && nomeCartaoDaConta && nomeCartaoSelecionado === nomeCartaoDaConta;

            isCartaoOk = matchIdDireto || matchIdObjeto || matchNome;
        }

        return isDataOk && isCartaoOk;
    }) || [];
  }, [contasPagar, inicioMes, finalMes, cartaoSelecionado, cartoes]);

  const totalPagar = aPagarFiltrado.reduce((acc, c) => acc + Number(c.amount), 0);

  // --- FUNÇÕES DE AÇÃO ---
  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento?')) return;
    try {
      const { error } = await supabase.from('payable_installments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Conta excluída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['payable_installments'] });
    } catch (err) {
      toast.error('Erro ao excluir.');
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setEditForm({
      description: item.payables?.description || '',
      amount: item.amount,
      due_date: item.due_date
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      const { error: errorInstallment } = await supabase
        .from('payable_installments')
        .update({ amount: parseFloat(editForm.amount), due_date: editForm.due_date })
        .eq('id', editingItem.id);

      if (errorInstallment) throw errorInstallment;

      if (editForm.description !== editingItem.payables?.description) {
        await supabase
          .from('payables')
          .update({ description: editForm.description })
          .eq('id', editingItem.payable_id);
      }

      toast.success('Lançamento atualizado!');
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['payable_installments'] });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar.');
    }
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Contas a Pagar" 
        description="Gestão de saídas e despesas"
        action={
          <Button onClick={() => setIsNewModalOpen(true)} className="bg-destructive hover:bg-destructive/90 text-white">
            <Plus className="h-4 w-4 mr-2" /> Novo Gasto
          </Button>
        }
      />

      {/* --- BARRA DE FILTROS --- */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-muted/20 p-4 rounded-lg border border-border/50 items-end sm:items-center">
        
        {/* Filtro de Período */}
        <div className="space-y-1 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium pl-1">
                <Calendar className="h-3 w-3" /> Período
            </div>
            <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger className="w-full sm:w-[180px] bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
                {Array.from({ length: 13 }, (_, i) => {
                const d = addMonths(subMonths(new Date(), 2), i);
                const valor = format(d, 'yyyy-MM');
                const label = format(d, 'MMMM yyyy', { locale: ptBR });
                return <SelectItem key={valor} value={valor}>{label.charAt(0).toUpperCase() + label.slice(1)}</SelectItem>;
                })}
            </SelectContent>
            </Select>
        </div>

        {/* Filtro de Cartão */}
        <div className="space-y-1 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium pl-1">
                <CreditCard className="h-3 w-3" /> Cartão
            </div>
            <Select value={cartaoSelecionado} onValueChange={setCartaoSelecionado}>
                <SelectTrigger className="w-full sm:w-[200px] bg-background">
                    <SelectValue placeholder="Todos os cartões" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos os cartões</SelectItem>
                    <SelectItem value="none">Sem cartão (Boleto/Pix)</SelectItem>
                    {cartoes?.map(cartao => (
                        <SelectItem key={cartao.id} value={cartao.id}>
                            {cartao.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        {/* Botão Limpar Filtros */}
        {cartaoSelecionado !== 'all' && (
            <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 px-2 text-muted-foreground hover:text-destructive mt-6 sm:mt-0"
                onClick={() => setCartaoSelecionado('all')}
            >
                <XCircle className="h-4 w-4 mr-1" /> Limpar
            </Button>
        )}
      </div>

      <Card className="mb-8 border-l-4 border-l-destructive">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">Total Filtrado</CardTitle></CardHeader>
        <CardContent><div className="text-3xl font-bold">{formatCurrency(totalPagar)}</div></CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {aPagarFiltrado.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma conta encontrada para este filtro.</p>
          ) : (
            <div className="space-y-0">
              <div className="grid grid-cols-12 text-xs text-muted-foreground font-medium px-4 pb-3 border-b uppercase tracking-wider">
                <div className="col-span-2">Vencimento</div>
                <div className="col-span-4">Descrição</div>
                <div className="col-span-2 text-center">Parcela</div>
                <div className="col-span-2 text-right">Valor</div>
                <div className="col-span-2 text-center">Ações</div>
              </div>
              {aPagarFiltrado.map(conta => (
                <div key={conta.id} className="grid grid-cols-12 items-center p-3 border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <div className="col-span-2 text-sm flex items-center gap-2 font-medium">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(conta.due_date)}
                  </div>
                  <div className="col-span-4">
                    <p className="font-medium text-sm">{conta.payables?.description}</p>
                    {conta.payables?.credit_cards && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <CreditCard className="h-3 w-3" /> {conta.payables.credit_cards.name}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2 text-center">
                    {/* AQUI ESTÁ O PADRÃO SEGURO: 1/1 SE NÃO ACHAR TOTAL */}
                    <Badge variant="secondary" className="font-normal">
                      {conta.installment_number}/{conta.payables?.installments || 1}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-right font-bold text-sm text-destructive">
                    {formatCurrency(conta.amount)}
                  </div>
                  <div className="col-span-2 flex justify-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => openEditModal(conta)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(conta.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <NewExpenseModal open={isNewModalOpen} onOpenChange={setIsNewModalOpen} />

      {/* --- MODAL DE EDIÇÃO --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Editar Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Valor</Label><Input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} /></div>
              <div className="space-y-2"><Label>Vencimento</Label><Input type="date" value={editForm.due_date} onChange={e => setEditForm({...editForm, due_date: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}><Save className="h-4 w-4 mr-2" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </MainLayout>
  );
};

export default ContasPagar;
