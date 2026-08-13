import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Calendar, DollarSign, Receipt, FileText, Trash2, Edit2, Plus, CreditCard, ChevronDown, Search, CornerDownRight, Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function FaturaCartao() {
  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const [mesSelecionado, setMesSelecionado] = useState(mesesNomes[new Date().getMonth()]);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const [cartaoAtivo, setCartaoAtivo] = useState<any>(null);
  const [modalAberto, setModalAberto] = useState(false);
  
  // Estado para Edição
  const [transacaoEditandoId, setTransacaoEditandoId] = useState<string | null>(null);

  // Estados do Formulário
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formData, setFormData] = useState(new Date().toISOString().split('T')[0]);
  const [formFaturaDestino, setFormFaturaDestino] = useState(mesSelecionado); 
  const [formParcelado, setFormParcelado] = useState(false);
  const [formParcelas, setFormParcelas] = useState(2);
  const [formObservacao, setFormObservacao] = useState('');
  
  // Estados do Seletor de Categoria
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<{catId: string, subId?: string, nomeDisplay: string} | null>(null);
  const [dropdownCatAberto, setDropdownCatAberto] = useState(false);
  const [buscaCat, setBuscaCat] = useState('');

  // Ref para o Input de Arquivo (CSV)
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: cartoes = [], isLoading: carregandoCartoes } = useQuery({
    queryKey: ['cartoes_pessoais'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartao_pessoal').select('*').order('nome');
      if (error) throw error;
      if (data && data.length > 0 && !cartaoAtivo) setCartaoAtivo(data[0]); 
      return data || [];
    }
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias_pessoais'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categoria_pessoal').select('*').order('nome');
      if (error) throw error; return data || [];
    }
  });

  const { data: subcategorias = [] } = useQuery({
    queryKey: ['subcategorias_pessoais'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subcategoria_pessoal').select('*').order('nome');
      if (error) throw error; return data || [];
    }
  });

  const mesFormatado = String(mesesNomes.indexOf(mesSelecionado) + 1).padStart(2, '0');
  const ultimoDia = new Date(anoSelecionado, Number(mesFormatado), 0).getDate();
  const dataInicio = `${anoSelecionado}-${mesFormatado}-01`;
  const dataFim = `${anoSelecionado}-${mesFormatado}-${ultimoDia}`;

  const { data: transacoes = [], refetch } = useQuery({
    queryKey: ['transacoes_cartao', cartaoAtivo?.id, dataInicio, dataFim],
    enabled: !!cartaoAtivo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transacao_pessoal')
        .select('*')
        .eq('cartao_id', cartaoAtivo.id)
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .order('data', { ascending: false });
      
      if (error) throw error; return data || [];
    }
  });

  const totalFatura = transacoes.reduce((acc, curr) => acc + Number(curr.valor), 0);

  const categoriasFiltradas = useMemo(() => {
    const termo = buscaCat.toLowerCase();
    if (!termo) return categorias;
    
    return categorias.filter((cat: any) => {
      const matchCat = cat.nome.toLowerCase().includes(termo);
      const subs = subcategorias.filter((sub: any) => sub.categoria_id === cat.id);
      const matchSub = subs.some((sub: any) => sub.nome.toLowerCase().includes(termo));
      return matchCat || matchSub;
    });
  }, [categorias, subcategorias, buscaCat]);

  const resetarFormulario = () => {
    setTransacaoEditandoId(null);
    setFormDescricao('');
    setFormValor('');
    setCategoriaSelecionada(null);
    setFormParcelado(false);
    setFormObservacao('');
    setFormData(new Date().toISOString().split('T')[0]);
    setFormFaturaDestino(mesSelecionado);
  };

  const abrirModalNovaDespesa = () => {
    resetarFormulario();
    setModalAberto(true);
  };

  const abrirModalEdicao = (t: any) => {
    setTransacaoEditandoId(t.id);
    setFormDescricao(t.descricao);
    setFormValor(Math.abs(Number(t.valor)).toString());
    setFormData(t.data);
    setFormObservacao(t.observacao || '');
    
    // Identifica fatura alvo pela data cadastrada no banco
    const dataObj = new Date(`${t.data}T12:00:00Z`);
    setFormFaturaDestino(mesesNomes[dataObj.getUTCMonth()]);
    
    if (t.categoria_id) {
      setCategoriaSelecionada({
        catId: t.categoria_id,
        subId: t.subcategoria_id,
        nomeDisplay: renderNomeCategoria(t.categoria_id, t.subcategoria_id)
      });
    } else {
      setCategoriaSelecionada(null);
    }
    
    setFormParcelado(false); 
    setModalAberto(true);
  };

  const handleSalvarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartaoAtivo) return alert('Você precisa ter um cartão ativo.');
    if (!categoriaSelecionada) return alert('Selecione uma categoria para a despesa.');
    if (Number(formValor) <= 0) return alert('O valor deve ser maior que zero.');

    const valorOriginal = Number(formValor);
    
    // MODO EDIÇÃO
    if (transacaoEditandoId) {
      const dataOriginal = formData.split('-');
      let mesIndexAlvo = mesesNomes.indexOf(formFaturaDestino);
      const mesAlvoStr = String(mesIndexAlvo + 1).padStart(2, '0');
      
      let dataLancamento = `${dataOriginal[0]}-${mesAlvoStr}-${dataOriginal[2]}`;
      const testeData = new Date(`${dataLancamento}T12:00:00Z`);
      if (isNaN(testeData.getTime()) || testeData.getUTCMonth() !== mesIndexAlvo) {
        dataLancamento = `${dataOriginal[0]}-${mesAlvoStr}-01`;
      }

      let observacaoFinal = formObservacao;
      const mesOriginalIndex = new Date(`${formData}T12:00:00Z`).getUTCMonth();
      if (mesesNomes[mesOriginalIndex] !== formFaturaDestino) {
        observacaoFinal = `Compra original em: ${dataOriginal[2]}/${dataOriginal[1]}/${dataOriginal[0]}. ${formObservacao}`.trim();
      }

      const { error } = await supabase.from('transacao_pessoal').update({
        descricao: formDescricao,
        valor: valorOriginal,
        data: dataLancamento,
        observacao: observacaoFinal,
        categoria_id: categoriaSelecionada.catId,
        subcategoria_id: categoriaSelecionada.subId || null,
      }).eq('id', transacaoEditandoId);

      if (error) alert('Erro ao editar: ' + error.message);
      else {
        setModalAberto(false);
        resetarFormulario();
        refetch();
      }
      return;
    }

    // MODO CRIAÇÃO (Permite Parcelamento)
    const transacoesParaInserir = [];
    const qtdParcelas = formParcelado ? formParcelas : 1;
    const valorParcela = valorOriginal / qtdParcelas;
    const dataOriginal = formData.split('-'); 
    const diaCompra = dataOriginal[2];

    for (let i = 0; i < qtdParcelas; i++) {
      let mesIndexAlvo = mesesNomes.indexOf(formFaturaDestino) + i;
      let anoAlvo = anoSelecionado;
      
      while (mesIndexAlvo > 11) {
        mesIndexAlvo -= 12;
        anoAlvo++;
      }
      
      const mesAlvoStr = String(mesIndexAlvo + 1).padStart(2, '0');
      let dataLancamento = `${anoAlvo}-${mesAlvoStr}-${diaCompra}`;
      
      const testeData = new Date(`${dataLancamento}T12:00:00Z`);
      if (isNaN(testeData.getTime()) || testeData.getUTCMonth() !== mesIndexAlvo) {
        dataLancamento = `${anoAlvo}-${mesAlvoStr}-01`;
      }

      let observacaoFinal = formObservacao;
      const mesOriginalIndex = new Date(`${formData}T12:00:00Z`).getUTCMonth();
      if (mesesNomes[mesOriginalIndex] !== formFaturaDestino || formParcelado) {
        observacaoFinal = `Compra original em: ${dataOriginal[2]}/${dataOriginal[1]}/${dataOriginal[0]}. ${formObservacao}`.trim();
      }

      transacoesParaInserir.push({
        descricao: formParcelado ? `${formDescricao} (${i + 1}/${qtdParcelas})` : formDescricao,
        valor: valorParcela,
        situacao: 'PENDENTE', 
        tipo: 'DESPESA',
        data: dataLancamento,
        observacao: observacaoFinal,
        cartao_id: cartaoAtivo.id,
        categoria_id: categoriaSelecionada.catId,
        subcategoria_id: categoriaSelecionada.subId || null, 
      });
    }

    const { error } = await supabase.from('transacao_pessoal').insert(transacoesParaInserir);
    if (error) alert('Erro ao salvar: ' + error.message);
    else {
      setModalAberto(false);
      resetarFormulario();
      refetch();
    }
  };

  const deletarTransacao = async (id: string) => {
    if(!window.confirm('Excluir esta transação?')) return;
    await supabase.from('transacao_pessoal').delete().eq('id', id);
    refetch();
  };

  const renderNomeCategoria = (catId: string, subId?: string) => {
    if (!catId) return 'A Classificar';
    const cat = categorias.find((c: any) => c.id === catId);
    if (!cat) return 'A Classificar';
    if (subId) {
      const sub = subcategorias.find((s: any) => s.id === subId);
      return sub ? `${cat.nome} • ${sub.nome}` : cat.nome;
    }
    return cat.nome;
  };

  // --- LÓGICA DE IMPORTAÇÃO CSV ---
  const baixarModeloCSV = () => {
    const conteudo = "Data;Descricao;Valor\n01/08/2026;Uber;26,22\n15/08/2026;Restaurante;145,50";
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_fatura.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportarCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cartaoAtivo) return;

    const reader = new FileReader();
    reader.onload = async ({ target }) => {
      try {
        const text = target?.result as string;
        const rows = text.split('\n').map(r => r.trim()).filter(r => r);
        const transacoesImportadas = [];

        for(let i = 1; i < rows.length; i++) {
          const colunas = rows[i].split(';');
          if (colunas.length < 3) continue;

          const [dataRaw, desc, valorRaw] = colunas;
          
          // Tratamento da Data (DD/MM/YYYY -> YYYY-MM-DD)
          const partesData = dataRaw.split('/');
          if (partesData.length !== 3) continue;
          const dataFomatada = `${partesData[2]}-${partesData[1]}-${partesData[0]}`;

          // Tratamento do Valor (1.500,00 -> 1500.00)
          let cleanVal = valorRaw.replace('R$', '').trim();
          if (cleanVal.includes('.') && cleanVal.includes(',')) {
             cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
          } else if (cleanVal.includes(',')) {
             cleanVal = cleanVal.replace(',', '.');
          }
          const valorFinal = parseFloat(cleanVal);

          if (!isNaN(valorFinal)) {
            transacoesImportadas.push({
              cartao_id: cartaoAtivo.id,
              data: dataFomatada,
              descricao: desc.trim(),
              valor: valorFinal,
              tipo: 'DESPESA',
              situacao: 'PENDENTE',
              observacao: 'Importado via CSV'
            });
          }
        }

        if (transacoesImportadas.length > 0) {
          const { error } = await supabase.from('transacao_pessoal').insert(transacoesImportadas);
          if (error) alert('Erro ao importar para o banco: ' + error.message);
          else {
            alert(`${transacoesImportadas.length} transações importadas com sucesso! Não esqueça de classificar as categorias.`);
            refetch();
          }
        }
      } catch (err) {
        alert("Erro ao ler o arquivo CSV. Verifique se o formato está idêntico ao modelo.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = ''; // reseta o input
  };

  if (carregandoCartoes) return <div className="p-6 text-zinc-400">Carregando dados...</div>;

  if (cartoes.length === 0) return (
    <div className="p-6 text-center mt-20">
      <h2 className="text-xl text-white font-bold mb-2">Nenhum Cartão Cadastrado</h2>
      <p className="text-zinc-400">Volte para a tela anterior e cadastre um cartão primeiro.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-4 md:p-6 pb-24 relative">
      
      {/* INPUT HIDDEN PARA O CSV */}
      <input 
        type="file" 
        accept=".csv" 
        ref={fileInputRef} 
        onChange={handleImportarCSV} 
        className="hidden" 
      />

      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Link to="/financas/cartoes">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white bg-white/5"><ChevronLeft className="w-5 h-5" /></Button>
          </Link>
          <div className="bg-[#10b981] text-black px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
            Cartão: {cartaoAtivo?.nome}
          </div>

          {cartoes.length > 1 && (
            <div className="flex gap-2 bg-[#1e1e24] border border-white/5 p-1 rounded-full">
              {cartoes.map((c: any) => (
                <button key={c.id} onClick={() => setCartaoAtivo(c)} className={cn("px-3 py-1 rounded-full text-xs font-bold transition-all", cartaoAtivo?.id === c.id ? "bg-white/20 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                  {c.nome}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Button onClick={baixarModeloCSV} variant="outline" className="border-white/10 bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white text-xs font-bold h-9">
            <Download className="w-4 h-4 mr-2" /> Modelo CSV
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="border-[#10b981]/50 text-[#10b981] hover:bg-[#10b981]/10 bg-transparent text-xs font-bold h-9">
            <Upload className="w-4 h-4 mr-2" /> Importar Planilha
          </Button>
          <Button onClick={abrirModalNovaDespesa} className="bg-[#10b981] hover:bg-[#059669] text-black font-bold flex items-center gap-2 h-9">
            <Plus className="w-4 h-4" /> Nova Despesa
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LADO ESQUERDO: TABELA DE TRANSAÇÕES */}
        <div className="lg:col-span-2 bg-[#1e1e24] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => setAnoSelecionado(a => a - 1)} className="text-[#10b981] hover:bg-[#10b981]/10"><ChevronLeft className="w-5 h-5" /></Button>
            <span className="text-[#10b981] font-bold text-sm">{anoSelecionado}</span>
            <Button variant="ghost" size="icon" onClick={() => setAnoSelecionado(a => a + 1)} className="text-[#10b981] hover:bg-[#10b981]/10"><ChevronRight className="w-5 h-5" /></Button>
          </div>
          <div className="flex justify-between overflow-x-auto pb-4 scrollbar-hide gap-2 mb-6">
            {mesesNomes.map(m => (
              <button key={m} onClick={() => setMesSelecionado(m)} className={cn("px-4 py-1.5 rounded-full text-xs font-bold border transition-colors", mesSelecionado === m ? "border-[#10b981] text-[#10b981] bg-[#10b981]/10" : "border-white/10 text-zinc-500 hover:border-[#10b981]/50")}>
                {m}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-zinc-400 font-bold uppercase border-b border-white/5">
                <tr><th className="pb-3">Data Ref.</th><th className="pb-3">Descrição</th><th className="pb-3">Categoria</th><th className="pb-3 text-right">Valor</th><th className="pb-3 text-center">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transacoes.length === 0 ? (
                   <tr><td colSpan={5} className="py-8 text-center text-zinc-500">Nenhuma compra registrada para {mesSelecionado}/{anoSelecionado}.</td></tr>
                ) : (
                  transacoes.map((t: any) => (
                    <tr key={t.id} className="hover:bg-white/[0.02]">
                      <td className="py-4 text-zinc-300 whitespace-nowrap">{new Date(t.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">{t.descricao}</span>
                          {t.observacao && <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5 truncate max-w-[300px]"><FileText className="w-3 h-3 flex-shrink-0" /> {t.observacao}</span>}
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={cn(
                          "border px-2.5 py-1 rounded-full text-xs inline-block max-w-[200px] truncate", 
                          !t.categoria_id ? "bg-amber-500/10 border-amber-500/20 text-amber-500 font-bold" : "bg-[#1a1a20] border-white/5 text-zinc-300"
                        )}>
                          {renderNomeCategoria(t.categoria_id, t.subcategoria_id)}
                        </span>
                      </td>
                      <td className="py-4 text-right font-bold text-[#e74c3c] whitespace-nowrap">- R$ {Number(t.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                      <td className="py-4 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => abrirModalEdicao(t)} className="h-8 w-8 text-zinc-500 hover:text-white"><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => deletarTransacao(t.id)} className="h-8 w-8 text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* LADO DIREITO: RESUMO */}
        <div className="space-y-4">
          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Valor da fatura</p><p className="text-2xl font-bold text-white">R$ {totalFatura.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div>
            <div className="w-10 h-10 rounded-full bg-[#10b981]/20 flex items-center justify-center"><DollarSign className="w-5 h-5 text-[#10b981]" /></div>
          </div>
          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Status</p><p className="text-xl font-bold text-white">Fatura aberta</p></div>
            <div className="w-10 h-10 rounded-full bg-[#3498db]/20 flex items-center justify-center"><Receipt className="w-5 h-5 text-[#3498db]" /></div>
          </div>
          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Dia de fechamento</p><p className="text-xl font-bold text-white">{cartaoAtivo?.dia_fechamento || '--'} de {mesSelecionado}</p></div>
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center"><Calendar className="w-5 h-5 text-amber-500" /></div>
          </div>
          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Data vencimento</p><p className="text-xl font-bold text-white">{cartaoAtivo?.dia_vencimento || '--'} de {mesSelecionado}</p></div>
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center"><Calendar className="w-5 h-5 text-red-500" /></div>
          </div>
        </div>
      </div>

      {/* MODAL NOVA DESPESA / EDIÇÃO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a20] rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center shrink-0">
              <h2 className="text-xl text-white font-bold flex items-center gap-2">
                <CreditCard className="text-[#10b981]" size={20} /> 
                {transacaoEditandoId ? 'Editar Despesa' : 'Lançar Despesa'}
              </h2>
              <button onClick={() => setModalAberto(false)} className="text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* COLUNA ESQUERDA */}
                <div className="space-y-5">
                  <div>
                    <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Valor Total</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R$</span>
                      <input type="number" step="0.01" required value={formValor} onChange={(e) => setFormValor(e.target.value)} className="w-full bg-[#1e1e24] text-white text-xl font-bold border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-[#10b981] focus:outline-none transition-all" placeholder="0,00" />
                    </div>
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Descrição da Compra</label>
                    <input type="text" required value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all" placeholder="Ex: Mercado Livre" />
                  </div>
                  
                  <div className="relative">
                    <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Categoria</label>
                    
                    <button 
                      type="button"
                      onClick={() => setDropdownCatAberto(!dropdownCatAberto)}
                      className={cn("w-full bg-[#1e1e24] text-left border rounded-xl p-3 flex justify-between items-center transition-all", dropdownCatAberto ? "border-[#10b981]" : "border-white/10 hover:border-white/20")}
                    >
                      <span className={categoriaSelecionada ? "text-white font-medium" : "text-amber-500 font-bold"}>
                        {categoriaSelecionada ? categoriaSelecionada.nomeDisplay : '⚠️ A Classificar'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    </button>

                    {dropdownCatAberto && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setDropdownCatAberto(false)}></div>
                        <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#1e1e24] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-64">
                          <div className="p-2 border-b border-white/5 flex items-center gap-2 bg-[#1a1a20]">
                            <Search className="w-4 h-4 text-zinc-500 ml-2" />
                            <input 
                              type="text" autoFocus placeholder="Buscar categoria..." 
                              value={buscaCat} onChange={(e) => setBuscaCat(e.target.value)}
                              className="w-full bg-transparent text-sm text-white placeholder-zinc-500 p-1 focus:outline-none"
                            />
                          </div>
                          
                          <div className="overflow-y-auto p-1 custom-scrollbar flex-1">
                            {categoriasFiltradas.length === 0 ? (
                               <p className="p-3 text-xs text-center text-zinc-500">Nenhuma categoria encontrada.</p>
                            ) : (
                              categoriasFiltradas.map((cat: any) => {
                                const subsDaCategoria = subcategorias.filter((sub: any) => sub.categoria_id === cat.id);
                                return (
                                  <div key={cat.id} className="mb-1">
                                    <button
                                      type="button"
                                      onClick={() => { setCategoriaSelecionada({catId: cat.id, nomeDisplay: cat.nome}); setDropdownCatAberto(false); }}
                                      className="w-full text-left px-3 py-2 text-sm font-semibold text-white hover:bg-white/5 rounded-lg transition-colors flex items-center justify-between"
                                    >
                                      {cat.nome}
                                    </button>
                                    
                                    {subsDaCategoria.map((sub: any) => (
                                      <button
                                        key={sub.id} type="button"
                                        onClick={() => { setCategoriaSelecionada({catId: cat.id, subId: sub.id, nomeDisplay: `${cat.nome} • ${sub.nome}`}); setDropdownCatAberto(false); }}
                                        className="w-full text-left pl-8 pr-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2 mt-0.5"
                                      >
                                        <CornerDownRight className="w-3 h-3 text-zinc-600" />
                                        {sub.nome}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* COLUNA DIREITA */}
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1.5">Data da Compra</label>
                      <input type="date" required value={formData} onChange={(e) => setFormData(e.target.value)} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all [color-scheme:dark] text-sm" />
                    </div>
                    <div>
                      <label className="text-[#10b981] text-[10px] font-bold uppercase block mb-1.5">Lançar na Fatura de:</label>
                      <select value={formFaturaDestino} onChange={(e) => setFormFaturaDestino(e.target.value)} className="w-full bg-[#10b981]/10 text-[#10b981] font-bold border border-[#10b981]/30 rounded-xl p-3 focus:outline-none transition-all text-sm appearance-none cursor-pointer">
                        {mesesNomes.map(m => <option key={m} value={m} className="bg-[#1e1e24] text-white">{m}</option>)}
                      </select>
                    </div>
                  </div>

                  {!transacaoEditandoId && (
                    <div className="p-4 bg-[#1e1e24] border border-white/10 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-sm font-bold text-white block">Parcelar Compra?</span>
                          <span className="text-xs text-zinc-500">Dividir nas próximas faturas</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={formParcelado} onChange={(e) => setFormParcelado(e.target.checked)}/>
                          <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10b981]"></div>
                        </label>
                      </div>
                      {formParcelado && (
                        <div className="border-t border-white/10 pt-4">
                          <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Qtd Parcelas</label>
                          <input type="number" min="2" max="48" value={formParcelas} onChange={(e) => setFormParcelas(Number(e.target.value))} className="w-full bg-[#1a1a20] text-white border border-white/10 rounded-lg p-2.5 focus:border-[#10b981] focus:outline-none" />
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Observações (Opcional)</label>
                    <textarea value={formObservacao} onChange={(e) => setFormObservacao(e.target.value)} rows={3} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all resize-none" placeholder="Ex: Presente do Bento..." />
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER MODAL */}
            <div className="p-6 border-t border-white/10 flex justify-end gap-3 shrink-0 bg-[#1a1a20]">
              <button type="button" onClick={() => setModalAberto(false)} className="px-6 py-2.5 text-sm text-zinc-400 font-bold hover:text-white transition-colors">CANCELAR</button>
              <button onClick={handleSalvarDespesa} className="bg-[#10b981] text-black hover:bg-[#059669] px-8 py-2.5 rounded-lg text-sm font-bold transition-all">
                {transacaoEditandoId ? 'SALVAR ALTERAÇÕES' : 'SALVAR COMPRA'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
