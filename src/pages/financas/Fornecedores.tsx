import { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Fornecedor } from '@/types';
import { toast } from 'sonner';

const Fornecedores = () => {
  const { fornecedores, addFornecedor, updateFornecedor, deleteFornecedor } = useData();

  const [isOpen, setIsOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    observacoes: '',
    ativo: true,
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      cpf: '',
      observacoes: '',
      ativo: true,
    });
    setEditingFornecedor(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingFornecedor) {
      updateFornecedor(editingFornecedor.id, formData);
      toast.success('Fornecedor atualizado com sucesso!');
    } else {
      addFornecedor(formData);
      toast.success('Fornecedor cadastrado com sucesso!');
    }

    setIsOpen(false);
    resetForm();
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setFormData({
      nome: fornecedor.nome,
      email: fornecedor.email || '',
      telefone: fornecedor.telefone || '',
      cpf: fornecedor.cpf || '',
      observacoes: fornecedor.observacoes || '',
      ativo: fornecedor.ativo,
    });
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este fornecedor?')) {
      deleteFornecedor(id);
      toast.success('Fornecedor excluído com sucesso!');
    }
  };

  const columns = [
    { key: 'nome', header: 'Nome' },
    { key: 'email', header: 'E-mail' },
    { key: 'telefone', header: 'Telefone' },
    { key: 'cpf', header: 'CPF' },
    {
      key: 'ativo',
      header: 'Status',
      render: (fornecedor: Fornecedor) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            fornecedor.ativo
              ? 'bg-success/10 text-success border border-success/30'
              : 'bg-muted text-muted-foreground border border-border'
          }`}
        >
          {fornecedor.ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (fornecedor: Fornecedor) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(fornecedor)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(fornecedor.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <MainLayout>
      <PageHeader
        title="Fornecedores"
        description="Gerencie seus fornecedores"
        action={
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Novo Fornecedor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome do fornecedor"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Observações (opcional)"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="gradient-primary">
                    {editingFornecedor ? 'Salvar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <DataTable
        data={fornecedores}
        columns={columns}
        emptyMessage="Nenhum fornecedor cadastrado. Clique em 'Novo Fornecedor' para começar."
      />
    </MainLayout>
  );
};

export default Fornecedores;
