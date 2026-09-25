import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { cn, hojeLocal } from '@/lib/utils';
import { db, buscarProgramas, buscarContas, buscarMovimentos, situacaoDaConta, ehEntrada, NOME_TIPO, milhasFmt, brl, dataBR, erroAmigavel, Movimento } from '@/lib/milhas';
import { Cartao, Indicador, Vazio } from '@/components/milhas/ui';

export default function ContaHistorico() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const movs = useQuery({ queryKey: ['milhas_movimentos', id], queryFn: () => buscarMovimentos(id) });

  const conta = contas.data?.find(c => c.id === id);
  const hoje = hojeLocal();
  const s = useMemo(() => situacaoDaConta(movs.data || []), [movs.data]);
  const lista = [...(movs.data || [])].reverse(); // mais recentes primeiro

  const apagar = async (m: Movimento) => {
    if (m.venda_id) { toast.error('Este movimento é de uma venda. Apague a venda na tela Vendas.'); return; }
    const aviso = m.transferencia_id ? 'Apagar a transferência inteira (a saída e a entrada)?'
      : m.forma_pagamento === 'PARCELADO' ? 'Apagar esta compra? As parcelas a pagar dela também serão apagadas.'
      : `Apagar este lançamento de ${milhasFmt(m.quantidade)} milhas?`;
    if (!window.confirm(aviso)) return;
    const q = db.from('milhas_movimento').delete();
    const { error } = m.transferencia_id ? await q.eq('transferencia_id', m.transferencia_id) : await q.eq('id', m.id);
    if (error) { toast.error(erroAmigavel(error)); return; }
    toast.success('Apagado.');
    qc.invalidateQueries({ queryKey: ['milhas_movimentos'] });
    qc.invalidateQueries({ queryKey: ['milhas_parcelas'] });
  };

  if (!conta) return <p className="text-zinc-400 text-sm">{contas.isLoading ? 'Carregando...' : 'Conta não encontrada.'}</p>;
  const nomeProg = programas.data?.find(p => p.id === conta.programa_id)?.nome || '';

  return (
    <div className="space-y-4 max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-3">
        <Link to="/milhas/estoque" className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></Link>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase text-violet-300">{nomeProg}</p>
          <p className="font-bold text-lg truncate">{conta.titular}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Indicador titulo="Saldo" valor={milhasFmt(s.saldo)} destaque />
        <Indicador titulo="Milheiro" valor={brl(s.milheiro)} />
        <Indicador titulo="Investido" valor={brl(s.custo)} />
      </div>
      <Cartao className="p-0">
        {lista.length === 0 ? <div className="p-4"><Vazio>Nenhum lançamento nesta conta.</Vazio></div> : (
          <div className="divide-y divide-white/5">
            {lista.map(m => {
              const entra = ehEntrada(m.tipo);
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{NOME_TIPO[m.tipo] || m.tipo}{m.data > hoje && <span className="text-[10px] text-violet-300 font-bold"> · PROGRAMADO</span>}</p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {dataBR(m.data)}{m.custo > 0 && ` · ${brl(m.custo)}`}{m.validade && ` · vence ${dataBR(m.validade)}`}{m.observacao && ` · ${m.observacao}`}
                    </p>
                  </div>
                  <span className={cn('text-sm font-bold whitespace-nowrap', entra ? 'text-violet-300' : 'text-zinc-300')}>
                    {entra ? '+' : '−'}{milhasFmt(m.quantidade)}
                  </span>
                  <button onClick={() => apagar(m)} className="p-2 -mr-2 text-zinc-500 hover:text-red-400" title="Apagar"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </Cartao>
    </div>
  );
}
