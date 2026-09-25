import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, CreditCard } from 'lucide-react';
import { cn, hojeLocal } from '@/lib/utils';
import { buscarParcelas, buscarCartoesFinancas, brl, dataBR } from '@/lib/milhas';
import { Cartao, Indicador, Vazio } from '@/components/milhas/ui';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const rotuloMes = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`;

// Quanto das compras de milhas e dos clubes vai cair em cada cartão (de Finanças), mês a mês.
// É só um retrato: a fatura de verdade continua sendo lançada em Finanças.
export default function CartoesMilhas() {
  const parcelas = useQuery({ queryKey: ['milhas_parcelas'], queryFn: buscarParcelas });
  const cartoes = useQuery({ queryKey: ['cartoes_financas'], queryFn: buscarCartoesFinancas });
  const [aberto, setAberto] = useState<string | null>(null);
  const hoje = hojeLocal(), mesAtual = hoje.slice(0, 7);

  const dados = useMemo(() => {
    const noCartao = (parcelas.data || []).filter(p => p.tipo === 'PAGAR' && p.cartao_id);
    const porCartao = new Map<string, { total: number; futuro: number; meses: Map<string, typeof noCartao> }>();
    for (const p of noCartao) {
      const c = porCartao.get(p.cartao_id!) || { total: 0, futuro: 0, meses: new Map() };
      c.total += Number(p.valor);
      if (p.vencimento.slice(0, 7) >= mesAtual) c.futuro += Number(p.valor);
      const ym = p.vencimento.slice(0, 7);
      c.meses.set(ym, [...(c.meses.get(ym) || []), p]);
      porCartao.set(p.cartao_id!, c);
    }
    return porCartao;
  }, [parcelas.data, mesAtual]);

  const esteMes = Array.from(dados.values()).reduce((a, c) => a + (c.meses.get(mesAtual) || []).reduce((s, p) => s + Number(p.valor), 0), 0);
  const futuro = Array.from(dados.values()).reduce((a, c) => a + c.futuro, 0);
  const nome = (id: string) => cartoes.data?.find(c => c.id === id)?.nome || 'Cartão';

  return (
    <div className="space-y-4 max-w-3xl mx-auto text-zinc-100">
      <p className="text-sm text-zinc-400">Compras de milhas e clubes pagos no cartão: quanto cai em cada fatura. Os cartões vêm de Finanças.</p>
      <div className="grid grid-cols-2 gap-2">
        <Indicador titulo={`Faturas de ${rotuloMes(mesAtual)}`} valor={brl(esteMes)} destaque />
        <Indicador titulo="Deste mês em diante" valor={brl(futuro)} />
      </div>
      {dados.size === 0 ? <Vazio>Nada no cartão ainda. Lance uma compra de milhas ou um clube pago no cartão.</Vazio> :
        Array.from(dados.entries()).map(([cartaoId, c]) => {
          const meses = Array.from(c.meses.keys()).filter(m => m >= mesAtual).sort();
          return (
            <Cartao key={cartaoId} className="p-0">
              <button onClick={() => setAberto(aberto === cartaoId ? null : cartaoId)} className="w-full text-left p-4 flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-violet-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{nome(cartaoId)}</p>
                  <p className="text-[11px] text-zinc-500">{meses.slice(0, 4).map(m => `${rotuloMes(m)}: ${brl((c.meses.get(m) || []).reduce((s, p) => s + Number(p.valor), 0))}`).join(' · ') || 'nada a vencer'}</p>
                </div>
                <b className="text-sm whitespace-nowrap">{brl(c.futuro)}</b>
                <ChevronDown className={cn('w-4 h-4 text-zinc-500 transition-transform', aberto === cartaoId && 'rotate-180')} />
              </button>
              {aberto === cartaoId && <div className="border-t border-white/5 divide-y divide-white/5">
                {meses.map(m => (c.meses.get(m) || []).map(p => (
                  <div key={p.id} className="px-4 py-2.5 flex justify-between gap-2 text-xs">
                    <span className="truncate"><b>{rotuloMes(m)}</b> · {p.descricao}{p.total > 1 ? ` (${p.numero}/${p.total})` : ''}</span>
                    <span className="whitespace-nowrap">{brl(p.valor)} <span className="text-zinc-500">· vence {dataBR(p.vencimento)}</span></span>
                  </div>
                )))}
              </div>}
            </Cartao>
          );
        })}
    </div>
  );
}
