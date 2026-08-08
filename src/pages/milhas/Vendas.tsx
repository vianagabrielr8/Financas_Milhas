import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; 
import { Plus, Trash2, User, UserPlus, X, CalendarIcon, Plane, CreditCard } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale'; 
import { toast } from 'sonner';
import { 
    usePrograms, 
    useAccounts, 
    useSales, 
    useCreateSale, 
    useDeleteSale,
    useCreditCards
} from '@/hooks/useSupabaseData';
import { calculateCardDates, formatCPM, formatCurrency } from '@/utils/financeLogic';

// --- FUNÇÃO DE DATA SEGURA (FIX) ---
const formatDateSafe = (dateString: string) => {
    if (!dateString) return '-';
    const safeDate = dateString.includes('T') ? dateString : `${dateString}T12:00:00`;
    return format(new Date(safeDate), 'dd/MM/yyyy', { locale: ptBR });
};

// LISTA DE FILTRO: Só estas aparecerão no formulário de venda
const AEREAS_PERMITIDAS = ['LATAM PASS', 'SMILES', 'TAP MILES&GO', 'TUDO AZUL', 'IBERIA', 'IBERIA PLUS', 'AADVANTAGE'];

interface PassageiroVenda {
    id: string;
    nome: string;
    cpf: string;
}

