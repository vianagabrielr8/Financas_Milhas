import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  usePrograms,
  useAccounts,
  useSuppliers,
  useCreditCards,
  useCreateTransaction,
  useCreatePayable,
  useCreatePayableInstallments,
} from '@/hooks/useSupabaseData';
import { calculateInstallmentDates, calculateCPM, formatCPM } from '@/utils/financeLogic';
import { ArrowLeft, Calculator } from 'lucide-react';

const NovaCompra = () => {
  const navigate = useNavigate();
  const { data: programs } = usePrograms();
  const { data: accounts } = useAccounts();
  const { data: suppliers } = useSuppliers();
  const { data: creditCards } = useCreditCards();
  
  const createTransaction = useCreateTransaction();
  const createPayable = useCreatePayable();
  const createPayableInstallments = useCreatePayableInstallments();

  const [formData, setFormData] = useState({
    program_id: '',
    account_id: '',
    supplier_id: '',
    quantity: '',
    total_cost: '',
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
    expiration_date: '',
    credit_card_id: '',
    installments: '1',
    notes: '',
  });

  const [calculatedCPM, setCalculatedCPM] = useState<number>(0);
  const [installmentPreview, setInstallmentPreview] = useState<{ dueDate: Date; amount: number; installmentNumber: number }[]>([]);

  // Calculate CPM when quantity or total_cost changes
  useEffect(() => {
    const quantity = parseInt(formData.quantity) || 0;
    const totalCost = parseFloat(formData.total_cost) || 0;
    setCalculatedCPM(calculateCPM(totalCost, quantity));
  }, [formData.quantity, formData.total_cost]);

  // Calculate installment preview when relevant fields change
  useEffect(() => {
    const totalCost = parseFloat(formData.total_cost) || 0;
    const installments = parseInt(formData.installments) || 1;
    const selectedCard = creditCards?.find(c => c.id === formData.credit_card_id);
    
    if (totalCost > 0 && installments > 0 && selectedCard) {
      const preview = calculateInstallmentDates(
        totalCost,
        installments,
        new Date(formData.transaction_date),
        selectedCard
      );
      setInstallmentPreview(preview);
    } else {
      setInstallmentPreview([]);
    }
  }, [formData.total_cost, formData.installments, formData.credit_card_id, formData.transaction_date, creditCards]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const quantity = parseInt(formData.quantity);
    const totalCost = parseFloat(formData.total_cost);

    try {
      // Create transaction
      const transaction = await createTransaction.mutateAsync({
        program_id: formData.program_id,
        account_id: formData.account_id,
        supplier_id: formData.supplier_id || null,
        type: 'COMPRA',
        quantity,
        total_cost: totalCost,
        cost_per_thousand: calculatedCPM,
        transaction_date: formData.transaction_date,
        expiration_date: formData.expiration_date || null,
        notes: formData.notes || null,
      });

      // Create payable with installments if credit card is selected
      if (formData.credit_card_id && totalCost > 0) {
        const installments = parseInt(formData.installments) || 1;
        
        const payable = await createPayable.mutateAsync({
          transaction_id: transaction.id,
          credit_card_id: formData.credit_card_id,
          description: `Compra ${quantity.toLocaleString('pt-BR')} milhas - ${programs?.find(p => p.id === formData.program_id)?.name}`,
          total_amount: totalCost,
          installments,
        });

        // Create installments
        await createPayableInstallments.mutateAsync(
          installmentPreview.map(inst => ({
            payable_id: payable.id,
            installment_number: inst.installmentNumber,
            amount: inst.amount,
            due_date: format(inst.dueDate, 'yyyy-MM-dd'),
            status: 'pendente' as const,
          }))
        );
      }

      toast.success('Compra registrada com sucesso!');
      navigate('/compras');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao registrar compra');
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Nova Compra"
        description="Registre uma nova compra de milhas"
        action={
          <Button variant="outline" onClick={() => navigate('/compras')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dados da Compra</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Programa *</Label>
                  <Select
                    value={formData.program_id}
                    onValueChange={(value) => setFormData({ ...formData, program_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs?.filter(p => p.active).map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta *</Label>
                  <Select
                    value={formData.account_id}
                    onValueChange={(value) => setFormData({ ...formData, account_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.filter(a => a.active).map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.filter(s => s.active).map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade de Milhas *</Label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="10000"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Total (R$) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.total_cost}
                    onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                    placeholder="150.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data da Compra *</Label>
                  <Input
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Expiração</Label>
                  <Input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">Pagamento</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cartão de Crédito</Label>
                    <Select
                      value={formData.credit_card_id}
                      onValueChange={(value) => setFormData({ ...formData, credit_card_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {creditCards?.filter(c => c.active).map((card) => (
                          <SelectItem key={card.id} value={card.id}>
                            {card.name} (Fecha dia {card.closing_day})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Select
                      value={formData.installments}
                      onValueChange={(value) => setFormData({ ...formData, installments: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num}x
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações (opcional)"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/compras')}>
                  Cancelar
                </Button>
                <Button type="submit" className="gradient-primary">
                  Registrar Compra
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                CPM Calculado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {formatCPM(calculatedCPM)}
              </div>
              <p className="text-sm text-muted-foreground">
                Custo por milheiro
              </p>
            </CardContent>
          </Card>

          {installmentPreview.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Previsão de Parcelas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {installmentPreview.map((inst) => (
                    <div
                      key={inst.installmentNumber}
                      className="flex justify-between items-center text-sm p-2 rounded bg-muted/50"
                    >
                      <span>
                        {inst.installmentNumber}ª - {format(inst.dueDate, 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                      <span className="font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inst.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default NovaCompra;
