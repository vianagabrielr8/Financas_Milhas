import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { X, MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  transacao: { id: string; descricao: string } | null;
  onFechar: () => void;
}

// Janela em que o MEMBRO aponta "a categoria deste lançamento está errada,
// deveria ser X". O admin aceita ou recusa na tela Contestações.
export function ContestarModal({ transacao, onFechar }: Props) {
  const [escolha, setEscolha] = useState('');   // "catId" ou "catId|subId"
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const { data: arvore = [] } = useQuery({
    queryKey: ['contestar_categorias'],
    queryFn: async () => {
      const [{ data: cats }, { data: subs }] = await Promise.all([
        supabase.from('categoria_pessoal').select('id, nome').order('nome'),
        supabase.from('subcategoria_pessoal').select('id, nome, categoria_id').order('nome'),
      ]);
      return (cats || []).map((c: any) => ({ ...c, subs: (subs || []).filter((s: any) => s.categoria_id === c.id) }));
    },
    enabled: !!transacao,
  });

  if (!transacao) return null;

  const enviar = async () => {
    if (!escolha && !comentario.trim()) return toast.error('Escolha a categoria certa ou escreva um comentário.');
    const [catId, subId] = escolha.split('|');
    setEnviando(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('contestacao_classificacao').insert([{
      transacao_id: transacao.id,
      categoria_sugerida_id: catId || null,
      subcategoria_sugerida_id: subId || null,
      comentario: comentario.trim() || null,
      criado_por: user?.id,
    }]);
    setEnviando(false);
    if (error) return toast.error('Erro ao enviar: ' + error.message);
    toast.success('Contestação enviada ao admin.');
    setEscolha(''); setComentario('');
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative bg-[#1e1e24] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4 text-zinc-100">
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><MessageSquareWarning className="w-5 h-5 text-amber-400" /> Contestar classificação</h3>
          <button onClick={onFechar} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-zinc-400 truncate">Lançamento: <b className="text-zinc-200">{transacao.descricao}</b></p>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Categoria certa</label>
          <select value={escolha} onChange={e => setEscolha(e.target.value)} className="w-full bg-[#141417] border border-white/10 rounded-md h-10 px-3 text-sm">
            <option value="">— escolha —</option>
            {arvore.map((c: any) => (
              <optgroup key={c.id} label={c.nome}>
                <option value={c.id}>{c.nome}</option>
                {c.subs.map((s: any) => <option key={s.id} value={`${c.id}|${s.id}`}>{c.nome} • {s.nome}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Comentário (opcional)</label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)} rows={3} className="w-full bg-[#141417] border border-white/10 rounded-md p-3 text-sm" placeholder="Ex.: foi presente de aniversário" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar} className="text-zinc-400">Cancelar</Button>
          <Button onClick={enviar} disabled={enviando} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">Enviar</Button>
        </div>
      </div>
    </div>
  );
}
