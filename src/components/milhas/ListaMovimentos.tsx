// Histórico de movimentos com filtros, busca, totais, editar, apagar e exportar.
// Usado no Estoque (todas as carteiras) e no histórico de uma carteira.
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Edit2, Trash2, Search, X } from 'lucide-react';
import { cn, hojeLocal } from '@/lib/utils';
import {
  db, buscarProgramas, buscarContas, buscarTitulares, buscarMovimentos, buscarContatos, ehEntrada, NOME_TIPO,
  milhasFmt, brl, dataBR, milheiro, lerNumero, erroAmigavel, Movimento, TIPOS_ENTRADA, TIPOS_SAIDA,
} from '@/lib/milhas';
import { Campo, BotaoRoxo, Cartao, Janela, Vazio, Indicador, inputCls } from '@/components/milhas/ui';
import { normalizarBusca } from '@/pages/milhas/util';

type Sentido = 'TODOS' | 'ENTRADAS' | 'SAIDAS';

export default function ListaMovimentos({ contaId }: { contaId?: string }) {
  const qc = useQueryClient();
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const titulares = useQuery({ queryKey: ['milhas_titulares'], queryFn: buscarTitulares });
  const contatos = useQuery({ queryKey: ['milhas_contatos'], queryFn: buscarContatos });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const hoje = hojeLocal();

  const [titular, setTitular] = useState('');
  const [programa, setPrograma] = useState('');
  const [sentido, setSentido] = useState<Sentido>('TODOS');
  const [tipo, setTipo] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [busca, setBusca] = useState('');
  const [programados, setProgramados] = useState(false);
  const [editando, setEditando] = useState<any>(null);

  const contaPorId = useMemo(() => new Map((contas.data || []).map(c => [c.id, c])), [contas.data]);
  const nomeProg = (id?: string) => programas.data?.find(p => p.id === id)?.nome || '?';
  const nomeConta = (id: string) => { const c = contaPorId.get(id); return c ? `${c.titular} – ${nomeProg(c.programa_id)}` : '?'; };
  const nomeContato = (id: string | null) => (id && contatos.data?.find(c => c.id === id)?.nome) || '';

  // Saldo depois de cada movimento (por carteira), na ordem das datas.
  const saldoApos = useMemo(() => {
    const mapa = new Map<string, number>(), acum = new Map<string, number>();
    for (const m of movs.data || []) {
      if (m.data > hoje) continue;
      const s = (acum.get(m.conta_id) || 0) + (ehEntrada(m.tipo) ? 1 : -1) * Number(m.quantidade);
      acum.set(m.conta_id, s); mapa.set(m.id, s);
    }
    return mapa;
  }, [movs.data, hoje]);

  const lista = useMemo(() => (movs.data || []).filter(m => {
    const c = contaPorId.get(m.conta_id);
    if (contaId && m.conta_id !== contaId) return false;
    if (!contaId && titular && c?.titular_id !== titular) return false;
    if (!contaId && programa && c?.programa_id !== programa) return false;
    if (sentido === 'ENTRADAS' && !ehEntrada(m.tipo)) return false;
    if (sentido === 'SAIDAS' && ehEntrada(m.tipo)) return false;
    if (tipo && m.tipo !== tipo) return false;
    if (de && m.data < de) return false;
    if (ate && m.data > ate) return false;
    if (!programados && m.data > hoje) return false;
    if (busca && !normalizarBusca(`${m.observacao || ''} ${NOME_TIPO[m.tipo]} ${nomeContato(m.contato_id)}`).includes(normalizarBusca(busca))) return false;
    return true;
  }).reverse(), [movs.data, contaPorId, contaId, titular, programa, sentido, tipo, de, ate, busca, programados, hoje]);

  const entradas = lista.filter(m => ehEntrada(m.tipo)), saidas = lista.filter(m => !ehEntrada(m.tipo));
  const soma = (l: Movimento[], k: 'quantidade' | 'custo') => l.reduce((a, m) => a + Number(m[k]), 0);
  const temFiltro = titular || programa || sentido !== 'TODOS' || tipo || de || ate || busca || programados;
  const limpar = () => { setTitular(''); setPrograma(''); setSentido('TODOS'); setTipo(''); setDe(''); setAte(''); setBusca(''); setProgramados(false); };
  const recarregar = () => ['milhas_movimentos', 'milhas_parcelas', 'milhas_passageiros'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));

  const apagar = async (m: Movimento) => {
    if (m.venda_id) { toast.error('Este movimento é de uma venda. Apague a venda na tela Vendas.'); return; }
    const aviso = m.transferencia_id ? 'Apagar a transferência inteira (a saída e a entrada)?'
      : m.clube_id ? 'Apagar este crédito do clube? (os outros meses continuam)'
      : m.forma_pagamento === 'PARCELADO' || m.forma_pagamento === 'CARTAO' ? 'Apagar esta compra? As parcelas dela também serão apagadas.'
      : `Apagar este lançamento de ${milhasFmt(m.quantidade)} milhas?`;
    if (!window.confirm(aviso)) return;
    const q = db.from('milhas_movimento').delete();
    const { error } = m.transferencia_id ? await q.eq('transferencia_id', m.transferencia_id) : await q.eq('id', m.id);
    if (error) toast.error(erroAmigavel(error)); else { toast.success('Apagado.'); recarregar(); }
  };

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    const m: Movimento = editando.original;
    const entra = ehEntrada(m.tipo);
    const mudanca: any = { data: editando.data, observacao: editando.observacao.trim() || null };
    if (!m.venda_id) mudanca.quantidade = lerNumero(editando.quantidade);
    if (entra) { mudanca.custo = lerNumero(editando.custo); mudanca.validade = editando.validade || null; }
    if (mudanca.quantidade !== undefined && mudanca.quantidade <= 0) return toast.error('Quantidade inválida.');
    const { error } = await db.from('milhas_movimento').update(mudanca).eq('id', m.id);
    if (error) { toast.error(erroAmigavel(error)); return; }
    // Transferência: a data e a observação valem para as duas pontas.
    if (m.transferencia_id) await db.from('milhas_movimento').update({ data: mudanca.data, observacao: mudanca.observacao }).eq('transferencia_id', m.transferencia_id);
    toast.success('Alterado.'); setEditando(null); recarregar();
  };

  const exportar = () => {
    const cab = ['Data', 'Titular', 'Programa', 'Tipo', 'Milhas', 'Custo (R$)', 'Milheiro (R$)', 'Validade', 'Observação'];
    const linhas = lista.map(m => {
      const c = contaPorId.get(m.conta_id);
      const q = (ehEntrada(m.tipo) ? 1 : -1) * Number(m.quantidade);
      return [dataBR(m.data), c?.titular || '', nomeProg(c?.programa_id), NOME_TIPO[m.tipo] || m.tipo, String(q),
        Number(m.custo).toFixed(2).replace('.', ','), milheiro(Number(m.custo), Number(m.quantidade)).toFixed(2).replace('.', ','),
        m.validade ? dataBR(m.validade) : '', (m.observacao || '').replace(/;/g, ',')];
    });
    const csv = '﻿' + [cab, ...linhas].map(l => l.join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `milhas_movimentos_${hoje}.csv`; a.click();
  };

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <Cartao className="space-y-2 p-3">
        {!contaId && <div className="grid grid-cols-2 gap-2">
          <select className={inputCls} value={titular} onChange={e => setTitular(e.target.value)}><option value="">Todos os titulares</option>{(titulares.data || []).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
          <select className={inputCls} value={programa} onChange={e => setPrograma(e.target.value)}><option value="">Todos os programas</option>{(programas.data || []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        </div>}
        <div className="flex gap-1 bg-black/20 p-1 rounded-xl">
          {([['TODOS', 'Todos'], ['ENTRADAS', 'Entradas'], ['SAIDAS', 'Saídas']] as [Sentido, string][]).map(([v, r]) => (
            <button key={v} onClick={() => { setSentido(v); setTipo(''); }} className={cn('flex-1 py-1.5 rounded-lg text-xs font-bold', sentido === v ? 'bg-violet-500 text-white' : 'text-zinc-400')}>{r}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select className={inputCls + ' col-span-2 sm:col-span-1'} value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            {[...(sentido !== 'SAIDAS' ? TIPOS_ENTRADA : []), ...(sentido !== 'ENTRADAS' ? TIPOS_SAIDA : [])].map(t => <option key={t} value={t}>{NOME_TIPO[t]}</option>)}
          </select>
          <input type="date" className={inputCls} value={de} onChange={e => setDe(e.target.value)} title="De" />
          <input type="date" className={inputCls} value={ate} onChange={e => setAte(e.target.value)} title="Até" />
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input className={inputCls + ' pl-9'} placeholder="Buscar" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs text-zinc-400 flex items-center gap-2"><input type="checkbox" className="accent-violet-500 w-4 h-4" checked={programados} onChange={e => setProgramados(e.target.checked)} /> mostrar créditos programados (clube)</label>
          {temFiltro && <button onClick={limpar} className="text-xs text-violet-300 flex items-center gap-1"><X className="w-3.5 h-3.5" /> limpar filtros</button>}
          <button onClick={exportar} disabled={lista.length === 0} className="ml-auto text-xs font-bold text-zinc-300 flex items-center gap-1 px-3 py-2 rounded-lg border border-white/10 disabled:opacity-40"><Download className="w-3.5 h-3.5" /> Exportar</button>
        </div>
      </Cartao>

      {/* Totais do que está filtrado */}
      <div className="grid grid-cols-3 gap-2">
        <Indicador titulo="Entradas" valor={`+${milhasFmt(soma(entradas, 'quantidade'))}`} sub={brl(soma(entradas, 'custo'))} />
        <Indicador titulo="Saídas" valor={`−${milhasFmt(soma(saidas, 'quantidade'))}`} sub={brl(soma(saidas, 'custo'))} />
        <Indicador titulo="Lançamentos" valor={String(lista.length)} destaque />
      </div>

      {/* Lista */}
      {movs.isLoading ? <p className="text-sm text-zinc-400">Carregando...</p> : lista.length === 0 ? <Vazio>Nenhum lançamento com esses filtros.</Vazio> : (
        <Cartao className="p-0 divide-y divide-white/5">
          {lista.slice(0, 500).map(m => {
            const entra = ehEntrada(m.tipo), futuro = m.data > hoje;
            return (
              <div key={m.id} className={cn('flex items-center gap-2 px-4 py-3', futuro && 'opacity-60')}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{NOME_TIPO[m.tipo] || m.tipo}{futuro && <span className="text-[10px] text-violet-300 font-bold"> · PROGRAMADO</span>}{m.clube_id && m.confirmado_em && <span className="text-[10px] text-emerald-400 font-bold"> · CONFERIDO NO EXTRATO</span>}</p>
                  <p className="text-[11px] text-zinc-500 truncate">
                    {dataBR(m.data)}{!contaId && ` · ${nomeConta(m.conta_id)}`}{Number(m.custo) > 0 && ` · ${brl(m.custo)} (${brl(milheiro(Number(m.custo), Number(m.quantidade)))}/mil)`}
                    {m.validade && ` · vence ${dataBR(m.validade)}`}{nomeContato(m.contato_id) && ` · ${nomeContato(m.contato_id)}`}{m.observacao && ` · ${m.observacao}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn('text-sm font-bold whitespace-nowrap', entra ? 'text-violet-300' : 'text-zinc-300')}>{entra ? '+' : '−'}{milhasFmt(m.quantidade)}</p>
                  {saldoApos.has(m.id) && <p className="text-[10px] text-zinc-500 whitespace-nowrap">saldo {milhasFmt(saldoApos.get(m.id)!)}</p>}
                </div>
                <button onClick={() => setEditando({ original: m, data: m.data, quantidade: String(m.quantidade), custo: String(m.custo).replace('.', ','), validade: m.validade || '', observacao: m.observacao || '' })} className="p-2 text-zinc-500 hover:text-white" title="Editar"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => apagar(m)} className="p-2 -mr-2 text-zinc-500 hover:text-red-400" title="Apagar"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
          {lista.length > 500 && <p className="px-4 py-3 text-xs text-zinc-500">Mostrando os 500 mais recentes. Use os filtros ou exporte para ver tudo.</p>}
        </Cartao>
      )}

      <Janela titulo="Editar lançamento" aberta={!!editando} onFechar={() => setEditando(null)}>
        {editando && <form onSubmit={salvarEdicao} className="space-y-4">
          <p className="text-sm text-zinc-300">{NOME_TIPO[editando.original.tipo]} · {nomeConta(editando.original.conta_id)}</p>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Data"><input type="date" required className={inputCls} value={editando.data} onChange={e => setEditando({ ...editando, data: e.target.value })} /></Campo>
            {!editando.original.venda_id && <Campo rotulo="Milhas"><input inputMode="numeric" className={inputCls} value={editando.quantidade} onChange={e => setEditando({ ...editando, quantidade: e.target.value })} /></Campo>}
            {ehEntrada(editando.original.tipo) && <>
              <Campo rotulo="Custo (R$)"><input inputMode="decimal" className={inputCls} value={editando.custo} onChange={e => setEditando({ ...editando, custo: e.target.value })} /></Campo>
              <Campo rotulo="Vencem em"><input type="date" className={inputCls} value={editando.validade} onChange={e => setEditando({ ...editando, validade: e.target.value })} /></Campo>
            </>}
          </div>
          <Campo rotulo="Observação"><input className={inputCls} value={editando.observacao} onChange={e => setEditando({ ...editando, observacao: e.target.value })} /></Campo>
          {editando.original.venda_id && <p className="text-[11px] text-zinc-500">Milhas de venda se alteram na tela Vendas.</p>}
          {!ehEntrada(editando.original.tipo) && <p className="text-[11px] text-zinc-500">O custo de uma saída é o custo médio da data em que foi lançada.</p>}
          {editando.original.transferencia_id && <p className="text-[11px] text-zinc-500">Transferência: a data e a observação mudam nas duas pontas; as milhas, só nesta.</p>}
          <BotaoRoxo type="submit" className="w-full">Salvar</BotaoRoxo>
        </form>}
      </Janela>
    </div>
  );
}
