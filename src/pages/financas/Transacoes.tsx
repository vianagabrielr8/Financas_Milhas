import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, X, Calendar, ChevronDown, CornerDownRight, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Transacoes() {
  const [modalAberto, setModalAberto] = useState(false);
  const [drawerFiltroAberto, setDrawerFiltroAberto] = useState(false);

  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const [filtrosAtivos, setFiltrosAtivos] = useState({
    busca: '',
    tipo: 'TODOS',
    situacao: 'TODAS',
    categoriaId: 'TODAS',
    subcategoriaId: 'TODAS',
    nomeCategoriaDisplay: 'Todas as categorias',
    cartao: 'TODOS',
    diaVencimento: 'TODOS',
    centroCustoId: 'TODOS'
  });

  const [filtrosTemp, setFiltrosTemp] = useState(filtrosAtivos);
  const [dropdownCatFiltroAberto, setDropdownCatFiltroAberto] = useState(false);
  const [buscaCatFiltro, setBuscaCatFiltro] = useState('');

  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formSituacao, setFormSituacao] = useState('PAGO');
  const [formTipo, setFormTipo] = useState('DESPESA'); 
  const [formData, setFormData] = useState(new Date().toISOString().split('T')[0]);
  const [formRecorrente, setFormRecorrente] = useState(false);
  const [formFrequencia, setFormFrequencia] = useState('MENSAL');
  const [formObservacao, setFormObservacao] = useState('');
  const [formContaId, setFormContaId] = useState('');
  const [formCentroCustoId, setFormCentroCustoId] = useState('');

  const [categoriaSelecionada, setCategoriaSelecionada] = useState<{catId: string, subId?: string, nomeDisplay: string} | null>(null);
  const [dropdownCatAberto, setDropdownCatAberto] = useState(false);
  const [buscaCat, setBuscaCat] = useState('');

  // Buscas no Supabase
  const { data: categorias = [] } = useQuery({ queryKey: ['categorias_pessoais'], queryFn: async () => { const { data } = await supabase.from('categoria_pessoal').select('*').order('nome'); return data || []; }});
  const { data: subcategorias = [] } = useQuery({ queryKey: ['subcategorias_pessoais'], queryFn: async () => { const { data } = await supabase.from('subcategoria_pessoal').select('*').order('nome'); return data || []; }});
  const { data: contas = [] } = useQuery({ queryKey: ['contas_financeiras'], queryFn: async () => { const { data } = await supabase.from('conta_financeira_pessoal').select('*').order('nome'); return data || []; }});
  const { data: cartoes = [] } = useQuery({ queryKey: ['cartoes_pessoais'], queryFn: async () => { const { data } = await supabase.from('cartao_pessoal').select('*').order('nome'); return data || []; }});
  
  // Busca Corrigida e Reforçada: Centro de Custo Projeto
  const { data: centrosCusto = [] } = useQuery({ 
    queryKey: ['centro_custo_projeto'], 
    queryFn: async () => { 
      const { data, error } = await supabase.from('centro_custo_projeto').select('*').order('nome'); 
      if (error) console.error("Erro ao buscar Centros de Custo:", error);
      return data || []; 
    }
  });

  const diasVencimentoDisponiveis = useMemo(() => {
    const dias = cartoes.map((c: any) => c.dia_vencimento).filter(Boolean);
    return Array.from(new Set(dias)).sort((a: any, b: any) => a - b);
  }, [cartoes]);

  const mesFormatado = String(mesSelecionado).padStart(2, '0');
  const ultimoDia = new Date(anoSelecionado, mesSelecionado, 0).getDate();
  const dataInicio = `${anoSelecionado}-${mesFormatado}-01`;
  const dataFim = `${anoSelecionado}-${mesFormatado}-${ultimoDia}`;

  const { data: transacoes = [], isLoading, refetch } = useQuery({
    queryKey: ['transacoes_gerais', dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transacao_pessoal')
        .select('*, conta_financeira_pessoal(nome), cartao_pessoal(nome, dia_vencimento), centro_custo_projeto(nome)')
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .order('data', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  const categoriasFiltradasModal = useMemo(() => {
    const termo = buscaCat.toLowerCase();
    if (!termo) return categorias;
    return categorias.filter((cat: any) => {
      const matchCat = cat.nome.toLowerCase().includes(termo);
      const subs = subcategorias.filter((sub: any) => sub.categoria_id === cat.id);
      const matchSub = subs.some((sub: any) => sub.nome.toLowerCase().includes(termo));
      return matchCat || matchSub;
    });
  }, [categorias, subcategorias, buscaCat]);

  const categoriasFiltradasDrawer = useMemo(() => {
    const termo = buscaCatFiltro.toLowerCase();
    if (!termo) return categorias;
    return categorias.filter((cat: any) => {
      const matchCat = cat.nome.toLowerCase().includes(termo);
      const subs = subcategorias.filter((sub: any) => sub.categoria_id === cat.id);
      const matchSub = subs.some((sub: any) => sub.nome.toLowerCase().includes(termo));
      return matchCat || matchSub;
    });
  }, [categorias, subcategorias, buscaCatFiltro]);

  const renderNomeCategoria = (catId: string, subId?: string) => {
    if (!catId) return 'Sem categoria';
    const cat = categorias.find((c: any) => c.id === catId);
    if (!cat) return 'Sem categoria';
    if (subId) {
      const sub = subcategorias.find((s: any) => s.id === subId);
      return sub ? `${cat.nome} • ${sub.nome}` : cat.nome;
    }
    return cat.nome;
  };

  const transacoesFiltradas = useMemo(() => {
    return transacoes.filter((t: any) => {
      const matchBusca = filtrosAtivos.busca === '' || t.descricao.toLowerCase().includes(filtrosAtivos.busca.toLowerCase());
      const matchTipo = filtrosAtivos.tipo === 'TODOS' || t.tipo === filtrosAtivos.tipo;
      const matchSituacao = filtrosAtivos.situacao === 'TODAS' || t.situacao === filtrosAtivos.situacao;
      const matchCartao = filtrosAtivos.cartao === 'TODOS' || t.cartao_id === filtrosAtivos.cartao;
      const matchCategoria = filtrosAtivos.categoriaId === 'TODAS' || t.categoria_id === filtrosAtivos.categoriaId;
      const matchSubcategoria = filtrosAtivos.subcategoriaId === 'TODAS' || t.subcategoria_id === filtrosAtivos.subcategoriaId;
      const matchDiaVencimento = filtrosAtivos.diaVencimento === 'TODOS' || (t.cartao_pessoal?.dia_vencimento === Number(filtrosAtivos.diaVencimento));
      const matchCentroCusto = filtrosAtivos.centroCustoId === 'TODOS' || t.centro_custo_id === filtrosAtivos.centroCustoId;

      return matchBusca && matchTipo && matchSituacao && matchCategoria && matchSubcategoria && matchCartao && matchDiaVencimento && matchCentroCusto;
    });
  }, [transacoes, filtrosAtivos]);

  const abrirFiltros = () => { setFiltrosTemp(filtrosAtivos); setDrawerFiltroAberto(true); };
  const aplicarFiltros = () => { setFiltrosAtivos(filtrosTemp); setDrawerFiltroAberto(false); };

  const limparFiltros = () => {
    const estadoLimpo = { 
      busca: '', tipo: 'TODOS', situacao: 'TODAS', 
      categoriaId: 'TODAS', subcategoriaId: 'TODAS', nomeCategoriaDisplay: 'Todas as categorias', 
      cartao: 'TODOS', diaVencimento: 'TODOS', centroCustoId: 'TODOS'
    };
    setFiltrosTemp(estadoLimpo);
    setFiltrosAtivos(estadoLimpo);
    setDrawerFiltroAberto(false);
  };

  const temFiltroAtivo = filtrosAtivos.tipo !== 'TODOS' || filtrosAtivos.situacao !== 'TODAS' || filtrosAtivos.categoriaId !== 'TODAS' || filtrosAtivos.cartao !== 'TODOS' || filtrosAtivos.diaVencimento !== 'TODOS' || filtrosAtivos.centroCustoId !== 'TODOS';

  const resetForm = () => {
    setFormDescricao(''); setFormValor(''); setFormSituacao('PAGO'); setFormTipo('DESPESA');
    setFormData(new Date().toISOString().split('T')[0]); setFormRecorrente(false);
    setFormFrequencia('MENSAL'); setFormObservacao(''); setFormContaId('');
    setFormCentroCustoId(''); setCategoriaSelecionada(null); setBuscaCat('');
  };

  const handleChangeTipo = (novoTipo: string) => {
    setFormTipo(novoTipo);
    // Inteligência para trocar o status se o usuário alternar entre Receita e Despesa
    if (novoTipo === 'RECEITA' && formSituacao === 'PAGO') setFormSituacao('RECEBIDO');
    if (novoTipo === 'DESPESA' && formSituacao === 'RECEBIDO') setFormSituacao('PAGO');
  };

  const handleSalvarTransacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCentroCustoId) return alert('Por favor, selecione um Centro de Custo.');
    if (!formContaId) return alert('Por favor, selecione uma conta financeira base.');
    if (!categoriaSelecionada) return alert('Por favor, selecione uma categoria.');

    const transacoesParaInserir = [];
    let quantidade = 1;

    if (formRecorrente) {
      if (formFrequencia === 'MENSAL') quantidade = 12;
      else if (formFrequencia === 'SEMANAL') quantidade = 4;
      else if (formFrequencia === 'ANUAL') quantidade = 5;
    }

    for (let i = 0; i < quantidade; i++) {
      const dataBase = new Date(formData + 'T12:00:00Z'); 
      if (formFrequencia === 'MENSAL') dataBase.setUTCMonth(dataBase.getUTCMonth() + i);
      else if (formFrequencia === 'SEMANAL') dataBase.setUTCDate(dataBase.getUTCDate() + (i * 7));
      else if (formFrequencia === 'ANUAL') dataBase.setUTCFullYear(dataBase.getUTCFullYear() + i);

      transacoesParaInserir.push({
        descricao: formRecorrente ? `${formDescricao} (${i + 1}/${quantidade})` : formDescricao,
        valor: parseFloat(formValor),
        situacao: i === 0 ? formSituacao : 'PENDENTE', 
        tipo: formTipo,
        data: dataBase.toISOString().split('T')[0],
        observacao: formObservacao,
        recorrente: formRecorrente,
        frequencia_recorrencia: formRecorrente ? formFrequencia : null,
        centro_custo_id: formCentroCustoId,
        conta_id: formContaId,
        cartao_id: null, // Forçado nulo pois removemos o campo
        categoria_id: categoriaSelecionada.catId,
        subcategoria_id: categoriaSelecionada.subId || null,
      });
    }

    const { error: insertError } = await supabase.from('transacao_pessoal').insert(transacoesParaInserir);

    if (insertError) {
      alert('Erro ao inserir: ' + insertError.message);
    } else {
      setModalAberto(false);
      resetForm();
      refetch(); 
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen pb-10 p-4 md:p-6 text-gray-200 relative overflow-hidden">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl text-white font-bold tracking-tight">Transações</h1>
          <p className="text-gray-400 mt-1 text-sm">Gestão de fluxo de caixa direto e movimentações.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Buscar transação..." value={filtrosAtivos.busca} onChange={(e) => setFiltrosAtivos({...filtrosAtivos, busca: e.target.value})} className="w-full bg-[#1a1a20] text-sm text-white border border-gray-800 rounded-lg py-2 pl-9 pr-4 focus:border-emerald-500 focus:outline-none transition-colors h-[42px]" />
          </div>

          <div className="flex items-center bg-[#1a1a20] border border-gray-800 rounded-lg px-3 focus-within:border-emerald-500 transition-colors h-[42px]">
            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
            <input type="month" value={`${anoSelecionado}-${mesFormatado}`} onChange={(e) => { const [ano, mes] = e.target.value.split('-'); setAnoSelecionado(Number(ano)); setMesSelecionado(Number(mes)); }} className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark]" />
          </div>

          <button onClick={abrirFiltros} className={cn("flex items-center justify-center h-[42px] px-4 rounded-lg border transition-colors text-sm font-medium", temFiltroAtivo ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" : "bg-[#1a1a20] border-gray-800 text-gray-400 hover:text-white hover:border-gray-600")}>
            <Filter className="w-4 h-4 mr-2" /> Filtros {temFiltroAtivo && <span className="ml-2 w-2 h-2 rounded-full bg-emerald-500"></span>}
          </button>

          <button onClick={() => setModalAberto(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 h-[42px] rounded-lg font-medium transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nova
          </button>
        </div>
      </div>

      {/* TABELA DE DADOS */}
      <div className="bg-[#1a1a20] rounded-xl border border-gray-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-[#22222a] text-gray-400 text-[11px] uppercase tracking-wider font-semibold">
                <th className="p-4 w-28">Data</th>
                <th className="p-4">Descrição</th>
                <th className="p-4">Categoria</th>
                <th className="p-4 w-32">Conta / Cartão</th>
                <th className="p-4 w-32">Tipo</th>
                <th className="p-4 text-right w-40">Valor</th>
                <th className="p-4 w-32 text-center">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {isLoading ? (
                <tr><td colSpan={7} className="p-8 text-center text-emerald-500 font-medium">Carregando dados...</td></tr>
              ) : transacoesFiltradas.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhuma transação encontrada.</td></tr>
              ) : (
                transacoesFiltradas.map((t: any) => (
                  <tr key={t.id} className="hover:bg-[#22222a] transition-colors text-gray-200">
                    <td className="p-4 text-sm whitespace-nowrap">
                      {new Date(t.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="font-medium text-white">{t.descricao}</span>
                        <div className="flex flex-wrap gap-2">
                          {t.recorrente && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase font-bold tracking-wider">Recorrente</span>}
                          {t.cartao_pessoal?.dia_vencimento && <span className="text-[9px] text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded font-bold uppercase">Venc: Dia {t.cartao_pessoal.dia_vencimento}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className="bg-[#22222a] border border-gray-800 px-2.5 py-1.5 rounded-md text-xs text-gray-300 inline-block max-w-[180px] truncate">
                          {renderNomeCategoria(t.categoria_id, t.subcategoria_id)}
                        </span>
                        {/* TAG DO CENTRO DE CUSTO PROJETO */}
                        {t.centro_custo_projeto && (
                          <span className="text-[10px] text-emerald-500/80 font-semibold uppercase tracking-wider pl-1">
                            {t.centro_custo_projeto.nome}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                      {t.cartao_pessoal ? (
                         <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/20 uppercase font-bold tracking-wider flex items-center gap-1 w-max">💳 {t.cartao_pessoal.nome}</span>
                      ) : (t.conta_financeira_pessoal?.nome || '—')}
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`flex items-center gap-1.5 font-medium ${t.tipo === 'RECEITA' ? 'text-emerald-400' : 'text-red-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${t.tipo === 'RECEITA' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                        {t.tipo}
                      </span>
                    </td>
                    <td className="p-4 text-right font-semibold whitespace-nowrap">
                      {t.tipo === 'DESPESA' ? '-' : '+'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.valor)}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase border ${t.situacao === 'PAGO' || t.situacao === 'RECEBIDO' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>{t.situacao}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GAVETA LATERAL DE FILTROS */}
      {drawerFiltroAberto && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setDrawerFiltroAberto(false)}></div>
          
          <div className="relative w-full max-w-sm h-full bg-[#15151a] border-l border-gray-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#1a1a20]">
              <h3 className="text-lg font-bold text-white">Filtros de transação</h3>
              <button onClick={() => setDrawerFiltroAberto(false)} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              
              {/* FILTRO CENTRO DE CUSTO */}
              <div>
                <label className="text-[11px] uppercase font-bold text-gray-500 mb-2 block tracking-wider">Centro de Custo</label>
                <select value={filtrosTemp.centroCustoId} onChange={(e) => setFiltrosTemp({...filtrosTemp, centroCustoId: e.target.value})} className="w-full bg-[#22222a] text-sm text-white border border-gray-800 rounded-lg p-3 focus:border-emerald-500 focus:outline-none appearance-none transition-colors">
                  <option value="TODOS">Todos os centros</option>
                  {centrosCusto.map((cc: any) => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
                </select>
              </div>

              <div className="relative">
                <label className="text-[11px] uppercase font-bold text-gray-500 mb-2 block tracking-wider">Categorias</label>
                <button type="button" onClick={() => setDropdownCatFiltroAberto(!dropdownCatFiltroAberto)} className={cn("w-full bg-[#22222a] text-left border rounded-lg p-3 flex justify-between items-center transition-all", dropdownCatFiltroAberto ? "border-emerald-500" : "border-gray-800")}>
                  <span className={filtrosTemp.categoriaId !== 'TODAS' ? "text-white text-sm" : "text-gray-400 text-sm"}>{filtrosTemp.nomeCategoriaDisplay}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                {dropdownCatFiltroAberto && (
                  <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-[#22222a] border border-gray-700 rounded-lg shadow-2xl z-50 flex flex-col max-h-64">
                    <div className="p-2 border-b border-gray-800 flex items-center gap-2 bg-[#1a1a20]">
                      <Search className="w-4 h-4 text-gray-500 ml-2" />
                      <input type="text" autoFocus placeholder="Buscar categoria..." value={buscaCatFiltro} onChange={(e) => setBuscaCatFiltro(e.target.value)} className="w-full bg-transparent text-sm text-white placeholder-gray-500 p-1 focus:outline-none"/>
                    </div>
                    <div className="overflow-y-auto p-1 custom-scrollbar flex-1">
                      <button type="button" onClick={() => { setFiltrosTemp({...filtrosTemp, categoriaId: 'TODAS', subcategoriaId: 'TODAS', nomeCategoriaDisplay: 'Todas as categorias'}); setDropdownCatFiltroAberto(false); }} className="w-full text-left px-3 py-2 text-sm font-semibold text-gray-400 hover:bg-gray-800 rounded-lg transition-colors mb-2">Todas as categorias</button>
                      {categoriasFiltradasDrawer.length === 0 ? (
                         <p className="p-3 text-xs text-center text-gray-500">Nenhuma categoria encontrada.</p>
                      ) : (
                        categoriasFiltradasDrawer.map((cat: any) => {
                          const subsDaCategoria = subcategorias.filter((sub: any) => sub.categoria_id === cat.id);
                          return (
                            <div key={cat.id} className="mb-1">
                              <button type="button" onClick={() => { setFiltrosTemp({...filtrosTemp, categoriaId: cat.id, subcategoriaId: 'TODAS', nomeCategoriaDisplay: cat.nome}); setDropdownCatFiltroAberto(false); }} className="w-full text-left px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 rounded-lg transition-colors">{cat.nome}</button>
                              {subsDaCategoria.map((sub: any) => (
                                <button key={sub.id} type="button" onClick={() => { setFiltrosTemp({...filtrosTemp, categoriaId: cat.id, subcategoriaId: sub.id, nomeCategoriaDisplay: `${cat.nome} • ${sub.nome}`}); setDropdownCatFiltroAberto(false); }} className="w-full text-left pl-8 pr-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2 mt-0.5"><CornerDownRight className="w-3 h-3 text-gray-600" />{sub.nome}</button>
                              ))}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-gray-500 mb-2 block tracking-wider">Cartões de Crédito</label>
                <select value={filtrosTemp.cartao} onChange={(e) => setFiltrosTemp({...filtrosTemp, cartao: e.target.value})} className="w-full bg-[#22222a] text-sm text-white border border-gray-800 rounded-lg p-3 focus:border-emerald-500 focus:outline-none appearance-none transition-colors">
                  <option value="TODOS">Todos os cartões</option>
                  {cartoes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-gray-500 mb-2 block tracking-wider">Vencimento da Fatura</label>
                <select value={filtrosTemp.diaVencimento} onChange={(e) => setFiltrosTemp({...filtrosTemp, diaVencimento: e.target.value})} className="w-full bg-[#22222a] text-sm text-white border border-gray-800 rounded-lg p-3 focus:border-emerald-500 focus:outline-none appearance-none transition-colors">
                  <option value="TODOS">Todos os dias</option>
                  {diasVencimentoDisponiveis.map((dia: any) => <option key={dia} value={dia}>Dia {dia}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-gray-500 mb-2 block tracking-wider">Situações</label>
                <select value={filtrosTemp.situacao} onChange={(e) => setFiltrosTemp({...filtrosTemp, situacao: e.target.value})} className="w-full bg-[#22222a] text-sm text-white border border-gray-800 rounded-lg p-3 focus:border-emerald-500 focus:outline-none appearance-none transition-colors">
                  <option value="TODAS">Todas as situações</option>
                  <option value="PAGO">Pago / Recebido</option>
                  <option value="PENDENTE">Pendente</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-gray-500 mb-2 block tracking-wider">Tipos</label>
                <select value={filtrosTemp.tipo} onChange={(e) => setFiltrosTemp({...filtrosTemp, tipo: e.target.value})} className="w-full bg-[#22222a] text-sm text-white border border-gray-800 rounded-lg p-3 focus:border-emerald-500 focus:outline-none appearance-none transition-colors">
                  <option value="TODOS">Todos os tipos</option>
                  <option value="RECEITA">Receitas</option>
                  <option value="DESPESA">Despesas</option>
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 bg-[#1a1a20] flex justify-between items-center gap-4">
              <button onClick={limparFiltros} className="text-sm font-bold text-gray-400 hover:text-white transition-colors">LIMPAR</button>
              <div className="flex gap-3">
                <button onClick={() => setDrawerFiltroAberto(false)} className="px-4 py-2.5 text-sm font-bold text-gray-400 hover:text-white transition-colors">CANCELAR</button>
                <button onClick={aplicarFiltros} className="bg-[#6b46c1] hover:bg-[#553c9a] text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-[#6b46c1]/20">APLICAR</button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Nova Transação */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#15151a] p-8 rounded-2xl w-full max-w-xl border border-gray-800 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-2xl text-white font-bold">Nova Transação</h2>
              <button onClick={() => { setModalAberto(false); resetForm(); }} className="text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSalvarTransacao} className="flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-2">
              
              {/* Botões Receita vs Despesa */}
              <div className="flex bg-[#22222a] p-1 rounded-lg border border-gray-800">
                <button type="button" onClick={() => handleChangeTipo('DESPESA')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formTipo === 'DESPESA' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Despesa</button>
                <button type="button" onClick={() => handleChangeTipo('RECEITA')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formTipo === 'RECEITA' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Receita</button>
              </div>

              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Descrição</label>
                <input type="text" required value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} className="w-full bg-[#22222a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none transition-all placeholder-gray-600" placeholder="Ex: Pagamento de Fornecedor" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Valor</label>
                  <input type="number" step="0.01" required value={formValor} onChange={(e) => setFormValor(e.target.value)} className="w-full bg-[#22222a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none transition-all placeholder-gray-600" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Data</label>
                  <input type="date" required value={formData} onChange={(e) => setFormData(e.target.value)} className="w-full bg-[#22222a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none transition-all [color-scheme:dark]" />
                </div>
              </div>

              {/* CC e Conta lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Centro de Custo</label>
                  <select required value={formCentroCustoId} onChange={(e) => setFormCentroCustoId(e.target.value)} className="w-full bg-[#22222a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none transition-all appearance-none">
                    <option value="" disabled>Selecione o centro...</option>
                    {centrosCusto.map((cc: any) => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Conta / Caixa</label>
                  <select required value={formContaId} onChange={(e) => setFormContaId(e.target.value)} className="w-full bg-[#22222a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none transition-all appearance-none">
                    <option value="" disabled>Selecione a conta...</option>
                    {contas.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Categoria ocupando toda a largura para melhorar UX de busca */}
              <div className="relative">
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Categoria</label>
                <button type="button" onClick={() => setDropdownCatAberto(!dropdownCatAberto)} className={cn("w-full bg-[#22222a] text-left border rounded-lg p-2.5 flex justify-between items-center transition-all", dropdownCatAberto ? "border-emerald-500" : "border-gray-700 hover:border-gray-500")}>
                  <span className={categoriaSelecionada ? "text-white font-medium" : "text-gray-500"}>{categoriaSelecionada ? categoriaSelecionada.nomeDisplay : 'Selecionar categoria...'}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                {dropdownCatAberto && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDropdownCatAberto(false)}></div>
                    <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-[#22222a] border border-gray-700 rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col max-h-64">
                      <div className="p-2 border-b border-gray-800 flex items-center gap-2 bg-[#1a1a20]">
                        <Search className="w-4 h-4 text-gray-500 ml-2" />
                        <input type="text" autoFocus placeholder="Buscar categoria..." value={buscaCat} onChange={(e) => setBuscaCat(e.target.value)} className="w-full bg-transparent text-sm text-white placeholder-gray-500 p-1 focus:outline-none"/>
                      </div>
                      <div className="overflow-y-auto p-1 custom-scrollbar flex-1">
                        {categoriasFiltradasModal.length === 0 ? (
                           <p className="p-3 text-xs text-center text-gray-500">Nenhuma categoria encontrada.</p>
                        ) : (
                          categoriasFiltradasModal.map((cat: any) => {
                            const subsDaCategoria = subcategorias.filter((sub: any) => sub.categoria_id === cat.id);
                            return (
                              <div key={cat.id} className="mb-1">
                                <button type="button" onClick={() => { setCategoriaSelecionada({catId: cat.id, nomeDisplay: cat.nome}); setDropdownCatAberto(false); }} className="w-full text-left px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center justify-between">{cat.nome}</button>
                                {subsDaCategoria.map((sub: any) => (
                                  <button key={sub.id} type="button" onClick={() => { setCategoriaSelecionada({catId: cat.id, subId: sub.id, nomeDisplay: `${cat.nome} • ${sub.nome}`}); setDropdownCatAberto(false); }} className="w-full text-left pl-8 pr-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors flex items-center gap-2 mt-0.5"><CornerDownRight className="w-3 h-3 text-gray-600" />{sub.nome}</button>
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

              {/* Situação Condicional */}
              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Situação</label>
                <select value={formSituacao} onChange={(e) => setFormSituacao(e.target.value)} className="w-full bg-[#22222a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none transition-all appearance-none">
                  {formTipo === 'DESPESA' ? (
                    <>
                      <option value="PAGO">Efetuado / Pago</option>
                      <option value="PENDENTE">A Pagar (Pendente)</option>
                    </>
                  ) : (
                    <>
                      <option value="RECEBIDO">Efetuado / Recebido</option>
                      <option value="PENDENTE">A Receber (Pendente)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="p-4 bg-[#22222a] rounded-lg border border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-white block">Lançamento Recorrente?</span>
                    <span className="text-xs text-gray-500">Repetir esta transação no futuro</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={formRecorrente} onChange={(e) => setFormRecorrente(e.target.checked)}/>
                    <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                {formRecorrente && (
                  <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Frequência</label>
                    <select value={formFrequencia} onChange={(e) => setFormFrequencia(e.target.value)} className="w-full bg-[#15151a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none">
                      <option value="SEMANAL">Semanal</option>
                      <option value="MENSAL">Mensal</option>
                      <option value="ANUAL">Anual</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider block mb-1.5">Observações (Opcional)</label>
                <textarea value={formObservacao} onChange={(e) => setFormObservacao(e.target.value)} rows={2} className="w-full bg-[#22222a] text-white border border-gray-700 rounded-lg p-2.5 focus:border-emerald-500 focus:outline-none transition-all placeholder-gray-600 resize-none" placeholder="Detalhes adicionais..." />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-800 shrink-0">
                <button type="button" onClick={() => { setModalAberto(false); resetForm(); }} className="px-5 py-2.5 text-sm text-gray-400 hover:text-white transition-colors font-medium rounded-lg hover:bg-gray-800">Cancelar</button>
                <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-500/20">Salvar Transação</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}