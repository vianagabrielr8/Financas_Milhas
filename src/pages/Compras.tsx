import { useState, useRef } from 'react';
import { 
  ShoppingCart, Search, Filter, MoreVertical, Plus, Calendar, 
  FileSpreadsheet, Download, Upload, X 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { MainLayout } from '@/components/layout/MainLayout';

const mockCompras = [
  { id: 1, programa: 'Livelo', titular: 'Gabriel Viana', data: '28/06/2026', qtdMilhas: 300000, valorTotal: 10500.00, cpm: 35.00, status: 'pago', contaOrigem: 'Geral (Itaú)' },
  { id: 2, programa: 'Esfera', titular: 'Gabriel Viana', data: '15/06/2026', qtdMilhas: 150000, valorTotal: 5250.00, cpm: 35.00, status: 'pago', contaOrigem: 'C6 Bank' },
  { id: 3, programa: 'LATAM Pass', titular: 'Ingrid Bittencourt', data: '02/06/2026', qtdMilhas: 200000, valorTotal: 3500.00, cpm: 17.50, status: 'pago', contaOrigem: 'Geral (Itaú)' },
];

export default function Compras() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState('');
  const [modalUploadAberto, setModalUploadAberto] = useState(false);

  const comprasFiltradas = mockCompras.filter(c => 
    c.programa.toLowerCase().includes(busca.toLowerCase()) || 
    c.titular.toLowerCase().includes(busca.toLowerCase())
  );

  const totalAcumulado = mockCompras.reduce((acc, c) => acc + c.valorTotal, 0);
  const totalMilhasCompradas = mockCompras.reduce((acc, c) => acc + c.qtdMilhas, 0);
  const cpmMedioCompras = totalMilhasCompradas > 0 ? (totalAcumulado / totalMilhasCompradas) * 1000 : 0;

  const baixarModeloMilhas = () => {
    const modelo = [
      { Data: '2026-07-09', Programa: 'Livelo', TitularCPF: 'Gabriel Viana', QtdMilhas: 100000, CPMRs: 35.00, StatusPagamento: 'PAGO', ContaPagamento: 'C6 Bank' },
      { Data: '2026-07-10', Programa: 'Esfera', TitularCPF: 'Ingrid Bittencourt', QtdMilhas: 50000, CPMRs: 33.50, StatusPagamento: 'PENDENTE', ContaPagamento: 'Geral (Itaú)' }
    ];
    const ws = XLSX.utils.json_to_sheet(modelo);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lotes_Milhas');
    XLSX.writeFile(wb, 'modelo_importacao_lotes_milhas.xlsx');
    toast.success('Modelo de milhas baixado!');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const dataJson = XLSX.utils.sheet_to_json(ws);

        if (dataJson.length === 0) {
          toast.error('A planilha está vazia.');
          return;
        }

        toast.success(`${dataJson.length} lotes de milhas processados!`);
        setModalUploadAberto(false);
      } catch (err) {
        toast.error('Erro de processamento.');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-white">
              <ShoppingCart className="w-6 h-6 text-emerald-500" /> Registro de Compras (Lotes)
            </h1>
            <p className="text-zinc-400 text-xs mt-0.5">Gerenciamento logístico e financeiro de entradas de pontos e milhas.</p>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Button onClick={() => setModalUploadAberto(true)} variant="outline" className="border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 rounded-full text-xs h-10 px-4">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500 mr-2" /> Excel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-10 rounded-full text-xs px-5">
              <Plus className="w-4 h-4 mr-1.5" /> Nova Compra
            </Button>
          </div>
        </div>

        {/* METRICAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#141417] border border-white/5 rounded-xl p-5">
            <span className="text-[10px] text-zinc-500 font-bold uppercase">Total Gasto em Lotes</span>
            <p className="text-xl font-bold text-white mt-1">R$ {totalAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-[#141417] border border-white/5 rounded-xl p-5">
            <span className="text-[10px] text-zinc-500 font-bold uppercase">Volume Total Injetado</span>
            <p className="text-xl font-bold text-white mt-1">{totalMilhasCompradas.toLocaleString('pt-BR')} <span className="text-xs text-zinc-500 font-normal">milhas</span></p>
          </div>
          <div className="bg-[#141417] border border-white/5 rounded-xl p-5">
            <span className="text-[10px] text-zinc-500 font-bold uppercase">Preço Médio (CPM)</span>
            <p className="text-xl font-bold text-emerald-500 mt-1">R$ {cpmMedioCompras.toFixed(2)}</p>
          </div>
        </div>

        {/* FILTROS */}
        <div className="flex items-center gap-3 bg-[#141417] p-3 rounded-xl border border-white/5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por programa ou titular..." className="pl-9 h-9 bg-black/40 border-white/10 text-white text-xs" />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 border-white/10 bg-transparent hover:bg-white/5"><Filter className="w-4 h-4 text-zinc-400" /></Button>
        </div>

        {/* TABELA */}
        <div className="bg-[#141417] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
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
        </div>

        {/* MODAL UPLOAD */}
        {modalUploadAberto && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#19191e] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-white/5 flex justify-between items-center bg-black/20">
                <h2 className="text-base font-bold text-white flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-500" /> Importador de Lotes</h2>
                <button onClick={() => setModalUploadAberto(false)} className="text-zinc-400 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 space-y-4">
                <Button onClick={baixarModeloMilhas} className="w-full bg-zinc-800 hover:bg-zinc-700 text-xs py-5">Baixar Modelo .XLSX</Button>
                <input type="file" ref={fileInputRef} accept=".xlsx" onChange={handleExcelUpload} className="hidden" />
                <Button onClick={() => fileInputRef.current?.click()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-xs py-5 font-bold">Enviar Planilha</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}