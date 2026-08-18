import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Plus, Filter, FileText, ChevronDown, Check, Trash2, Edit2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Transacoes() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  
  const dataAtual = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const mm = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const yyyy = dataAtual.getFullYear();
    return `${yyyy}-${mm}`;
  });

  const [modalFiltrosAberto, setModalFiltrosAberto] = useState(false);
  const [filtros, setFiltros] = useState({ conta: '', tipo: '', situacao: '' });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas_pessoais_simples'],
    queryFn: async () => {
      const { data } = await supabase.from('conta_pessoal').select('id, nome_banco').order('nome_banco');
      return data || [];
    }
  });

  const { data: cartoes = [] } = useQuery({
    queryKey: ['cartoes_pessoais_simples'],
    queryFn: async () => {
      const { data } = await supabase.from('cartao_pessoal').select('id, nome').order('nome');
      return data || [];
    }
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias_simples'],
    queryFn: async () => {
      const { data } = await supabase.from('categoria_pessoal').select('id, nome, centro_custo_projeto(nome)');
      return data || [];
    }
  });

  const { data: subcategorias = [] } = useQuery({
    queryKey: ['subcategorias_simples'],
    queryFn: async () => {
      const { data } = await supabase.from('subcategoria_pessoal').select('id, nome');
      return data || [];
    }
  });

  const { data: transacoes = [], isLoading } = useQuery({
    queryKey: ['transacoes_lista_completa', mesSelecionado],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transacao_pessoal')
        .select('*')
        .like('data', `${mesSelecionado}%`)
        .order('data', { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const transacoesFiltradas = useMemo(() => {
    return transacoes.filter((t: any) => {
      const matchBusca = (t.descricao || '').toLowerCase().includes(busca.toLowerCase());
      
      let matchConta = true;
      if (filtros.conta) {
        if (filtros.conta.startsWith('conta_')) {
          matchConta = t.conta_id === filtros.conta.replace('conta_', '');
        } else if (filtros.conta.startsWith('cartao_')) {
          matchConta = t.cartao_id === filtros.conta.replace('cartao_', '');
        }
      }

      const matchTipo = filtros.tipo ? t.tipo === filtros.tipo : true;
      const matchSit = filtros.situacao ? t.situacao === filtros.situacao : true;

      return matchBusca && matchConta && matchTipo && matchSit;
    });
  }, [transacoes, busca, filtros]);

  // Totalizadores
  const { totalReceitas, totalDespesas } = useMemo(() => {
    let rec = 0;
    let des = 0;
    transacoesFiltradas.forEach((t: any) => {
      const v = Math.abs(Number(t.valor) || 0);
      if (t.tipo === 'RECEITA') rec += v;
      else if (t.tipo === 'ESTORNO') des -= v;
      else des += v;
    });
    return { totalReceitas: rec, totalDespesas: des };
  }, [transacoesFiltradas]);

  const saldoFiltro = totalReceitas - totalDespesas;

  const deletarMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transacao_pessoal').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transacoes_lista_completa'] }); }
  });

  const getNomeContaOuCartao = (t: any) => {
    if (t.cartao_id) {
      const c = cartoes.find((x: any) => x.id === t.cartao_id);
      return c ? `💳 Cartão ${c.nome}` : 'Cartão não encontrado';
    }
    if (t.conta_id) {
      const c = contas.find((x: any) => x.id === t.conta_id);
      return c ? `🏦 ${c.nome_banco}` : 'Conta não encontrada';
    }
    return 'Não vinculado';
  };

  const getNomeCategoriaStr = (catId?: string, subId?: string) => {
    if (!catId) return 'A Classificar';
    const c = categorias.find((x: any) => x.id === catId);
    const s = subcategorias.find((x: any) => x.id === subId);
    if (c && s) return `${c.nome} / ${s.nome}`;
    if (c) return c.nome;
    return 'A Classificar';
  };

  const getCentroCustoCat = (catId?: string) => {
    const c = categorias.find((x: any) => x.id === catId);
    return c?.centro_custo_projeto?.nome || '';
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-6 animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
          <p className="text-zinc-400 text-xs mt-0.5">Gestão de fluxo de caixa direto e movimentações.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar transação..." className="w-full bg-[#1e1e24] border border-white/5 rounded-lg py-2 pl-9 pr-4 text-sm focus:border-[#10b981] focus:outline-none transition-colors" />
          </div>

          <div className="flex items-center bg-[#1e1e24] border border-white/5 rounded-lg px-3 py-1.5 hover:border-white/20 transition-colors">
            <Calendar className="w-4 h-4 text-zinc-400 mr-2" />
            <input type="month" value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} className="bg-transparent text-sm text-white focus:outline-none [color-scheme:dark] cursor-pointer h-7" />
          </div>

          <Button variant="outline" onClick={() => setModalFiltrosAberto(true)} className="border-white/5 bg-[#1e1e24] hover:bg-white/5 text-zinc-300 relative">
            <Filter className="w-4 h-4 mr-2" /> Filtros
            {(filtros.conta || filtros.situacao || filtros.tipo) && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#10b981] rounded-full border-2 border-[#141417]"></span>}
          </Button>

          <Button className="bg-[#10b981] hover:bg-[#059669] text-black font-bold">
            <Plus className="w-4 h-4 mr-2" /> Nova
          </Button>
        </div>
      </div>

      {/* CARDS TOTALIZADORES DOS FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Receitas Encontradas</p><p className="text-xl font-bold text-[#10b981]">R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#10b981]/10 flex items-center justify-center"><TrendingUp className="w-4 h-4 text-[#10b981]" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Despesas Encontradas</p><p className="text-xl font-bold text-[#ef4444]">R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#ef4444]/10 flex items-center justify-center"><TrendingDown className="w-4 h-4 text-[#ef4444]" /></div>
          </div>
        </div>
        <div className="bg-[#1e1e24] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors">
          <div className="flex justify-between items-start">
            <div><p className="text-zinc-400 text-xs font-medium mb-1">Saldo da Pesquisa</p><p className="text-xl font-bold text-white">R$ {saldoFiltro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            <div className="h-8 w-8 rounded-full bg-[#3b82f6]/10 flex items-center justify-center"><Wallet className="w-4 h-4 text-[#3b82f6]" /></div>
          </div>
        </div>
      </div>

      <div className="bg-[#1e1e24] border border-white/5 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-zinc-400 font-bold uppercase bg-black/20 border-b border-white/5">
              <tr>
                <th className="px-6 py-4">Data Compra</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Conta / Cartão</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4 text-right">Valor</th>
                <th className="px-6 py-4 text-center">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">Carregando transações...</td></tr>
              ) : transacoesFiltradas.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">Nenhuma transação encontrada.</td></tr>
              ) : (
                transacoesFiltradas.map((t: any) => {
                  const ccNome = getCentroCustoCat(t.categoria_id);
                  const isPositivo = t.tipo === 'RECEITA' || t.tipo === 'ESTORNO';
                  
                  return (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-400 text-xs font-medium">
                        {new Date(t.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white truncate max-w-[200px]">{t.descricao}</div>
                        {t.recorrente && <span className="text-[9px] font-bold bg-[#3b82f6]/10 text-[#3b82f6] px-1.5 py-0.5 rounded border border-[#3b82f6]/20 mt-1 inline-block">RECORRENTE</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-zinc-300 text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-md truncate max-w-[180px]">{getNomeCategoriaStr(t.categoria_id, t.subcategoria_id)}</span>
                          {ccNome && <span className="text-[9px] font-bold text-[#10b981] uppercase tracking-wider mt-1 ml-0.5">{ccNome}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-400 text-xs whitespace-nowrap">{getNomeContaOuCartao(t)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn("text-[10px] font-bold flex items-center gap-1.5", isPositivo ? "text-[#10b981]" : "text-[#e74c3c]")}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", isPositivo ? "bg-[#10b981]" : "bg-[#e74c3c]")}></span>
                          {t.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className={cn("font-bold", isPositivo ? "text-[#10b981]" : "text-white")}>
                          {isPositivo ? '+' : '-'} R$ {Math.abs(Number(t.valor)).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn("text-[9px] font-bold px-2 py-1 rounded border", t.situacao === 'PAGO' ? "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20")}>
                          {t.situacao}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalFiltrosAberto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1a1a20] rounded-2xl border border-white/10 shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#22222a]">
              <h3 className="font-bold text-white flex items-center gap-2"><Filter className="w-4 h-4 text-[#10b981]" /> Filtros</h3>
              <button onClick={() => setModalFiltrosAberto(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1.5">Conta / Cartão</label>
                <select value={filtros.conta} onChange={e => setFiltros({...filtros, conta: e.target.value})} className="w-full bg-[#141417] border border-white/10 rounded-lg p-2 text-sm text-white focus:border-[#10b981] focus:outline-none">
                  <option value="">Todas</option>
                  <optgroup label="Contas">
                    {contas.map((c: any) => <option key={c.id} value={`conta_${c.id}`}>{c.nome_banco}</option>)}
                  </optgroup>
                  <optgroup label="Cartões">
                    {cartoes.map((c: any) => <option key={c.id} value={`cartao_${c.id}`}>{c.nome}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1.5">Tipo</label>
                <select value={filtros.tipo} onChange={e => setFiltros({...filtros, tipo: e.target.value})} className="w-full bg-[#141417] border border-white/10 rounded-lg p-2 text-sm text-white focus:border-[#10b981] focus:outline-none">
                  <option value="">Todos</option>
                  <option value="RECEITA">Receita</option>
                  <option value="DESPESA">Despesa</option>
                  <option value="ESTORNO">Estorno</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1.5">Situação</label>
                <select value={filtros.situacao} onChange={e => setFiltros({...filtros, situacao: e.target.value})} className="w-full bg-[#141417] border border-white/10 rounded-lg p-2 text-sm text-white focus:border-[#10b981] focus:outline-none">
                  <option value="">Todas</option>
                  <option value="PAGO">Pago</option>
                  <option value="PENDENTE">Pendente</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-white/5 flex gap-2">
              <Button variant="ghost" onClick={() => { setFiltros({conta: '', tipo: '', situacao: ''}); setModalFiltrosAberto(false); }} className="flex-1 text-zinc-400 hover:text-white">Limpar</Button>
              <Button onClick={() => setModalFiltrosAberto(false)} className="flex-1 bg-[#10b981] hover:bg-[#059669] text-black font-bold">Aplicar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
