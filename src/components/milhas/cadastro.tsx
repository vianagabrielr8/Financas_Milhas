// Peças comuns das telas de cadastro de Milhas (lista com editar/apagar/ativar).
import { ReactNode } from 'react';
import { toast } from 'sonner';
import { Edit2, Trash2, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, erroAmigavel } from '@/lib/milhas';
import { BotaoRoxo, Cartao, Vazio, inputCls } from '@/components/milhas/ui';

export async function apagarCadastro(tabela: string, id: string, nome: string, recarregar: () => void) {
  if (!window.confirm(`Apagar "${nome}"?`)) return;
  const { error } = await db.from(tabela).delete().eq('id', id);
  if (error) toast.error(erroAmigavel(error)); else { toast.success('Apagado.'); recarregar(); }
}
export async function alternarAtivo(tabela: string, item: { id: string; ativo: boolean }, recarregar: () => void) {
  const { error } = await db.from(tabela).update({ ativo: !item.ativo }).eq('id', item.id);
  if (error) toast.error(erroAmigavel(error)); else recarregar();
}
/** Grava (insere ou atualiza) e avisa. Devolve true se deu certo. */
export async function salvarCadastro(tabela: string, id: string | null | undefined, payload: any, recarregar: () => void) {
  const { error } = id ? await db.from(tabela).update(payload).eq('id', id) : await db.from(tabela).insert([payload]);
  if (error) { toast.error(erroAmigavel(error)); return false; }
  toast.success('Salvo.'); recarregar(); return true;
}

export function LinhaCadastro({ titulo, sub, extra, ativo, onEditar, onApagar, onAtivo }: {
  titulo: string; sub?: string; extra?: ReactNode; ativo: boolean; onEditar: () => void; onApagar: () => void; onAtivo?: () => void;
}) {
  return (
    <div className={cn('flex items-center gap-2 py-3', !ativo && 'opacity-50')}>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-white truncate">{titulo}</p>
        {sub && <p className="text-[11px] text-zinc-500 truncate">{sub}</p>}
        {extra}
      </div>
      {onAtivo && <button onClick={onAtivo} className={cn('text-[10px] font-bold px-2 py-1 rounded-md border shrink-0', ativo ? 'border-violet-500/30 text-violet-300 bg-violet-500/10' : 'border-white/10 text-zinc-500')}>
        {ativo ? 'ATIVO' : 'INATIVO'}
      </button>}
      <button onClick={onEditar} className="p-2 text-zinc-400 hover:text-white" title="Editar"><Edit2 className="w-4 h-4" /></button>
      <button onClick={onApagar} className="p-2 text-zinc-400 hover:text-red-400" title="Apagar"><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}

/** Moldura de uma tela de cadastro: descrição, busca, botão "Novo" e a lista. */
export function TelaCadastro({ descricao, busca, onBusca, onNovo, vazio, children, quantidade }: {
  descricao: string; busca?: string; onBusca?: (v: string) => void; onNovo: () => void; vazio: string; children: ReactNode; quantidade: number;
}) {
  return (
    <div className="space-y-3 max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2">
        <p className="text-sm text-zinc-400 flex-1">{descricao}</p>
        <BotaoRoxo onClick={onNovo} className="h-10 text-sm shrink-0"><Plus className="w-4 h-4" /> Novo</BotaoRoxo>
      </div>
      {onBusca && <div className="relative">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input className={inputCls + ' pl-9'} placeholder="Buscar..." value={busca} onChange={e => onBusca(e.target.value)} />
      </div>}
      <Cartao className="py-1">{quantidade === 0 ? <div className="py-3"><Vazio>{vazio}</Vazio></div> : <div className="divide-y divide-white/5">{children}</div>}</Cartao>
    </div>
  );
}
