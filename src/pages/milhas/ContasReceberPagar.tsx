import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { cn, hojeLocal } from '@/lib/utils';
import { db, buscarParcelas, buscarContatos, brl, dataBR, erroAmigavel, Parcela } from '@/lib/milhas';
import { Pilulas, Cartao, Indicador, Vazio } from '@/components/milhas/ui';

type Aba = 'RECEBER' | 'PAGAR';

export default function ContasReceberPagar() {
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>('RECEBER');
  const [verPagas, setVerPagas] = useState(false);
  const parcelas = useQuery({ queryKey: ['milhas_parcelas'], queryFn: buscarParcelas });
  const contatos = useQuery({ queryKey: ['milhas_contatos'], queryFn: buscarContatos });
  const hoje = hojeLocal(), mes = hoje.slice(0, 7);
  const nomeContato = (id: string | null) => (id && contatos.data?.find(c => c.id === id)?.nome) || '';

  const grupos = useMemo(() => {
    const doTipo = (parcelas.data || []).filter(p => p.tipo === aba);
    const abertas = doTipo.filter(p => p.situacao === 'ABERTA');
    return {
      atrasadas: abertas.filter(p => p.vencimento < hoje),
      mes: abertas.filter(p => p.vencimento >= hoje && p.vencimento.startsWith(mes)),
      futuras: abertas.filter(p => p.vencimento.slice(0, 7) > mes),
      pagas: doTipo.filter(p => p.situacao === 'PAGA').sort((a, b) => (b.pago_em || '').localeCompare(a.pago_em || '')).slice(0, 50),
    };
  }, [parcelas.data, aba, hoje, mes]);
  const soma = (l: Parcela[]) => l.reduce((a, p) => a + Number(p.valor), 0);

  const marcar = async (p: Parcela) => {
    const paga = p.situacao !== 'PAGA';
    const { error } = await db.from('milhas_parcela').update({ situacao: paga ? 'PAGA' : 'ABERTA', pago_em: paga ? hojeLocal() : null }).eq('id', p.id);
    if (error) { toast.error(erroAmigavel(error)); return; }
    toast.success(paga ? (aba === 'RECEBER' ? 'Marcada como recebida.' : 'Marcada como paga.') : 'Voltou para em aberto.');
    qc.invalidateQueries({ queryKey: ['milhas_parcelas'] });
  };

  const verbo = aba === 'RECEBER' ? 'Receber' : 'Pagar', feito = aba === 'RECEBER' ? 'Recebida' : 'Paga';
  const Lista = ({ titulo, lista, cor }: { titulo: string; lista: Parcela[]; cor?: string }) => lista.length === 0 ? null : (
    <Cartao className="p-0">
      <div className="flex justify-between px-4 pt-3 pb-1"><p className={cn('text-xs font-bold uppercase', cor || 'text-zinc-400')}>{titulo}</p><p className="text-xs font-bold">{brl(soma(lista))}</p></div>
      <div className="divide-y divide-white/5">
        {lista.map(p => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{nomeContato(p.contato_id) || p.descricao}</p>
              <p className="text-[11px] text-zinc-500 truncate">{p.numero}/{p.total} · vence {dataBR(p.vencimento)}{p.pago_em ? ` · ${feito.toLowerCase()} ${dataBR(p.pago_em)}` : ''}{nomeContato(p.contato_id) ? ` · ${p.descricao}` : ''}</p>
            </div>
            <b className="text-sm whitespace-nowrap">{brl(p.valor)}</b>
            <button onClick={() => marcar(p)} className={cn('text-[11px] font-bold px-2 py-1.5 rounded-lg border flex items-center gap-1 shrink-0', p.situacao === 'PAGA' ? 'border-violet-500/30 text-violet-300 bg-violet-500/10' : 'border-white/10 text-zinc-300')}>
              <CheckCircle2 className="w-3.5 h-3.5" /> {p.situacao === 'PAGA' ? feito : verbo}
            </button>
          </div>
        ))}
      </div>
    </Cartao>
  );

  const nadaAberto = grupos.atrasadas.length + grupos.mes.length + grupos.futuras.length === 0;
  return (
    <div className="space-y-4 max-w-3xl mx-auto text-zinc-100">
      <Pilulas<Aba> valor={aba} onChange={setAba} opcoes={[['RECEBER', 'A receber'], ['PAGAR', 'A pagar']]} />
      <div className="grid grid-cols-3 gap-2">
        <Indicador titulo="Atrasado" valor={brl(soma(grupos.atrasadas))} />
        <Indicador titulo="Este mês" valor={brl(soma(grupos.mes))} destaque />
        <Indicador titulo="Próximos meses" valor={brl(soma(grupos.futuras))} />
      </div>
      {parcelas.isLoading ? <p className="text-sm text-zinc-400">Carregando...</p> : nadaAberto && !verPagas ? (
        <Vazio>{aba === 'RECEBER' ? 'Nada a receber. As vendas parceladas aparecem aqui.' : 'Nada a pagar. Compras de milhas parceladas com fornecedor aparecem aqui.'}</Vazio>
      ) : null}
      <Lista titulo="Atrasadas" lista={grupos.atrasadas} cor="text-red-400" />
      <Lista titulo="Este mês" lista={grupos.mes} cor="text-violet-300" />
      <Lista titulo="Próximos meses" lista={grupos.futuras} />
      <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" className="accent-violet-500 w-4 h-4" checked={verPagas} onChange={e => setVerPagas(e.target.checked)} /> Mostrar as já {aba === 'RECEBER' ? 'recebidas' : 'pagas'} (últimas 50)</label>
      {verPagas && <Lista titulo={aba === 'RECEBER' ? 'Recebidas' : 'Pagas'} lista={grupos.pagas} />}
    </div>
  );
}
