import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReceivableInstallments } from '@/hooks/useSupabaseData';
import { formatCurrency } from '@/utils/financeLogic';
import { format, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Filter, Calendar, Pencil, Trash2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const ContasReceber = () => {
  const queryClient = useQueryClient();
  const [mesSelecionado, setMesSelecionado] = useState(format(new Date(), 'yyyy-MM'));
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ description: '', amount: '', due_date: '' });

  const { data: contasReceber } = useReceivableInstallments();

  // FILTRO SIMPLIFICADO (STRING MATCH) - Resolve o problema de sumir da tela
  const aReceberFiltrado = useMemo(() => {
    if (!contasReceber) return [];
    return contasReceber.filter(c => {
        if (!c.due_date) return false;
        // Pega "2026-02" da data e compara com o filtro
        return c.due_date.substring(0, 7) === mesSelecionado;
    });
  }, [contasReceber, mesSelecionado]);

  const totalReceber = aReceberFiltrado.reduce((acc, c) => acc + Number(c.amount), 0);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir?')) return;
    try {
      const { error } = await supabase.from('receivable_installments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Excluído!');
      queryClient.invalidateQueries({ queryKey: ['receivable_installments'] });
    } catch (err) {
      toast.error('Erro ao excluir.');
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setEditForm({
      description: item.receivables?.description || '',
      amount: item.amount,
      due_date: item.due_date
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    try {
      await supabase.from('receivable_installments')
        .update({ amount: parseFloat(editForm.amount), due_date: editForm.due_date })
        .eq('id', editingItem.id);

      if (editForm.description !== editingItem.receivables?.description) {
        await supabase.from('receivables')
          .update({ description: editForm.description })
          .eq('id', editingItem.receivable_id);
      }
      toast.success('Atualizado!');
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['receivable_installments'] });
    } catch (err) {
      toast.error('Erro ao atualizar.');
    }
  };

  const formatDateDisplay = (dateString: string) => {
      if (!dateString) return '-';
      const parts = dateString.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  return (
    <MainLayout>
      <PageHeader title="Contas a Receber" description="Previsão de entradas financeiras" />

      <div className="flex items-center gap-4 mb-6 bg-muted/20 p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <Filter className="h-4 w-4" /> Período:
        </div>
        <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
          <SelectTrigger className="w-[220px] bg-background border-muted-foreground/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 13 }, (_, i) => {
              const d = addMonths(subMonths(new Date(), 2), i);
              const valor = format(d, 'yyyy-MM');
              const label = format(d, 'MMMM yyyy', { locale: ptBR });
              return <SelectItem key={valor} value={valor} className="capitalize">{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </div>

      <Card className="mb-8 border-l-4 border-l-emerald-500 shadow-sm">
        <CardHeader className="pb-2">
            <CardTitle className="text-emerald-600 text-sm font-medium uppercase tracking-wide">
                Total a Receber ({format(parseISO(mesSelecionado + '-01'), 'MMMM', { locale: ptBR })})
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="text-4xl font-bold text-foreground">{formatCurrency(totalReceber)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-0 p-0">
          {aReceberFiltrado.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-10 w-10 mb-3 opacity-20" />
                <p>Nenhum recebimento previsto para este mês.</p>
            </div>
          ) : (
            <div className="space-y-0">
              <div className="grid grid-cols-12 text-xs font-semibold text-muted-foreground px-4 py-3 border-b bg-muted/40 uppercase tracking-wider">
                <div className="col-span-2">Vencimento</div>
                <div className="col-span-5">Descrição</div>
                <div className="col-span-1 text-center">Parc.</div>
                <div className="col-span-2 text-right">Valor</div>
                <div className="col-span-2 text-center">Ações</div>
              </div>
              {aReceberFiltrado.map((conta, idx) => (
                <div key={conta.id} className={`grid grid-cols-12 items-center p-4 border-b hover:bg-muted/5 transition-colors ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/5'}`}>
                  <div className="col-span-2 text-sm font-medium flex items-center gap-2 text-foreground">
                    <Calendar className="h-4 w-4 text-emerald-500" /> 
                    {formatDateDisplay(conta.due_date)}
                  </div>
                  <div className="col-span-5 pr-4">
                    <div className="text-sm font-medium text-foreground truncate" title={conta.receivables?.description}>
                        {conta.receivables?.description || 'Venda sem descrição'}
                    </div>
                  </div>
                  <div className="col-span-1 text-center">
                    <Badge variant="outline" className="font-mono text-[10px]">
                        {conta.installment_number}
                    </Badge>
                  </div>
                  <div className="col-span-2 text-right font-bold text-emerald-600">
                    {formatCurrency(conta.amount)}
                  </div>
                  <div className="col-span-2 flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary hover:bg-primary/10" onClick={() => openEditModal(conta)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(conta.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Editar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input type="date" value={editForm.due_date} onChange={e => setEditForm({...editForm, due_date: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} className="gradient-primary">
                <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default ContasReceber;
