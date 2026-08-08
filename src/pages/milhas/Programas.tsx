import { useState } from 'react';
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
import { toast } from 'sonner';

// Importa direto do Supabase agora
import { 
    usePrograms, 
    useCreateProgram, 
    useUpdateProgram, 
    useDeleteProgram 
} from '@/hooks/useSupabaseData';

// Função para gerar o slug automaticamente (ex: "TAP Miles&Go" -> "tap-miles-go")
const generateSlug = (text: string) => {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Troca espaços por hífen
        .replace(/[^\w\-]+/g, '')       // Remove caracteres especiais
        .replace(/\-\-+/g, '-')         // Evita múltiplos hífens seguidos
        .replace(/^-+/, '')             // Remove hífen do início
        .replace(/-+$/, '');            // Remove hífen do final
};

const Programas = () => {
  const { data: programas = [], isLoading } = usePrograms();
  const createProgramMutation = useCreateProgram();
  const updateProgramMutation = useUpdateProgram();
  const deleteProgramMutation = useDeleteProgram();

  const [isOpen, setIsOpen] = useState(false);
  const [editingPrograma, setEditingPrograma] = useState<any>(null);
  const [formData, setFormData] = useState({
    nome: '',
    cpf_limit: 0,
    ativo: true,
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      cpf_limit: 0,
      ativo: true,
    });
    setEditingPrograma(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Agora enviamos o slug também para não dar erro de "not-null" no banco
    const dataToSave = {
        name: formData.nome, 
        slug: generateSlug(formData.nome),
        cpf_limit: formData.cpf_limit,
        active: formData.ativo,
    }

    if (editingPrograma) {
      updateProgramMutation.mutate({ id: editingPrograma.id, ...dataToSave }, {
          onSuccess: () => {
              toast.success('Programa atualizado com sucesso!');
              setIsOpen(false);
              resetForm();
          },
          onError: (err: any) => toast.error(err.message)
      });
    } else {
      createProgramMutation.mutate(dataToSave, {
          onSuccess: () => {
              toast.success('Programa cadastrado com sucesso!');
              setIsOpen(false);
              resetForm();
          },
          onError: (err: any) => toast.error(err.message)
      });
    }
  };

  const handleEdit = (programa: any) => {
    setEditingPrograma(programa);
    setFormData({
      nome: programa.name || '', 
      cpf_limit: programa.cpf_limit,
      ativo: programa.active !== false, 
    });
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este programa?')) {
      deleteProgramMutation.mutate(id, {
          onSuccess: () => toast.success('Programa excluído com sucesso!'),
          onError: (err: any) => toast.error(err.message)
      });
    }
  };

  const columns = [
    { key: 'name', header: 'Nome' }, 
    { key: 'cpf_limit', header: 'Limite CPF' }, 
    {
      key: 'active',
      header: 'Status',
      render: (programa: any) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            programa.active !== false
              ? 'bg-success/10 text-success border border-success/30'
              : 'bg-muted text-muted-foreground border border-border'
          }`}
        >
          {programa.active !== false ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (programa: any) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(programa)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(programa.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full">
      <PageHeader
        title="Programas de Milhas"
        description="Programas de fidelidade disponíveis no sistema"
        action={
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Novo Programa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingPrograma ? 'Editar Programa' : 'Novo Programa'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome do programa de fidelidade (ex: AZUL)"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Limite CPF</Label>
                  <Input
                    type="number"
                    value={formData.cpf_limit}
                    onChange={(e) => setFormData({ ...formData, cpf_limit: parseInt(e.target.value) || 0 })}
                    placeholder="Limite de CPFs por ano"
                  />
                </div>

                <div className="flex items-center space-x-2">
                    <input
                        type="checkbox"
                        id="ativoPrograma"
                        checked={formData.ativo}
                        onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    />
                    <Label htmlFor="ativoPrograma">Programa Ativo</Label>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    className="gradient-primary"
                    disabled={createProgramMutation.isPending || updateProgramMutation.isPending}
                  >
                    {editingPrograma ? 'Salvar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <DataTable
        data={programas}
        columns={columns}
        emptyMessage={isLoading ? "Carregando..." : "Nenhum programa cadastrado. Clique em 'Novo Programa' para começar."}
      />
    </div>
  );
};

export default Programas;