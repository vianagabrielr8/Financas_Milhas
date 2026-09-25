import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, buscarProgramas, buscarContas, buscarContatos, erroAmigavel, Programa, Conta, Contato } from '@/lib/milhas';
import { Campo, Pilulas, BotaoRoxo, Cartao, Janela, Vazio, inputCls } from '@/components/milhas/ui';

type Aba = 'programas' | 'contas' | 'contatos';

export default function Cadastros() {
  const [aba, setAba] = useState<Aba>('contas');
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const contatos = useQuery({ queryKey: ['milhas_contatos'], queryFn: buscarContatos });

  return (
    <div className="space-y-4 max-w-4xl mx-auto text-zinc-100">
      <Pilulas<Aba> valor={aba} onChange={setAba} opcoes={[['contas', 'Contas (CPFs)'], ['programas', 'Programas'], ['contatos', 'Clientes e fornecedores']]} />
      {aba === 'programas' && <AbaProgramas lista={programas.data || []} recarregar={programas.refetch} />}
      {aba === 'contas' && <AbaContas lista={contas.data || []} programas={programas.data || []} recarregar={contas.refetch} />}
      {aba === 'contatos' && <AbaContatos lista={contatos.data || []} recarregar={contatos.refetch} />}
    </div>
  );
}

// Apaga; se houver lançamentos ligados, o banco recusa e sugerimos desativar.
async function apagar(tabela: string, id: string, nome: string, recarregar: () => void) {
  if (!window.confirm(`Apagar "${nome}"?`)) return;
  const { error } = await db.from(tabela).delete().eq('id', id);
  if (error) toast.error(erroAmigavel(error)); else { toast.success('Apagado.'); recarregar(); }
}
async function alternarAtivo(tabela: string, item: { id: string; ativo: boolean }, recarregar: () => void) {
  const { error } = await db.from(tabela).update({ ativo: !item.ativo }).eq('id', item.id);
  if (error) toast.error(erroAmigavel(error)); else recarregar();
}

function Linha({ titulo, sub, ativo, onEditar, onApagar, onAtivo }: { titulo: string; sub?: string; ativo: boolean; onEditar: () => void; onApagar: () => void; onAtivo: () => void }) {
  return (
    <div className={cn('flex items-center gap-2 py-3', !ativo && 'opacity-50')}>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-white truncate">{titulo}</p>
        {sub && <p className="text-[11px] text-zinc-500 truncate">{sub}</p>}
      </div>
      <button onClick={onAtivo} className={cn('text-[10px] font-bold px-2 py-1 rounded-md border shrink-0', ativo ? 'border-violet-500/30 text-violet-300 bg-violet-500/10' : 'border-white/10 text-zinc-500')}>
        {ativo ? 'ATIVO' : 'INATIVO'}
      </button>
      <button onClick={onEditar} className="p-2 text-zinc-400 hover:text-white" title="Editar"><Edit2 className="w-4 h-4" /></button>
      <button onClick={onApagar} className="p-2 text-zinc-400 hover:text-red-400" title="Apagar"><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}

/* ---------------------------- Programas ---------------------------- */
function AbaProgramas({ lista, recarregar }: { lista: Programa[]; recarregar: () => void }) {
  const vazio = { id: '', nome: '', tipo: 'AEREA', limite_cpf: '', renovacao_cpf: 'ANO_CIVIL' };
  const [form, setForm] = useState<any>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: form.nome.trim(), tipo: form.tipo,
      limite_cpf: form.tipo === 'AEREA' && form.limite_cpf ? Number(form.limite_cpf) : null,
      renovacao_cpf: form.tipo === 'AEREA' && form.limite_cpf ? form.renovacao_cpf : null,
    };
    const { error } = form.id
      ? await db.from('milhas_programa').update(payload).eq('id', form.id)
      : await db.from('milhas_programa').insert([payload]);
    if (error) { toast.error(erroAmigavel(error)); return; }
    toast.success('Programa salvo.'); setForm(null); recarregar();
  };

  return (
    <Cartao>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-zinc-400">Companhias aéreas e bancos de pontos.</p>
        <BotaoRoxo onClick={() => setForm(vazio)} className="h-9 text-sm"><Plus className="w-4 h-4" /> Novo</BotaoRoxo>
      </div>
      {lista.length === 0 ? <Vazio>Nenhum programa.</Vazio> : (
        <div className="divide-y divide-white/5">
          {lista.map(p => (
            <Linha key={p.id} titulo={p.nome} ativo={p.ativo}
              sub={p.tipo === 'BANCO' ? 'Banco de pontos' : p.limite_cpf ? `Aérea · limite ${p.limite_cpf} CPFs · renova ${p.renovacao_cpf === '12_MESES' ? '12 meses após cada emissão' : 'todo 1º de janeiro'}` : 'Aérea · sem limite de CPF'}
              onEditar={() => setForm({ ...p, limite_cpf: p.limite_cpf ?? '', renovacao_cpf: p.renovacao_cpf ?? 'ANO_CIVIL' })}
              onApagar={() => apagar('milhas_programa', p.id, p.nome, recarregar)}
              onAtivo={() => alternarAtivo('milhas_programa', p, recarregar)} />
          ))}
        </div>
      )}
      <Janela titulo={form?.id ? 'Editar programa' : 'Novo programa'} aberta={!!form} onFechar={() => setForm(null)}>
        {form && <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Nome"><input required className={inputCls} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: LATAM Pass" /></Campo>
          <Campo rotulo="Tipo">
            <select className={inputCls} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option value="AEREA">Companhia aérea (emite passagem)</option>
              <option value="BANCO">Banco de pontos (Livelo, Esfera...)</option>
            </select>
          </Campo>
          {form.tipo === 'AEREA' && <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Limite de CPFs" dica="Vazio = sem limite"><input type="number" min="1" className={inputCls} value={form.limite_cpf} onChange={e => setForm({ ...form, limite_cpf: e.target.value })} /></Campo>
            <Campo rotulo="Renova">
              <select className={inputCls} value={form.renovacao_cpf} onChange={e => setForm({ ...form, renovacao_cpf: e.target.value })}>
                <option value="ANO_CIVIL">Todo 1º de janeiro</option>
                <option value="12_MESES">12 meses após cada emissão</option>
              </select>
            </Campo>
          </div>}
          <BotaoRoxo type="submit" className="w-full">Salvar</BotaoRoxo>
        </form>}
      </Janela>
    </Cartao>
  );
}

