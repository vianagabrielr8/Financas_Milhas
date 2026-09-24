import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Trash2, Edit2, Plus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useFamilia } from '@/contexts/FamiliaContext';

export default function Cartoes() {
  const { podeEditar } = useFamilia();
  const [modalAberto, setModalAberto] = useState(false);
  const [cartaoEditandoId, setCartaoEditandoId] = useState<string | null>(null);
  
  const [nome, setNome] = useState('');
  const [limite, setLimite] = useState('');
  const [diaFechamento, setDiaFechamento] = useState('');
  const [diaVencimento, setDiaVencimento] = useState('');
  // Como o extrato/print deste cartão mostra compra parcelada (usado pelo bot):
  // PARCELA = mostra o valor de 1 parcela; TOTAL = mostra o valor total da compra.
  const [leituraParcela, setLeituraParcela] = useState<'PARCELA' | 'TOTAL'>('PARCELA');

  const { data: cartoes = [], isLoading, refetch } = useQuery({
    queryKey: ['cartoes_pessoais'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartao_pessoal').select('*').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  // Cartões adicionais (tabela cartao_vinculado): nome impresso + cartão titular.
  const { data: adicionais = [], refetch: refetchAdicionais } = useQuery({
    queryKey: ['cartoes_vinculados_todos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartao_vinculado' as any).select('id, cartao_pessoal_id, nome_impresso').order('nome_impresso');
      if (error) throw error;
      return (data || []) as any[];
    }
  });
  const adicionaisDo = (cartaoId: string) => adicionais.filter((a: any) => a.cartao_pessoal_id === cartaoId);
  const [novoAdicional, setNovoAdicional] = useState('');
  const [nomesEditados, setNomesEditados] = useState<Record<string, string>>({});

  // Adicionais salvam na hora (não dependem do botão "Salvar cartão").
  const adicionarAdicional = async () => {
    const nomeNovo = novoAdicional.trim();
    if (!cartaoEditandoId || !nomeNovo) return;
    const { error } = await supabase.from('cartao_vinculado' as any).insert([{ cartao_pessoal_id: cartaoEditandoId, nome_impresso: nomeNovo }]);
    if (error) { toast.error('Não consegui adicionar: ' + error.message); return; }
    setNovoAdicional('');
    toast.success(`Adicional "${nomeNovo}" criado.`);
    refetchAdicionais();
  };

  const renomearAdicional = async (id: string) => {
    const nomeNovo = (nomesEditados[id] ?? '').trim();
    if (!nomeNovo) return;
    const { error } = await supabase.from('cartao_vinculado' as any).update({ nome_impresso: nomeNovo }).eq('id', id);
    if (error) { toast.error('Não consegui renomear: ' + error.message); return; }
    setNomesEditados(n => { const c = { ...n }; delete c[id]; return c; });
    toast.success('Nome atualizado.');
    refetchAdicionais();
  };

  // Só apaga se não houver lançamento ligado ao adicional (para não deixar lançamento sem dono).
  const apagarAdicional = async (a: any) => {
    const { count, error: erroConta } = await supabase.from('transacao_pessoal').select('id', { count: 'exact', head: true }).eq('cartao_vinculado_id', a.id);
    if (erroConta) { toast.error('Não consegui conferir os lançamentos: ' + erroConta.message); return; }
    if ((count || 0) > 0) {
      toast.error(`"${a.nome_impresso}" tem ${count} lançamento(s). Não dá para apagar; se quiser, só renomeie.`);
      return;
    }
    if (!window.confirm(`Apagar o adicional "${a.nome_impresso}"?`)) return;
    const { error } = await supabase.from('cartao_vinculado' as any).delete().eq('id', a.id);
    if (error) { toast.error('Não consegui apagar: ' + error.message); return; }
    toast.success('Adicional apagado.');
    refetchAdicionais();
  };

  const abrirModalNovo = () => {
    setCartaoEditandoId(null);
    setNome('');
    setLimite('');
    setDiaFechamento('');
    setDiaVencimento('');
    setLeituraParcela('PARCELA');
    setModalAberto(true);
  };

  const abrirModalEdicao = (e: React.MouseEvent, cartao: any) => {
    e.preventDefault(); // Impede que o Link mude de página
    setCartaoEditandoId(cartao.id);
    setNome(cartao.nome);
    setLimite(cartao.limite?.toString() || '');
    setDiaFechamento(cartao.dia_fechamento?.toString() || '');
    setDiaVencimento(cartao.dia_vencimento?.toString() || '');
    setLeituraParcela(cartao.tipo_leitura_parcela === 'TOTAL' ? 'TOTAL' : 'PARCELA');
    setNovoAdicional('');
    setNomesEditados({});
    setModalAberto(true);
  };

  const handleSalvarCartao = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      nome,
      limite: Number(limite),
      dia_fechamento: Number(diaFechamento),
      dia_vencimento: Number(diaVencimento),
      tipo_leitura_parcela: leituraParcela
    };

    let erroOcorrido;

    if (cartaoEditandoId) {
      // MODO EDIÇÃO
      const { error } = await supabase.from('cartao_pessoal').update(payload).eq('id', cartaoEditandoId);
      erroOcorrido = error;
    } else {
      // MODO CRIAÇÃO
      const { error } = await supabase.from('cartao_pessoal').insert([payload]);
      erroOcorrido = error;
    }

    if (erroOcorrido) {
      alert('Erro ao salvar cartão: ' + erroOcorrido.message);
    } else {
      setModalAberto(false);
      refetch(); 
    }
  };

  const deletarCartao = async (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    if (!window.confirm('Tem certeza que deseja excluir este cartão? Todas as faturas vinculadas podem ser afetadas.')) return;
    
    await supabase.from('cartao_pessoal').delete().eq('id', id);
    refetch();
  };

  if (isLoading) return <div className="p-6 text-zinc-400">Carregando cartões...</div>;

  return (
    <div className="space-y-4 md:space-y-6 max-w-[1600px] mx-auto text-zinc-100 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold hidden md:flex items-center gap-2">
          <CreditCard className="text-[#10b981]" /> Cartões
        </h1>
        {podeEditar && (
          <Button onClick={abrirModalNovo} className="bg-[#10b981] hover:bg-[#059669] text-black font-bold flex items-center gap-2">
            <Plus size={18} /> Novo Cartão
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cartoes.map((cartao: any) => {
          const limiteTotal = Number(cartao.limite || 0);
          const consumido = 0; // O cálculo de consumo em tempo real será embutido no futuro.
          const limiteDisponivel = limiteTotal - consumido;
          const percentual = limiteTotal > 0 ? (consumido / limiteTotal) * 100 : 0;
          
          const melhorDia = cartao.dia_fechamento ? (cartao.dia_fechamento === 31 ? 1 : cartao.dia_fechamento + 1) : '--';

          return (
            <Link key={cartao.id} to={`/financas/cartoes/${cartao.id}`} className="block group">
              <Card className="bg-[#141417] p-6 border-white/5 group-hover:border-[#10b981] transition-all cursor-pointer h-full relative flex flex-col">
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Cartão de Crédito</span>
                  {podeEditar && <div className="flex gap-2 relative z-10">
                     <button onClick={(e) => abrirModalEdicao(e, cartao)} className="p-1 text-zinc-500 hover:text-white transition-colors"><Edit2 className="w-4 h-4" /></button>
                     <button onClick={(e) => deletarCartao(e, cartao.id)} className="p-1 text-zinc-500 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>}
                </div>
                
                <CardTitle className={adicionaisDo(cartao.id).length ? 'text-xl mb-2' : 'text-xl mb-6'}>{cartao.nome}</CardTitle>
                {adicionaisDo(cartao.id).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-5">
                    {adicionaisDo(cartao.id).map((a: any) => (
                      <span key={a.id} className="text-[10px] bg-white/5 border border-white/10 text-zinc-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CreditCard className="w-3 h-3" /> {a.nome_impresso}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="mt-auto space-y-3">
                  <div className="flex justify-between text-xs border-b border-white/5 pb-2">
                    <span className="text-zinc-400">Melhor dia de compra:</span>
                    <span className="text-white font-bold">{melhorDia}</span>
                  </div>
                  
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Limite disponível:</span>
                    <span className="text-[#10b981] font-bold">{limiteDisponivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  
                  <div className="flex justify-between text-xs pb-1">
                    <span className="text-zinc-400">Limite total:</span>
                    <span className="text-zinc-300">{limiteTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>

                  <div className="h-2 w-full bg-black rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-[#10b981] transition-all duration-500" style={{ width: `${percentual}%` }} />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}

        {cartoes.length === 0 && (
          <div className="col-span-full text-center p-10 border border-white/5 rounded-xl text-zinc-500">
            Nenhum cartão cadastrado. Clique no botão acima para adicionar.
          </div>
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a20] rounded-2xl w-full max-w-md border border-white/10 shadow-2xl overflow-y-auto max-h-[90dvh]">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center">
              <h2 className="text-xl text-white font-bold flex items-center gap-2">
                <CreditCard className="text-[#10b981]" size={20} /> {cartaoEditandoId ? 'Editar Cartão' : 'Cadastrar Cartão'}
              </h2>
              <button onClick={() => setModalAberto(false)} className="text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSalvarCartao} className="p-6 space-y-4">
              <div>
                <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Nome do Cartão (Ex: Latam Pass Black)</label>
                <input type="text" required value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all" />
              </div>
              
              <div>
                <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Limite (R$)</label>
                <input type="number" step="0.01" required value={limite} onChange={(e) => setLimite(e.target.value)} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Dia Fechamento</label>
                  <input type="number" min="1" max="31" required value={diaFechamento} onChange={(e) => setDiaFechamento(e.target.value)} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Dia Vencimento</label>
                  <input type="number" min="1" max="31" required value={diaVencimento} onChange={(e) => setDiaVencimento(e.target.value)} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all" />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">No print/extrato, compra parcelada aparece com</label>
                <select value={leituraParcela} onChange={(e) => setLeituraParcela(e.target.value as 'PARCELA' | 'TOTAL')} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all">
                  <option value="PARCELA">O valor de 1 parcela</option>
                  <option value="TOTAL">O valor total da compra</option>
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">O bot usa isso para dividir certo quando você manda o print e pede para parcelar.</p>
              </div>

              {/* CARTÕES ADICIONAIS: só aparece ao editar um cartão que já existe */}
              {cartaoEditandoId ? (
                <div className="border-t border-white/10 pt-4">
                  <p className="text-zinc-400 text-xs font-bold uppercase mb-1">Cartões adicionais</p>
                  <p className="text-[11px] text-zinc-500 mb-3">Aparecem no filtro da fatura e no bot ("Quem efetuou a compra?"). Salvam na hora.</p>
                  <div className="space-y-2">
                    {adicionaisDo(cartaoEditandoId).map((a: any) => {
                      const valor = nomesEditados[a.id] ?? a.nome_impresso;
                      const mudou = nomesEditados[a.id] !== undefined && nomesEditados[a.id].trim() !== a.nome_impresso;
                      return (
                        <div key={a.id} className="flex items-center gap-2">
                          <input value={valor} onChange={(e) => setNomesEditados(n => ({ ...n, [a.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); renomearAdicional(a.id); } }}
                            className="flex-1 min-w-0 bg-[#1e1e24] text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#10b981] focus:outline-none" />
                          {mudou && <button type="button" onClick={() => renomearAdicional(a.id)} title="Salvar nome" className="p-2 text-[#10b981] hover:bg-[#10b981]/10 rounded-lg"><Check className="w-4 h-4" /></button>}
                          <button type="button" onClick={() => apagarAdicional(a)} title="Apagar adicional" className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      );
                    })}
                    {adicionaisDo(cartaoEditandoId).length === 0 && <p className="text-xs text-zinc-500">Nenhum adicional neste cartão.</p>}
                    <div className="flex items-center gap-2 pt-1">
                      <input value={novoAdicional} onChange={(e) => setNovoAdicional(e.target.value)} placeholder="Nome do adicional (ex.: Ingrid Latam)"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarAdicional(); } }}
                        className="flex-1 min-w-0 bg-[#1e1e24] text-white border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-[#10b981] focus:outline-none" />
                      <button type="button" onClick={adicionarAdicional} disabled={!novoAdicional.trim()} className="px-3 py-2 rounded-lg text-sm font-bold bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981]/25 disabled:opacity-40 flex items-center gap-1 shrink-0">
                        <Plus className="w-4 h-4" /> Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 border-t border-white/10 pt-4">Depois de salvar, abra o cartão em ✏️ para cadastrar os cartões adicionais.</p>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setModalAberto(false)} className="px-6 py-2.5 text-sm text-zinc-400 font-bold hover:text-white transition-colors">CANCELAR</button>
                <button type="submit" className="bg-[#10b981] text-black hover:bg-[#059669] px-6 py-2.5 rounded-lg text-sm font-bold transition-all">SALVAR CARTÃO</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
