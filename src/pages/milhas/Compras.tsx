import { useState, useRef, useMemo } from 'react';
import { 
  ShoppingCart, Search, Filter, Plus, Calendar, 
  FileSpreadsheet, X, CheckCircle2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

const mockCompras = [
  { id: 1, programa: 'Livelo', titular: 'Gabriel Viana', data: '28/06/2026', qtdMilhas: 300000, valorTotal: 10500.00, cpm: 35.00, status: 'pago', contaOrigem: 'Geral (Itaú)' },
  { id: 2, programa: 'Esfera', titular: 'Gabriel Viana', data: '15/06/2026', qtdMilhas: 150000, valorTotal: 5250.00, cpm: 35.00, status: 'pago', contaOrigem: 'C6 Bank' },
  { id: 3, programa: 'LATAM Pass', titular: 'Ingrid Bittencourt', data: '02/06/2026', qtdMilhas: 200000, valorTotal: 3500.00, cpm: 17.50, status: 'pago', contaOrigem: 'Geral (Itaú)' },
];

export default function Compras() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState('');
  const [modalUploadAberto, setModalUploadAberto] = useState(false);
  const [modalCompraAberto, setModalCompraAberto] = useState(false);

  // Estados do Formulário de Nova Compra
  const [formData, setFormData] = useState({
    programa: '',
    titular: '',
    qtdMilhas: '',
    valorTotal: '',
    dataCompra: new Date().toLocaleDateString('en-CA'),
    contaPagamento: '',
    status: 'pago',
    parcelas: 1 // Novo campo de parcelamento
  });

  const comprasFiltradas = mockCompras.filter(c => 
    c.programa.toLowerCase().includes(busca.toLowerCase()) || 
    c.titular.toLowerCase().includes(busca.toLowerCase())
  );

  const totalAcumulado = mockCompras.reduce((acc, c) => acc + c.valorTotal, 0);
  const totalMilhasCompradas = mockCompras.reduce((acc, c) => acc + c.qtdMilhas, 0);
  const cpmMedioCompras = totalMilhasCompradas > 0 ? (totalAcumulado / totalMilhasCompradas) * 1000 : 0;

  // Calculo reativo de CPM no formulário
  const formCpm = useMemo(() => {
    const qtd = Number(formData.qtdMilhas) || 0;
    const total = Number(formData.valorTotal.replace(',', '.')) || 0;
    if (qtd > 0 && total > 0) return ((total / qtd) * 1000).toFixed(2);
    return '0.00';
  }, [formData.qtdMilhas, formData.valorTotal]);

  const baixarModeloMilhas = () => {
    const modelo = [
      { Data: '2026-07-09', Programa: 'Livelo', TitularCPF: 'Gabriel Viana', QtdMilhas: 100000, CPMRs: 35.00, StatusPagamento: 'PAGO', ContaPagamento: 'C6 Bank' },
      { Data: '2026-07-10', Programa: 'Esfera', TitularCPF: 'Ingrid Bittencourt', QtdMilhas: 50000, CPMRs: 33.50, StatusPagamento: 'PENDENTE', ContaPagamento: 'Geral (Itaú)' }
    ];
    const ws = XLSX.utils.json_to_sheet(modelo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lotes_Milhas');
    XLSX.writeFile(wb, 'modelo_importacao_lotes_milhas.xlsx');
    toast.success('Modelo baixado!');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const dataJson = XLSX.utils.sheet_to_json(ws);
        toast.success(`${dataJson.length} lotes processados!`);
        setModalUploadAberto(false);
      } catch (err) {
        toast.error('Erro de processamento.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSalvarCompra = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Nova compra de lote registrada com sucesso!');
    setModalCompraAberto(false);
    setFormData({
        programa: '', titular: '', qtdMilhas: '', valorTotal: '', 
        dataCompra: new Date().toLocaleDateString('en-CA'), contaPagamento: '', status: 'pago', parcelas: 1
    });
  };

  // Verifica se a conta selecionada sugere ser um cartão de crédito para habilitar parcelas visivelmente
  const isCreditCard = formData.contaPagamento.toLowerCase().includes('cartão') || formData.contaPagamento.includes('C6') || formData.contaPagamento.includes('Inter');

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-white">
            <ShoppingCart className="w-6 h-6 text-emerald-500" /> Registro de Compras (Lotes)
          </h1>
          <p className="text-zinc-400 text-xs mt-0.5">Gerenciamento logístico e financeiro de entradas.</p>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <Button onClick={() => setModalUploadAberto(true)} variant="outline" className="border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 rounded-full text-xs h-10 px-4">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500 mr-2" /> Excel
          </Button>
          <Button onClick={() => setModalCompraAberto(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-10 rounded-full text-xs px-5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <Plus className="w-4 h-4 mr-1.5" /> Nova Compra
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#141417] border border-white/5 rounded-xl p-5">
          <span className="text-[10px] text-zinc-500 font-bold uppercase">Total Gasto</span>
          <p className="text-xl font-bold text-white mt-1">R$ {totalAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-[#141417] border border-white/5 rounded-xl p-5">
          <span className="text-[10px] text-zinc-500 font-bold uppercase">Volume Total</span>
          <p className="text-xl font-bold text-white mt-1">{totalMilhasCompradas.toLocaleString('pt-BR')} <span className="text-xs text-zinc-500 font-normal">milhas</span></p>
        </div>
        <div className="bg-[#141417] border border-white/5 rounded-xl p-5">
          <span className="text-[10px] text-zinc-500 font-bold uppercase">Preço Médio (CPM)</span>
          <p className="text-xl font-bold text-emerald-500 mt-1">R$ {cpmMedioCompras.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-[#141417] p-3 rounded-xl border border-white/5">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por programa ou titular..." className="pl-9 h-9 bg-black/40 border-white/10 text-white text-xs" />
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent hover:bg-white/5"><Filter className="w-4 h-4 text-zinc-400" /></Button>
      </div>

      <div className="bg-[#141417] border border-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-400 font-semibold border-b border-white/5 bg-black/20">
            <tr>
              <th className="px-6 py-4">Data</th>
              <th className="px-6 py-4">Programa</th>
              <th className="px-6 py-4">Titular</th>
              <th className="px-6 py-4">Conta Pagamento</th>
              <th className="px-6 py-4 text-right">Qtd Milhas</th>
              <th className="px-6 py-4 text-right">CPM Custo</th>
              <th className="px-6 py-4 text-right">Valor Total</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {comprasFiltradas.map((c) => (
              <tr key={c.id} className="hover:bg-white/[0.01] transition-colors">
                <td className="px-6 py-4 text-zinc-400 text-xs flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {c.data}</td>
                <td className="px-6 py-4 font-semibold text-emerald-400">{c.programa}</td>
                <td className="px-6 py-4 text-zinc-300">{c.titular}</td>
                <td className="px-6 py-4 text-zinc-400 text-xs">{c.contaOrigem}</td>
                <td className="px-6 py-4 text-right font-medium">{c.qtdMilhas.toLocaleString('pt-BR')}</td>
                <td className="px-6 py-4 text-right text-zinc-400 font-mono">R$ {c.cpm.toFixed(2)}</td>
                <td className="px-6 py-4 text-right font-semibold text-white">R$ {c.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="px-6 py-4 text-center">
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border", c.status === 'pago' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20")}>
                    {c.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL NOVA COMPRA */}
      {modalCompraAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141417] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/20">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-500" /> Nova Compra de Lote
              </h2>
              <button onClick={() => setModalCompraAberto(false)} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              <form id="form-nova-compra" onSubmit={handleSalvarCompra} className="space-y-5">
                
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Programa</label>
                    <select 
                      required
                      value={formData.programa}
                      onChange={e => setFormData({...formData, programa: e.target.value})}
                      className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="" disabled>Selecione...</option>
                      <option value="Livelo">Livelo</option>
                      <option value="Esfera">Esfera</option>
                      <option value="LATAM Pass">LATAM Pass</option>
                      <option value="Smiles">Smiles</option>
                      <option value="TudoAzul">TudoAzul</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Titular (Conta)</label>
                    <select 
                      required
                      value={formData.titular}
                      onChange={e => setFormData({...formData, titular: e.target.value})}
                      className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="" disabled>Selecione...</option>
                      <option value="Gabriel Viana">Gabriel Viana</option>
                      <option value="Ingrid Bittencourt">Ingrid Bittencourt</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Qtd de Milhas</label>
                    <Input 
                      required
                      type="number" 
                      placeholder="Ex: 100000" 
                      value={formData.qtdMilhas}
                      onChange={e => setFormData({...formData, qtdMilhas: e.target.value})}
                      className="bg-black/40 border-white/10 text-white focus-visible:ring-emerald-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex justify-between">
                      Valor Total (R$)
                      <span className="text-emerald-500 normal-case font-normal text-[11px] tracking-normal">
                        CPM Gerado: R$ {formCpm}
                      </span>
                    </label>
                    <Input 
                      required
                      type="number"
                      step="0.01" 
                      placeholder="Ex: 3500.00" 
                      value={formData.valorTotal}
                      onChange={e => setFormData({...formData, valorTotal: e.target.value})}
                      className="bg-black/40 border-white/10 text-white focus-visible:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Data da Compra</label>
                    <Input 
                      required
                      type="date" 
                      value={formData.dataCompra}
                      onChange={e => setFormData({...formData, dataCompra: e.target.value})}
                      className="bg-black/40 border-white/10 text-white focus-visible:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Forma de Pgto</label>
                    <select 
                      required
                      value={formData.contaPagamento}
                      onChange={e => setFormData({...formData, contaPagamento: e.target.value})}
                      className="w-full h-10 px-3 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    >
                      <option value="" disabled>Selecione...</option>
                      <option value="Geral (Itaú)">Conta Corrente Geral (Itaú)</option>
                      <option value="Cartão C6 Bank">Cartão de Crédito C6 Bank</option>
                      <option value="Cartão Inter">Cartão de Crédito Inter</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Qtd Parcelas</label>
                    <Input 
                      type="number"
                      min="1"
                      max="24"
                      value={formData.parcelas}
                      onChange={e => setFormData({...formData, parcelas: Number(e.target.value) || 1})}
                      className="bg-black/40 border-white/10 text-white focus-visible:ring-emerald-500"
                      disabled={!isCreditCard && formData.contaPagamento !== ''}
                    />
                  </div>
                </div>

                {/* PREVISÃO DE PAGAMENTO (Só aparece se parcelas > 1) */}
                {formData.parcelas > 1 && formData.valorTotal && (
                   <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-3">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Previsão de Saída (Faturas)</label>
                      <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {Array.from({ length: formData.parcelas }).map((_, i) => {
                           const dataBase = formData.dataCompra ? new Date(formData.dataCompra + 'T12:00:00') : new Date();
                           const dataPrevista = new Date(dataBase.valueOf());
                           // Joga a primeira parcela para o mês seguinte (comportamento padrão de cartão)
                           dataPrevista.setMonth(dataPrevista.getMonth() + i + 1); 
                           
                           const total = Number(formData.valorTotal.replace(',', '.')) || 0;
                           const valorParc = total / formData.parcelas;

                           return (
                             <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2 text-sm text-zinc-300 last:border-0 last:pb-0">
                               <span>{i + 1}ª Parcela ({dataPrevista.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })})</span>
                               <span className="font-mono text-emerald-400">{valorParc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                             </div>
                           )
                        })}
                      </div>
                   </div>
                )}

                <div className="space-y-1.5 pt-2">
                   <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status Financeiro</label>
                   <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white">
                        <input 
                          type="radio" 
                          name="status" 
                          value="pago" 
                          checked={formData.status === 'pago'}
                          onChange={e => setFormData({...formData, status: e.target.value})}
                          className="text-emerald-500 focus:ring-emerald-500 bg-black/40 border-white/10"
                        />
                        Pago / Lançado
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white">
                        <input 
                          type="radio" 
                          name="status" 
                          value="pendente"
                          checked={formData.status === 'pendente'}
                          onChange={e => setFormData({...formData, status: e.target.value})}
                          className="text-amber-500 focus:ring-amber-500 bg-black/40 border-white/10"
                        />
                        Pendente
                      </label>
                   </div>
                </div>

              </form>
            </div>

            <div className="p-5 border-t border-white/5 flex justify-end gap-3 bg-black/20">
              <Button type="button" variant="ghost" onClick={() => setModalCompraAberto(false)} className="text-zinc-400 hover:text-white hover:bg-white/5">
                Cancelar
              </Button>
              <Button type="submit" form="form-nova-compra" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Registrar Compra
              </Button>
            </div>
            
          </div>
        </div>
      )}

      {/* MODAL UPLOAD */}
      {modalUploadAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141417] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-lg font-bold text-white flex items-center gap-2">
                 <FileSpreadsheet className="w-5 h-5 text-emerald-500" /> Importador de Lotes
               </h2>
               <button onClick={() => setModalUploadAberto(false)} className="text-zinc-400 hover:text-white">
                 <X className="w-5 h-5" />
               </button>
            </div>
            <div className="space-y-4">
               <Button onClick={baixarModeloMilhas} className="w-full bg-black/40 border border-white/10 hover:bg-white/5 text-zinc-300 py-6">
                 1. Baixar Modelo .XLSX
               </Button>
               <input type="file" ref={fileInputRef} accept=".xlsx" onChange={handleExcelUpload} className="hidden" />
               <Button onClick={() => fileInputRef.current?.click()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-6">
                 2. Enviar Planilha
               </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}