/* ------------------------------ Contas ------------------------------ */
function AbaContas({ lista, programas, recarregar }: { lista: Conta[]; programas: Programa[]; recarregar: () => void }) {
  const [form, setForm] = useState<any>(null);
  const nomeProg = (id: string) => programas.find(p => p.id === id)?.nome || '?';

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { programa_id: form.programa_id, titular: form.titular.trim(), cpf: form.cpf.trim() || null, numero_programa: form.numero_programa.trim() || null };
    const { error } = form.id
      ? await db.from('milhas_conta').update(payload).eq('id', form.id)
      : await db.from('milhas_conta').insert([payload]);
    if (error) { toast.error(erroAmigavel(error)); return; }
    toast.success('Conta salva.'); setForm(null); recarregar();
  };

  const ordenadas = [...lista].sort((a, b) => a.titular.localeCompare(b.titular) || nomeProg(a.programa_id).localeCompare(nomeProg(b.programa_id)));
  return (
    <Cartao>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-sm text-zinc-400">Cada conta é uma pessoa (CPF) num programa.</p>
        <BotaoRoxo onClick={() => setForm({ id: '', programa_id: programas.find(p => p.ativo)?.id || '', titular: '', cpf: '', numero_programa: '' })} className="h-9 text-sm shrink-0"><Plus className="w-4 h-4" /> Nova</BotaoRoxo>
      </div>
      {ordenadas.length === 0 ? <Vazio>Nenhuma conta ainda. Cadastre, por exemplo, "Gabriel – LATAM Pass".</Vazio> : (
        <div className="divide-y divide-white/5">
          {ordenadas.map(c => (
            <Linha key={c.id} titulo={`${c.titular} – ${nomeProg(c.programa_id)}`} ativo={c.ativo}
              sub={[c.cpf && `CPF ${c.cpf}`, c.numero_programa && `nº ${c.numero_programa}`].filter(Boolean).join(' · ') || undefined}
              onEditar={() => setForm({ ...c, cpf: c.cpf ?? '', numero_programa: c.numero_programa ?? '' })}
              onApagar={() => apagar('milhas_conta', c.id, `${c.titular} – ${nomeProg(c.programa_id)}`, recarregar)}
              onAtivo={() => alternarAtivo('milhas_conta', c, recarregar)} />
          ))}
        </div>
      )}
      <Janela titulo={form?.id ? 'Editar conta' : 'Nova conta'} aberta={!!form} onFechar={() => setForm(null)}>
        {form && <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Programa">
            <select required className={inputCls} value={form.programa_id} onChange={e => setForm({ ...form, programa_id: e.target.value })}>
              <option value="" disabled>Escolha</option>
              {programas.filter(p => p.ativo || p.id === form.programa_id).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Titular"><input required className={inputCls} value={form.titular} onChange={e => setForm({ ...form, titular: e.target.value })} placeholder="Ex.: Gabriel" /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="CPF"><input inputMode="numeric" className={inputCls} value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></Campo>
            <Campo rotulo="Nº no programa"><input className={inputCls} value={form.numero_programa} onChange={e => setForm({ ...form, numero_programa: e.target.value })} /></Campo>
          </div>
          <BotaoRoxo type="submit" className="w-full">Salvar</BotaoRoxo>
        </form>}
      </Janela>
    </Cartao>
  );
}

