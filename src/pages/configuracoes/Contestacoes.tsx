import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Check, X, MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Tela do ADMIN: contestações de categoria feitas pelos membros.
export default function Contestacoes() {
  const { data, refetch } = useQuery({
    queryKey: ['contestacoes'],
    queryFn: async () => {
      const [{ data: cont, error }, { data: cats }, { data: subs }, { data: membros }] = await Promise.all([
        supabase.from('contestacao_classificacao')
          .select('*, transacao_pessoal(descricao, valor, data, categoria_id, subcategoria_id)')
          .order('criado_em', { ascending: false }).limit(200),
        supabase.from('categoria_pessoal').select('id, nome'),
        supabase.from('subcategoria_pessoal').select('id, nome'),
        supabase.rpc('listar_membros_da_familia'),
      ]);
      if (error) throw error;
      return { cont: cont || [], cats: cats || [], subs: subs || [], membros: membros || [] };
    },
  });

  const nomeCat = (catId?: string, subId?: string) => {
    if (!catId) return 'Sem categoria';
    const c = data?.cats.find((x: any) => x.id === catId)?.nome || '?';
    const s = subId ? data?.subs.find((x: any) => x.id === subId)?.nome : null;
    return s ? `${c} • ${s}` : c;
  };
  const nomePessoa = (id: string) => data?.membros.find((m: any) => m.user_id === id)?.nome || 'Membro';

  const resolver = async (id: string, aceitar: boolean) => {
    const { error } = await supabase.rpc('resolver_contestacao', { p_id: id, p_aceitar: aceitar });
    if (error) return toast.error(error.message);
    toast.success(aceitar ? 'Aceita: a categoria do lançamento foi trocada.' : 'Contestação recusada.');
    refetch();
  };

  const pendentes = (data?.cont || []).filter((c: any) => c.situacao === 'PENDENTE');
  const resolvidas = (data?.cont || []).filter((c: any) => c.situacao !== 'PENDENTE');

  const Linha = ({ c }: { c: any }) => (
    <div className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-white truncate">
          {c.transacao_pessoal?.descricao}{' '}
          <span className="text-xs text-zinc-500 font-normal">
            {c.transacao_pessoal && `R$ ${Number(c.transacao_pessoal.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • ${new Date(c.transacao_pessoal.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}
          </span>
        </p>
        <p className="text-xs text-zinc-400">
          Hoje: <b className="text-zinc-300">{nomeCat(c.transacao_pessoal?.categoria_id, c.transacao_pessoal?.subcategoria_id)}</b>
          {' → '}sugerido: <b className="text-amber-400">{c.categoria_sugerida_id ? nomeCat(c.categoria_sugerida_id, c.subcategoria_sugerida_id) : '—'}</b>
        </p>
        {c.comentario && <p className="text-xs text-zinc-500 italic">“{c.comentario}”</p>}
        <p className="text-[10px] text-zinc-600">por {nomePessoa(c.criado_por)} em {new Date(c.criado_em).toLocaleDateString('pt-BR')}</p>
      </div>
      {c.situacao === 'PENDENTE' ? (
        <div className="flex gap-2 shrink-0">
          <Button onClick={() => resolver(c.id, true)} disabled={!c.categoria_sugerida_id} title={!c.categoria_sugerida_id ? 'Sem categoria sugerida: só dá para recusar' : ''} className="h-8 bg-[#10b981] hover:bg-[#059669] text-black font-bold flex items-center gap-1"><Check className="w-4 h-4" /> Aceitar</Button>
          <Button onClick={() => resolver(c.id, false)} variant="ghost" className="h-8 text-zinc-400 hover:text-red-400 flex items-center gap-1"><X className="w-4 h-4" /> Recusar</Button>
        </div>
      ) : (
        <span className={c.situacao === 'ACEITA' ? 'text-xs font-bold text-emerald-400' : 'text-xs font-bold text-zinc-500'}>{c.situacao === 'ACEITA' ? 'Aceita' : 'Recusada'}</span>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-zinc-100">
      <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-2"><MessageSquareWarning className="w-5 h-5 text-amber-400" /> Pendentes ({pendentes.length})</h2>
        {pendentes.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma contestação pendente.</p>
          : <div className="divide-y divide-white/5">{pendentes.map((c: any) => <Linha key={c.id} c={c} />)}</div>}
      </div>
      {resolvidas.length > 0 && (
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Resolvidas</h3>
          <div className="divide-y divide-white/5">{resolvidas.map((c: any) => <Linha key={c.id} c={c} />)}</div>
        </div>
      )}
    </div>
  );
}
