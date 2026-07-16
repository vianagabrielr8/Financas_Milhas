import { useState } from 'react';
import { Landmark, ArrowUpCircle, ArrowDownCircle, Filter, MoreVertical, CreditCard, X, Calendar, Tags, FolderTree, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const mockTransacoes = [
  { id: 1, data: '2026-07-06', descricao: 'LATAM PASS BLACK', tipo: 'DESPESA', valor: 6927.37, situacao: 'PENDENTE', categoria: 'Repasses a Terceiros', centroCusto: 'Terceiros / Reembolsos', contaCartao: 'Latam Pass Black (Cartão)' },
  { id: 2, data: '2026-07-20', descricao: 'PERSONALITTE BLACK', tipo: 'DESPESA', valor: 3187.21, situacao: 'PENDENTE', categoria: 'Pessoal - Gabriel', centroCusto: 'Familiar', contaCartao: 'Itaú Personalitté (Conta)' },
  { id: 3, data: '2026-07-12', descricao: 'HABITAÇÃO CAIXA', tipo: 'DESPESA', valor: 3200.00, situacao: 'PENDENTE', categoria: 'Moradia', centroCusto: 'Familiar', contaCartao: 'Itaú Personalitté (Conta)' },
  { id: 4, data: '2026-07-12', descricao: 'BV FINANCEIRA', tipo: 'DESPESA', valor: 850.00, situacao: 'PENDENTE', categoria: 'Serviços Bancários', centroCusto: 'Familiar', contaCartao: 'Itaú Personalitté (Conta)' },
  { id: 5, data: '2026-07-14', descricao: 'Repasse Reembolso Synthia', tipo: 'RECEITA', valor: 1200.00, situacao: 'PAGO', categoria: 'Repasses a Terceiros', centroCusto: 'Terceiros / Reembolsos', contaCartao: 'C6 Bank (Conta)' }
];

export default function Transacoes() {
  const [modalAberto, setModalAberto] = useState(false);
  const [drawerFiltroAberto, setDrawerFiltroAberto] = useState(false);
  const [tipo, setTipo] = useState('DESPESA');

  // Estados dos Filtros
  const [filtroDataDe, setFiltroDataDe] = useState('2026-07-01');
  const [filtroDataAte, setFiltroDataAte] = useState('2026-07-31');
  const [filtroCategoria, setFiltroCategoria] = useState('Todas');
  const [filtroConta, setFiltroConta] = useState('Todas');
  const [filtroCC, setFiltroCC] = useState('Todas');
  const [filtroSituacao, setFiltroSituacao] = useState('Todas');

  const [transacoesFiltradas, setTransacoesFiltradas] = useState(mockTransacoes);

  const aplicarFiltros = () => {
    let resultado = mockTransacoes.filter(t => {
      const dataValida = t.data >= filtroDataDe && t.data <= filtroDataAte;
      const categoriaValida = filtroCategoria === 'Todas' || t.categoria === filtroCategoria;
      const contaValida = filtroConta === 'Todas' || t.contaCartao.includes(filtroConta);
      const ccValido = filtroCC === 'Todas' || t.centroCusto === filtroCC;
      const situacaoValida = filtroSituacao === 'Todas' || t.situacao === filtroSituacao;
      return dataValida && categoriaValida && contaValida && ccValido && situacaoValida;
    });
    setTransacoesFiltradas(resultado);
    setDrawerFiltroAberto(false);
  };

  const limparFiltros = () => {
    setFiltroDataDe('2026-07-01');
    setFiltroDataAte('2026-07-31');
    setFiltroCategoria('Todas');
    setFiltroConta('Todas');
    setFiltroCC('Todas');
    setFiltroSituacao('Todas');
    setTransacoesFiltradas(mockTransacoes);
    setDrawerFiltroAberto(false);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-4 md:p-0 pb-24 relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Transações Gerais</h1>
          <p className="text-xs text-zinc-400 mt-1">Gerencie, filtre e controle todas as entradas e saídas.</p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-3">
          <Button onClick={() => setDrawerFiltroAberto(true)} variant="outline" className="flex-1 md:flex-none border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 rounded-full font-medium flex items-center justify-center gap-2 text-xs h-10 px-4">
            <Filter className="w-4 h-4 text-[#6c5ce7]" /> Filtrar
          </Button>
          <Button onClick={() => setModalAberto(true)} className="flex-1 md:flex-none bg-[#6c5ce7] hover:bg-[#5b4bc4] text-white rounded-full font-semibold text-xs h-10">+ Nova</Button>
        </div>
      </div>

      {/* METRICAS */}
      <div className="flex overflow-x-auto pb-2 md:grid md:grid-cols-3 gap-4 snap-x">
        <div className="snap-center shrink-0 w-[260px] md:w-auto bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div><p className="text-zinc-400 text-sm font-medium mb-1">Saldo do Filtro</p><p className="text-xl md:text-2xl font-bold text-white">R$ {transacoesFiltradas.reduce((acc, t) => t.tipo === 'RECEITA' ? acc + t.valor : acc - t.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
          <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-[#3498db]/10 flex items-center justify-center"><Landmark className="w-5 h-5 text-[#3498db]" /></div>
        </div>
        <div className="snap-center shrink-0 w-[260px] md:w-auto bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div><p className="text-zinc-400 text-sm font-medium mb-1">Receitas do Filtro</p><p className="text-xl md:text-2xl font-bold text-[#2ecc71]">R$ {transacoesFiltradas.filter(t => t.tipo === 'RECEITA').reduce((acc, t) => acc + t.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
          <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-[#2ecc71]/10 flex items-center justify-center"><ArrowUpCircle className="w-5 h-5 text-[#2ecc71]" /></div>
        </div>
        <div className="snap-center shrink-0 w-[260px] md:w-auto bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div><p className="text-zinc-400 text-sm font-medium mb-1">Despesas do Filtro</p><p className="text-xl md:text-2xl font-bold text-[#e74c3c]">R$ {transacoesFiltradas.filter(t => t.tipo === 'DESPESA').reduce((acc, t) => acc + t.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
          <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-[#e74c3c]/10 flex items-center justify-center"><ArrowDownCircle className="w-5 h-5 text-[#e74c3c]" /></div>
        </div>
      </div>

      {/* 1. VISÃO MOBILE (Cards Empilhados) */}
      <div className="md:hidden space-y-3">
        {transacoesFiltradas.map((t) => (
          <div key={t.id} className="bg-[#1e1e24] border border-white/5 p-4 rounded-xl flex justify-between items-center gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={cn("w-10 h-10 rounded-full flex shrink-0 items-center justify-center border", t.tipo === 'RECEITA' ? 'bg-[#2ecc71]/10 border-[#2ecc71]/20' : 'bg-[#e74c3c]/10 border-[#e74c3c]/20')}>
                {t.contaCartao.includes('Cartão') ? <CreditCard className={cn("w-4 h-4", t.tipo === 'RECEITA' ? 'text-[#2ecc71]' : 'text-[#e74c3c]')} /> : <Landmark className={cn("w-4 h-4", t.tipo === 'RECEITA' ? 'text-[#2ecc71]' : 'text-[#e74c3c]')} />}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-semibold text-white text-sm truncate">{t.descricao}</span>
                <span className="text-xs text-zinc-400 truncate">{t.categoria} • {new Date(t.data).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className={cn("font-bold text-sm", t.tipo === 'DESPESA' ? 'text-[#e74c3c]' : 'text-[#2ecc71]')}>
                {t.tipo === 'DESPESA' ? '-' : '+'}R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              {t.situacao === 'PENDENTE' ? (
                <span className="text-[9px] text-amber-500 font-bold flex items-center gap-1 mt-0.5"><AlertCircle className="w-3 h-3" /> PEND.</span>
              ) : (
                <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-1 mt-0.5"><CheckCircle2 className="w-3 h-3" /> PAGO</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 2. VISÃO DESKTOP (Tabela) */}
      <div className="hidden md:block bg-[#1e1e24] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 font-semibold border-b border-white/5 bg-black/10">
              <tr>
                <th className="px-6 py-4">Situação</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Descrição</th>
                <th className="px-6 py-4">Categoria / C. Custo</th>
                <th className="px-6 py-4">Conta / Cartão</th>
                <th className="px-6 py-4 text-right">Valor</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transacoesFiltradas.map((t) => (
                <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    {t.situacao === 'PENDENTE' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-full font-bold"><AlertCircle className="w-3 h-3" /> PENDENTE</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-full font-bold"><CheckCircle2 className="w-3 h-3" /> PAGO</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-300">{new Date(t.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-4 font-medium text-zinc-100">{t.descricao}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-zinc-200">{t.categoria}</span>
                      <span className="text-[10px] text-[#6c5ce7] font-semibold uppercase">{t.centroCusto}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-300">
                    <span className="flex items-center gap-1.5 text-xs">
                      {t.contaCartao.includes('Cartão') ? <CreditCard className="w-3.5 h-3.5 text-indigo-400" /> : <Landmark className="w-3.5 h-3.5 text-blue-400" />}
                      {t.contaCartao}
                    </span>
                  </td>
                  <td className={cn("px-6 py-4 text-right font-bold", t.tipo === 'DESPESA' ? 'text-[#e74c3c]' : 'text-[#2ecc71]')}>
                    {t.tipo === 'DESPESA' ? '-' : '+'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-center"><Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white"><MoreVertical className="w-4 h-4" /></Button></td>
                </tr>
              ))}
              {transacoesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500 text-xs font-semibold">Nenhuma transação atende aos critérios do filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAWER LATERAL DE FILTROS */}
      {drawerFiltroAberto && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerFiltroAberto(false)} />
          <div className="relative w-full max-w-sm bg-[#16161a] border-l border-white/10 h-full flex flex-col p-6 shadow-2xl justify-between animate-in slide-in-from-right">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2"><Filter className="w-4 h-4 text-[#6c5ce7]" /> Filtro de transações</h2>
                <button onClick={() => setDrawerFiltroAberto(false)} className="text-zinc-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-4 overflow-y-auto max-h-[75vh] pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">De</label>
                    <Input type="date" value={filtroDataDe} onChange={(e) => setFiltroDataDe(e.target.value)} className="bg-zinc-900 border-white/10 text-white text-xs h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Até</label>
                    <Input type="date" value={filtroDataAte} onChange={(e) => setFiltroDataAte(e.target.value)} className="bg-zinc-900 border-white/10 text-white text-xs h-9" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1"><Tags className="w-3.5 h-3.5" /> Categorias</label>
                  <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="w-full h-9 rounded-md bg-zinc-900 border border-white/10 px-3 text-xs text-white">
                    <option value="Todas">Todas as categorias</option>
                    <option value="Moradia">Moradia</option>
                    <option value="Alimentação">Alimentação</option>
                    <option value="Pessoal - Gabriel">Pessoal - Gabriel</option>
                    <option value="Repasses a Terceiros">Repasses a Terceiros</option>
                    <option value="Serviços Bancários">Serviços Bancários</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1"><Landmark className="w-3.5 h-3.5" /> Contas & Cartões</label>
                  <select value={filtroConta} onChange={(e) => setFiltroConta(e.target.value)} className="w-full h-9 rounded-md bg-zinc-900 border border-white/10 px-3 text-xs text-white">
                    <option value="Todas">Todas as contas</option>
                    <option value="Personalitté">Itaú Personalitté</option>
                    <option value="C6 Bank">C6 Bank</option>
                    <option value="Latam Pass">Latam Pass Black</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1"><FolderTree className="w-3.5 h-3.5" /> Centros de Custo</label>
                  <select value={filtroCC} onChange={(e) => setFiltroCC(e.target.value)} className="w-full h-9 rounded-md bg-zinc-900 border border-white/10 px-3 text-xs text-white">
                    <option value="Todas">Todos os Centros de Custo</option>
                    <option value="Familiar">Familiar</option>
                    <option value="Terceiros / Reembolsos">Terceiros / Reembolsos</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Situações</label>
                  <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)} className="w-full h-9 rounded-md bg-zinc-900 border border-white/10 px-3 text-xs text-white">
                    <option value="Todas">Todas as situações</option>
                    <option value="PAGO">Pago / Recebido</option>
                    <option value="PENDENTE">Pendente</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-3">
              <Button onClick={limparFiltros} variant="ghost" className="flex-1 text-xs text-zinc-400 hover:text-white">LIMPAR</Button>
              <Button onClick={aplicarFiltros} className="flex-1 bg-[#6c5ce7] hover:bg-[#5b4bc4] text-white text-xs font-semibold">APLICAR FILTROS</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}