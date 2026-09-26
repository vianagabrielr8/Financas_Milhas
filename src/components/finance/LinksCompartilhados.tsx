import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Link2, Copy, Trash2, Plus, Power } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type LinkComp = { id: string; codigo: string; titulo: string; categoria_id: string; ativo: boolean; ultimo_acesso: string | null; criado_em: string };
const db = supabase as any;
const urlDo = (codigo: string) => `${window.location.origin}/compartilhado/${codigo}`;
const semAcento = (s: string) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function copiar(texto: string) {
  try { await navigator.clipboard.writeText(texto); toast.success('Link copiado. É só colar no WhatsApp.'); }
  catch { window.prompt('Copie o link:', texto); }
}

/** Botão + janela para criar, copiar, desligar e apagar links de "quanto você me deve". Só admin. */
export function LinksCompartilhados({ categorias, centros }: { categorias: any[]; centros: any[] }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [categoriaId, setCategoriaId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const { data: links = [], error } = useQuery({
    queryKey: ['links_compartilhados'],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await db.from('link_compartilhado').select('*').order('criado_em', { ascending: false });
      if (error) throw error;
      return (data || []) as LinkComp[];
    },
  });

  // categorias do centro Terceiros primeiro (é o uso normal), depois as outras
  const opcoes = useMemo(() => {
    const terceiros = new Set(centros.filter((c: any) => semAcento(c.nome).includes('terceiro')).map((c: any) => c.id));
    const nomeCentro = (id: string) => centros.find((c: any) => c.id === id)?.nome || '';
    return [...categorias]
      .map((c: any) => ({ id: c.id, nome: c.nome, centro: nomeCentro(c.centro_custo_id), terceiro: terceiros.has(c.centro_custo_id) }))
      .sort((a, b) => Number(b.terceiro) - Number(a.terceiro) || a.nome.localeCompare(b.nome));
  }, [categorias, centros]);
  const nomeCat = (id: string) => opcoes.find((o) => o.id === id)?.nome || '?';

  const recarregar = () => qc.invalidateQueries({ queryKey: ['links_compartilhados'] });
  const criar = async () => {
    if (!categoriaId) return toast.error('Escolha de quem é o link (a categoria).');
    setSalvando(true);
    const { data, error } = await db.from('link_compartilhado').insert([{ titulo: nomeCat(categoriaId), categoria_id: categoriaId }]).select('codigo').single();
    setSalvando(false);
    if (error) return toast.error('Não consegui criar: ' + error.message);
    setCategoriaId(''); recarregar();
    copiar(urlDo(data.codigo));
  };
  const alternar = async (l: LinkComp) => {
    const { error } = await db.from('link_compartilhado').update({ ativo: !l.ativo }).eq('id', l.id);
    if (error) return toast.error(error.message);
    toast.success(l.ativo ? 'Link desligado: quem tiver ele não consegue mais abrir.' : 'Link ligado de novo.'); recarregar();
  };
  const apagar = async (l: LinkComp) => {
    if (!window.confirm(`Apagar o link de "${l.titulo}"? Quem tiver esse link não consegue mais abrir.`)) return;
    const { error } = await db.from('link_compartilhado').delete().eq('id', l.id);
    if (error) return toast.error(error.message);
    recarregar();
  };

  return (
    <>
      <button onClick={() => setAberto(true)} className="flex items-center justify-center bg-[#1a1a20] hover:bg-[#22222a] border border-gray-800 text-gray-300 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm" title="Link para terceiros verem quanto devem">
        <Link2 className="w-4 h-4 mr-2" /> Compartilhar
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="bg-[#141417] border-white/10 text-zinc-100 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Links para terceiros</DialogTitle></DialogHeader>
          <p className="text-xs text-zinc-400 -mt-1">
            Quem recebe o link vê, <b>sem login e só para consulta</b>, os lançamentos de uma categoria (ex.: Lucas Irmão): data, valor, cartão com o
            <b> vencimento da fatura</b>, o que já pagou e quanto falta. Pode escolher o mês. Não vê mais nada do app.
          </p>
          {error ? (
            <p className="text-sm text-amber-300">Falta rodar o SQL dos links (supabase/migrations/20261005120000_link_compartilhado.sql).</p>
          ) : <>
            <div className="flex gap-2">
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="flex-1 min-w-0 bg-[#1a1a20] border border-white/10 rounded-lg h-10 px-3 text-sm">
                <option value="">De quem é o link?</option>
                {opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}{o.centro ? ` · ${o.centro}` : ''}</option>)}
              </select>
              <button onClick={criar} disabled={salvando} className="h-10 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold flex items-center gap-1 shrink-0 disabled:opacity-60"><Plus className="w-4 h-4" /> Criar</button>
            </div>
            <p className="text-[11px] text-zinc-500">Para o "já pago" funcionar: quando a pessoa te pagar, lance uma <b>Receita</b> com a mesma categoria dela.</p>
            <div className="divide-y divide-white/5 border border-white/5 rounded-xl">
              {links.length === 0 && <p className="p-3 text-sm text-zinc-500">Nenhum link criado ainda.</p>}
              {links.map((l) => (
                <div key={l.id} className={cn('p-3 flex items-center gap-2', !l.ativo && 'opacity-50')}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{l.titulo} {!l.ativo && <span className="text-[10px] text-zinc-400">(desligado)</span>}</p>
                    <p className="text-[10px] text-zinc-500">{l.ultimo_acesso ? `aberto pela última vez em ${new Date(l.ultimo_acesso).toLocaleString('pt-BR')}` : 'ainda não foi aberto'}</p>
                  </div>
                  {l.ativo && <button onClick={() => copiar(urlDo(l.codigo))} title="Copiar link" className="p-2 text-zinc-400 hover:text-white"><Copy className="w-4 h-4" /></button>}
                  <button onClick={() => alternar(l)} title={l.ativo ? 'Desligar' : 'Ligar'} className={cn('p-2 hover:text-white', l.ativo ? 'text-emerald-400' : 'text-zinc-500')}><Power className="w-4 h-4" /></button>
                  <button onClick={() => apagar(l)} title="Apagar" className="p-2 text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </>
  );
}