const Vendas = () => {
    const { data: vendas = [], isLoading } = useSales();
    const { data: programas = [] } = usePrograms();
    const { data: contas = [] } = useAccounts();
    const { data: cartoes = [] } = useCreditCards(); 
    
    const createSaleMutation = useCreateSale();
    const deleteSaleMutation = useDeleteSale();

    const [isOpen, setIsOpen] = useState(false);
    
    const [parcelas, setParcelas] = useState(1);
    const [passageirosVenda, setPassageirosVenda] = useState<PassageiroVenda[]>([]);
    const [novoPassageiro, setNovoPassageiro] = useState({ nome: '', cpf: '' });

    // NOVO UX DE PREÇO: Milheiro vs Bruto
    const [inputMode, setInputMode] = useState<'MILHEIRO' | 'TOTAL'>('MILHEIRO');

    // ESTADOS PARA TAXAS
    const [hasTax, setHasTax] = useState(false);
    const [taxType, setTaxType] = useState<'MONEY' | 'MILES'>('MONEY');
    const [taxAmount, setTaxAmount] = useState('');
    const [taxCardId, setTaxCardId] = useState(''); 

    const [formData, setFormData] = useState({
        programaId: '',
        contaId: '',
        quantidade: '',
        valorUnitario: '',
        valorTotalBruto: '', 
        dataVenda: new Date().toLocaleDateString('en-CA'),
        dataRecebimento: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        status: 'pendente' as 'pendente' | 'recebido',
        observacoes: '',
    });

    const programasFiltrados = useMemo(() => {
        if (!programas) return [];
        return programas.filter(p => {
            const nome = p.name.toUpperCase();
            return AEREAS_PERMITIDAS.some(aerea => nome.includes(aerea));
        });
    }, [programas]);

    const resetForm = () => {
        setFormData({
            programaId: '',
            contaId: '',
            quantidade: '',
            valorUnitario: '',
            valorTotalBruto: '',
            dataVenda: new Date().toLocaleDateString('en-CA'),
            dataRecebimento: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
            status: 'pendente',
            observacoes: '',
        });
        setInputMode('MILHEIRO');
        setParcelas(1);
        setPassageirosVenda([]);
        setNovoPassageiro({ nome: '', cpf: '' });
        setHasTax(false);
        setTaxType('MONEY');
        setTaxAmount('');
        setTaxCardId('');
    };

    // Alternar entre Milheiro e Total com cálculo automático
    const handleModeSwitch = (mode: 'MILHEIRO' | 'TOTAL') => {
        if (mode === inputMode) return;
        
        const baseQ = parseInt(formData.quantidade) || 0;
        if (mode === 'TOTAL') {
            if (formData.valorUnitario && baseQ > 0) {
                const cost = (baseQ / 1000) * parseFloat(formData.valorUnitario.replace(',', '.'));
                setFormData(prev => ({ ...prev, valorTotalBruto: cost.toFixed(2).replace('.', ',') }));
            }
        } else {
            if (formData.valorTotalBruto && baseQ > 0) {
                const cpm = parseFloat(formData.valorTotalBruto.replace(',', '.')) / (baseQ / 1000);
                setFormData(prev => ({ ...prev, valorUnitario: cpm.toFixed(2).replace('.', ',') }));
            }
        }
        setInputMode(mode);
    };

    // Calcula de forma reativa os valores (Base Qtd, CPM e Total) para Preview e Submit
    const derivedValues = useMemo(() => {
        const baseQ = parseInt(formData.quantidade) || 0;
        let cpm = 0;
        let total = 0;

        if (inputMode === 'MILHEIRO') {
            cpm = parseFloat(formData.valorUnitario.toString().replace(',', '.')) || 0;
            total = (baseQ / 1000) * cpm;
        } else {
            total = parseFloat(formData.valorTotalBruto.toString().replace(',', '.')) || 0;
            cpm = baseQ > 0 ? total / (baseQ / 1000) : 0;
        }

        return { baseQ, cpm, total };
    }, [formData.quantidade, formData.valorUnitario, formData.valorTotalBruto, inputMode]);

    const handleAddPassageiro = () => {
        if (!novoPassageiro.nome.trim() || !novoPassageiro.cpf.trim()) {
            toast.error('Nome e CPF do passageiro são obrigatórios.');
            return;
        }
        const newId = Date.now().toString();
        setPassageirosVenda([...passageirosVenda, { ...novoPassageiro, id: newId }]);
        setNovoPassageiro({ nome: '', cpf: '' });
    };

    const handleRemovePassageiro = (id: string) => {
        setPassageirosVenda(passageirosVenda.filter(p => p.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (passageirosVenda.length === 0) {
            toast.error('É obrigatório adicionar ao menos um passageiro.');
            return;
        }

        if (hasTax && taxType === 'MONEY' && !taxCardId) {
            toast.error('Selecione o cartão usado para pagar a taxa.');
            return;
        }

        let quantidadeFinal = derivedValues.baseQ;
        const valorUnitario = derivedValues.cpm;
        let valorTotalFinal = derivedValues.total;
        
        const taxString = taxAmount.toString().replace(',', '.');
        const taxaValor = parseFloat(taxString) || 0;

        let taxPayload = null;
        let observacaoFinal = formData.observacoes;

        if (hasTax && taxaValor > 0) {
            if (taxType === 'MONEY') {
                let dataVencimentoCartao = formData.dataVenda; 
                const cartao = cartoes.find(c => c.id === taxCardId);
                
                if (cartao) {
                    try {
                        const safeSaleDate = new Date(formData.dataVenda + 'T12:00:00');
                        const datas = calculateCardDates(safeSaleDate, cartao.closing_day, cartao.due_day);
                        dataVencimentoCartao = format(datas.dueDate, 'yyyy-MM-dd');
                    } catch (err) {
                        console.error("Erro data cartao", err);
                    }
                }

                taxPayload = {
                    hasTax: true,
                    type: 'MONEY',
                    amount: taxaValor,
                    cardId: taxCardId,
                    cardDueDate: dataVencimentoCartao
                };
                observacaoFinal += ` | Taxa Paga: R$ ${taxaValor.toFixed(2)}`;

            } else {
                quantidadeFinal += taxaValor;
                valorTotalFinal = (quantidadeFinal / 1000) * valorUnitario;
                observacaoFinal += ` | Taxa: ${taxaValor} milhas`;
                taxPayload = { hasTax: true, type: 'MILES' };
            }
        }

        if (isNaN(valorTotalFinal) || valorTotalFinal <= 0) {
             if(!confirm("O valor total da venda parece zerado. Deseja continuar mesmo assim?")) return;
        }

        const vendaData = {
            programaId: formData.programaId,
            contaId: formData.contaId,
            quantidade: quantidadeFinal, 
            valorUnitario, 
            valorTotal: valorTotalFinal,
            dataVenda: formData.dataVenda, 
            dataRecebimento: formData.dataRecebimento,
            status: formData.status,
            observacoes: observacaoFinal,
            passageiros: passageirosVenda, 
            parcelas: parcelas, 
            taxDetails: taxPayload
        };

        createSaleMutation.mutate(vendaData, {
            onSuccess: () => {
                setIsOpen(false);
                resetForm();
            }
        });
    };

    const handleDelete = (id: string) => {
        if (confirm('Tem certeza que deseja excluir esta venda?')) {
            deleteSaleMutation.mutate(id);
        }
    };

    const columns = [
        {
            key: 'dataVenda',
            header: 'Data',
            render: (venda: any) => formatDateSafe(venda.transaction_date || venda.created_at),
        },
        {
            key: 'programaId',
            header: 'Programa',
            render: (venda: any) => programas.find(p => p.id === venda.program_id)?.name || '-',
        },
        {
            key: 'contaId',
            header: 'Conta',
            render: (venda: any) => contas.find(c => c.id === venda.account_id)?.name || '-',
        },
        {
            key: 'passageiros',
            header: 'Passageiros',
            render: (venda: any) => {
                if (venda.description && venda.description.includes('Passageiros')) {
                     return <span className="text-xs text-muted-foreground">{venda.description}</span>
                }
                return <span className="text-xs text-muted-foreground">-</span>;
            },
        },
        {
            key: 'quantidade',
            header: 'Qtd. Milhas',
            render: (venda: any) => Math.abs(venda.quantity)?.toLocaleString('pt-BR'),
        },
        {
            key: 'valorTotal',
            header: 'Valor Total',
            render: (venda: any) => 
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(venda.total_cost || 0),
        },
        {
            key: 'actions',
            header: 'Ações',
            render: (venda: any) => (
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(venda.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div className="w-full">
            <PageHeader 
                title="Vendas" 
                description="Gerencie suas vendas de milhas"
                action={
                    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
                        <DialogTrigger asChild>
                            <Button className="gradient-primary">
                                <Plus className="h-4 w-4 mr-2" />
                                Nova Venda
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Nova Venda</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Programa</Label>
                                        <Select 
                                            value={formData.programaId} 
                                            onValueChange={(value) => setFormData({ ...formData, programaId: value })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                            <SelectContent>
                                                {programasFiltrados.map((programa: any) => (
                                                    <SelectItem key={programa.id} value={programa.id}>
                                                        {programa.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Conta</Label>
                                        <Select 
                                            value={formData.contaId} 
                                            onValueChange={(value) => setFormData({ ...formData, contaId: value })}
                                        >
                                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                            <SelectContent>
                                                {contas?.map((conta: any) => (
                                                    <SelectItem key={conta.id} value={conta.id}>
                                                        {conta.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                
                                {/* Passageiros */}
                                <div className="space-y-3 p-4 border rounded-lg bg-muted/10">
                                    <Label className="text-base font-semibold flex items-center gap-2">
                                        <User className="h-4 w-4" /> Cadastro de Passageiros
                                    </Label>
                                    
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-1 space-y-1">
                                            <Label className="text-xs">CPF</Label>
                                            <Input 
                                                type="text" 
                                                value={novoPassageiro.cpf}
                                                onChange={(e) => setNovoPassageiro({ ...novoPassageiro, cpf: e.target.value })}
                                                placeholder="000.000.000-00"
                                            />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <Label className="text-xs">Nome Completo</Label>
                                            <div className="flex gap-2">
                                                <Input 
                                                    type="text" 
                                                    value={novoPassageiro.nome}
                                                    onChange={(e) => setNovoPassageiro({ ...novoPassageiro, nome: e.target.value })}
                                                    placeholder="Nome do Passageiro"
                                                />
                                                <Button type="button" size="icon" onClick={handleAddPassageiro} className="h-10 w-10">
                                                    <UserPlus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="max-h-28 overflow-y-auto space-y-1 mt-2">
                                        {passageirosVenda.length === 0 ? (
                                            <p className="text-xs text-muted-foreground pt-1">Adicione o(s) CPF(s) que consumirá(ão) a cota.</p>
                                        ) : (
                                            passageirosVenda.map(p => (
                                                <div key={p.id} className="flex justify-between items-center bg-background p-2 rounded text-sm border">
                                                    <span className="font-medium truncate">{p.nome}</span>
                                                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                                        <span>{p.cpf}</span>
                                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemovePassageiro(p.id)}>
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Quantidade de Milhas</Label>
                                        <Input 
                                            type="number" 
                                            value={formData.quantidade}
                                            onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                                            placeholder="10000"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <Label>Valor da Venda *</Label>
                                            <div className="flex bg-muted/30 p-1 rounded-lg border border-border/50">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleModeSwitch('MILHEIRO')} 
                                                    className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${inputMode === 'MILHEIRO' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    Por Milheiro
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleModeSwitch('TOTAL')} 
                                                    className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${inputMode === 'TOTAL' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    Valor Total
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-1">
                                            {inputMode === 'MILHEIRO' ? (
                                                <Input 
                                                    type="text" 
                                                    value={formData.valorUnitario}
                                                    onChange={(e) => setFormData({ ...formData, valorUnitario: e.target.value })}
                                                    placeholder="Ex: 20,50 (Milheiro)"
                                                    required
                                                />
                                            ) : (
                                                <Input 
                                                    type="text" 
                                                    value={formData.valorTotalBruto}
                                                    onChange={(e) => setFormData({ ...formData, valorTotalBruto: e.target.value })}
                                                    placeholder="Ex: 1155,96 (Total Bruto)"
                                                    required
                                                />
                                            )}
                                            <div className="flex justify-between items-center text-[11px] font-medium text-muted-foreground pt-1">
                                                <span className="text-primary/70">{inputMode === 'TOTAL' && derivedValues.baseQ > 0 ? `CPM Base: ${formatCPM(derivedValues.cpm)}` : ''}</span>
                                                <span>Subtotal: {formatCurrency(derivedValues.total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* --- SEÇÃO DE TAXAS --- */}
                                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label className="flex items-center gap-2 cursor-pointer font-semibold text-primary">
                                            <Plane className="h-4 w-4" />
                                            Incluir Taxas de Embarque?
                                        </Label>
                                        <Switch checked={hasTax} onCheckedChange={setHasTax} />
                                    </div>

                                    {hasTax && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <Label>Como a taxa foi paga?</Label>
                                                <RadioGroup value={taxType} onValueChange={(v) => setTaxType(v as 'MONEY' | 'MILES')} className="flex gap-4">
                                                    <div className="flex items-center space-x-2 border p-2 rounded w-full hover:bg-muted/50 cursor-pointer bg-background">
                                                        <RadioGroupItem value="MONEY" id="r1" />
                                                        <Label htmlFor="r1" className="cursor-pointer flex-1">Dinheiro (R$)</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2 border p-2 rounded w-full hover:bg-muted/50 cursor-pointer bg-background">
                                                        <RadioGroupItem value="MILES" id="r2" />
                                                        <Label htmlFor="r2" className="cursor-pointer flex-1">Milhas</Label>
                                                    </div>
                                                </RadioGroup>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>
                                                    {taxType === 'MONEY' ? 'Valor da Taxa (R$)' : 'Qtd Milhas da Taxa'}
                                                </Label>
                                                <Input 
                                                    type="text" 
                                                    value={taxAmount} 
                                                    onChange={e => setTaxAmount(e.target.value)} 
                                                    placeholder={taxType === 'MONEY' ? "0,00" : "0"}
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    {taxType === 'MONEY' 
                                                        ? "Cria contas a pagar e receber separadas." 
                                                        : "Desconta mais milhas do estoque."}
                                                </p>
                                            </div>

                                            {taxType === 'MONEY' && (
                                                <div className="space-y-2 animate-in fade-in">
                                                    <Label className="flex items-center gap-2">
                                                        <CreditCard className="h-4 w-4" /> Cartão utilizado na taxa
                                                    </Label>
                                                    <Select value={taxCardId} onValueChange={setTaxCardId}>
                                                        <SelectTrigger className="bg-background">
                                                            <SelectValue placeholder="Selecione o cartão" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {cartoes.map((card: any) => (
                                                                <SelectItem key={card.id} value={card.id}>
                                                                    {card.name} (Fecha: {card.closing_day})
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* DATAS: VENDA E RECEBIMENTO */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Data da Venda</Label>
                                        <Input 
                                            type="date" 
                                            value={formData.dataVenda}
                                            onChange={(e) => setFormData({...formData, dataVenda: e.target.value})} 
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-emerald-500 font-medium">
                                            <CalendarIcon className="h-4 w-4" />
                                            Recebimento (1ª Parc)
                                        </Label>
                                        <Input 
                                            type="date" 
                                            value={formData.dataRecebimento}
                                            onChange={(e) => setFormData({ ...formData, dataRecebimento: e.target.value })}
                                            required
                                            className="border-emerald-500/30 focus-visible:ring-emerald-500"
                                        />
                                    </div>
                                </div>

                                {/* Parcelamento da Venda - TOTAL CORRETO */}
                                {formData.status === 'pendente' && (
                                    <div className="space-y-2 border-t pt-4 bg-muted/20 p-3 rounded-lg">
                                        <Label className="text-primary font-medium">Parcelamento da Venda</Label>
                                        <div className="flex gap-4 items-start">
                                            <div className="w-1/3 space-y-2">
                                                <Label className="text-xs text-muted-foreground">Qtd Parcelas</Label>
                                                <Input 
                                                    type="number" 
                                                    min="1" 
                                                    max="24"
                                                    value={parcelas}
                                                    onChange={(e) => setParcelas(Number(e.target.value))}
                                                />
                                            </div>
                                            
                                            {/* Previsão Visual */}
                                            <div className="flex-1 text-sm text-muted-foreground bg-muted/50 p-3 rounded border">
                                                <p className="font-medium mb-2 text-xs uppercase tracking-wide">Previsão Recebimento</p>
                                                <div className="max-h-32 overflow-y-auto text-xs space-y-2 pr-1 custom-scrollbar">
                                                    {Array.from({ length: Math.max(1, parcelas) }).map((_, i) => {
                                                        const dataBase = formData.dataRecebimento ? new Date(formData.dataRecebimento + 'T12:00:00') : new Date();
                                                        const dataPrevista = new Date(dataBase.valueOf());
                                                        if (i > 0) dataPrevista.setMonth(dataPrevista.getMonth() + i);
                                                        
                                                        // Puxa o totalBase financeiro reativo que criamos na função derivedValues
                                                        let totalBase = derivedValues.total;

                                                        if (hasTax) {
                                                            const taxString = taxAmount.toString().replace(',', '.');
                                                            const tx = parseFloat(taxString) || 0;

                                                            if (taxType === 'MONEY') {
                                                                if (tx > 0) totalBase += tx;
                                                            } else if (taxType === 'MILES') {
                                                                if (tx > 0) {
                                                                    const qtdTotal = derivedValues.baseQ + tx;
                                                                    totalBase = (qtdTotal/1000) * derivedValues.cpm;
                                                                }
                                                            }
                                                        }
                                                        
                                                        const valorParc = totalBase / (parcelas || 1);
                                                        
                                                        return (
                                                            <div key={i} className="flex justify-between items-center border-b border-border/50 pb-1 last:border-0 last:pb-0">
                                                                <span className="font-medium">{i + 1}ª Parc: {dataPrevista.toLocaleDateString('pt-BR')}</span>
                                                                <span className="text-primary font-bold">{valorParc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
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
                                    <Button type="submit" className="gradient-primary" disabled={createSaleMutation.isPending}>
                                        {createSaleMutation.isPending ? 'Salvando...' : 'Registrar'}
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                }
            />

            <DataTable 
                data={vendas} 
                columns={columns} 
                emptyMessage={isLoading ? "Carregando vendas..." : "Nenhuma venda registrada."} 
            />
        </div>
    );
};

export default Vendas;