/* ---------------------- Clientes e fornecedores ---------------------- */
const NOME_CONTATO: Record<string, string> = { CLIENTE: 'Cliente', FORNECEDOR: 'Fornecedor', AMBOS: 'Cliente e fornecedor' };
function AbaContatos({ lista, recarregar }: { lista: Contato[]; recarregar: () => void }) {
  const [form, setForm] = useState<any>(null);
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { nome: form.nome.trim(), tipo: form.tipo, telefone: form.telefone.trim() || null, documento: form.documento.trim() || null, observacao: form.observacao.trim() || null };
    const { error } = form.id
      ? await db.from('milhas_contato').update(payload).eq('id', form.id)
      : await db.from('milhas_contato').insert([payload]);
    if (error) { toast.error(erroAmigavel(error)); return; }
    toast.success('Salvo.'); setForm(null); recarregar();
  };
  return (
    <Cartao>
      <div className="flex items-center justify-between mb-2 gap-2">
        <p className="text-sm text-zinc-400">Para quem você vende e de quem compra.</p>
        <BotaoRoxo onClick={() => setForm({ id: '', nome: '', tipo: 'CLIENTE', telefone: '', documento: '', observacao: '' })} className="h-9 text-sm shrink-0"><Plus className="w-4 h-4" /> Novo</BotaoRoxo>
      </div>
      {lista.length === 0 ? <Vazio>Nenhum cliente ou fornecedor.</Vazio> : (
        <div className="divide-y divide-white/5">
          {lista.map(c => (
            <Linha key={c.id} titulo={c.nome} ativo={c.ativo} sub={[NOME_CONTATO[c.tipo], c.telefone].filter(Boolean).join(' · ')}
              onEditar={() => setForm({ ...c, telefone: c.telefone ?? '', documento: c.documento ?? '', observacao: c.observacao ?? '' })}
              onApagar={() => apagar('milhas_contato', c.id, c.nome, recarregar)}
              onAtivo={() => alternarAtivo('milhas_contato', c, recarregar)} />
          ))}
        </div>
      )}
      <Janela titulo={form?.id ? 'Editar' : 'Novo cliente ou fornecedor'} aberta={!!form} onFechar={() => setForm(null)}>
        {form && <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Nome"><input required className={inputCls} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></Campo>
          <Campo rotulo="Tipo">
            <select className={inputCls} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option value="CLIENTE">Cliente</option><option value="FORNECEDOR">Fornecedor</option><option value="AMBOS">Os dois</option>
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Telefone"><input inputMode="tel" className={inputCls} value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></Campo>
            <Campo rotulo="CPF/CNPJ"><input className={inputCls} value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} /></Campo>
          </div>
          <Campo rotulo="Observação"><textarea rows={2} className={inputCls} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></Campo>
          <BotaoRoxo type="submit" className="w-full">Salvar</BotaoRoxo>
        </form>}
      </Janela>
    </Cartao>
  );
}
