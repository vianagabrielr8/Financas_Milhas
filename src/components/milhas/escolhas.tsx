// Seletores reutilizados em Lançar e Vendas: titular + programa (carteira) e passageiros.
import { Plus, Trash2 } from 'lucide-react';
import { Conta, Titular, Programa, PassageiroCad, SituacaoConta, situacaoDaConta, milhasFmt, brl, soDigitos, db } from '@/lib/milhas';
import { Campo, Pilulas, inputCls } from '@/components/milhas/ui';

export type Carteira = { titular: string; programa: string };
export const contaDe = (contas: Conta[], c: Carteira) => contas.find(x => x.titular_id === c.titular && x.programa_id === c.programa);

export function SeletorCarteira({ valor, onChange, titulares, programas, contas, sit, rotulo, soComSaldo }: {
  valor: Carteira; onChange: (c: Carteira) => void; titulares: Titular[]; programas: Programa[]; contas: Conta[];
  sit: (contaId: string) => SituacaoConta; rotulo?: string; soComSaldo?: boolean;
}) {
  const conta = contaDe(contas, valor);
  const s = conta ? sit(conta.id) : situacaoDaConta([]);
  // Para saídas, mostra só os programas em que aquele titular tem conta.
  const progs = soComSaldo && valor.titular ? programas.filter(p => contas.some(c => c.titular_id === valor.titular && c.programa_id === p.id)) : programas;
  return (
    <div className="space-y-1">
      {rotulo && <span className="text-zinc-400 text-[11px] font-bold uppercase block">{rotulo}</span>}
      <div className="grid grid-cols-2 gap-2">
        <select required className={inputCls} value={valor.titular} onChange={e => onChange({ ...valor, titular: e.target.value })}>
          <option value="" disabled>Titular</option>
          {titulares.filter(t => t.ativo || t.id === valor.titular).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <select required className={inputCls} value={valor.programa} onChange={e => onChange({ ...valor, programa: e.target.value })}>
          <option value="" disabled>Programa</option>
          {progs.filter(p => p.ativo || p.id === valor.programa).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      {valor.titular && valor.programa && <span className="text-[11px] text-zinc-500 block">Saldo: {milhasFmt(s.saldo)} milhas · milheiro {brl(s.milheiro)}{s.futuro ? ` · +${milhasFmt(s.futuro)} programadas` : ''}</span>}
    </div>
  );
}

export type PaxLinha = { passageiro_id: string; nome: string; documento_tipo: 'CPF' | 'PASSAPORTE'; documento: string };
export const paxVazio = (): PaxLinha => ({ passageiro_id: '', nome: '', documento_tipo: 'CPF', documento: '' });

/** Lista de passageiros: escolhe do cadastro ou digita um novo (o banco cria o cadastro sozinho). */
export function EditorPassageiros({ linhas, onChange, cadastro }: { linhas: PaxLinha[]; onChange: (l: PaxLinha[]) => void; cadastro: PassageiroCad[] }) {
  const set = (i: number, p: Partial<PaxLinha>) => onChange(linhas.map((l, j) => j === i ? { ...l, ...p } : l));
  return (
    <div className="space-y-2">
      <span className="text-zinc-400 text-[11px] font-bold uppercase block">Passageiros</span>
      {linhas.map((l, i) => (
        <div key={i} className="space-y-2 bg-black/20 rounded-xl p-2">
          <div className="flex gap-2">
            <select className={inputCls} value={l.passageiro_id} onChange={e => set(i, { passageiro_id: e.target.value })}>
              <option value="">+ Novo passageiro</option>
              {cadastro.filter(p => p.ativo).map(p => <option key={p.id} value={p.id}>{p.nome} · {p.documento_tipo === 'CPF' ? 'CPF' : 'Pass.'} {p.documento}</option>)}
            </select>
            {linhas.length > 1 && <button type="button" onClick={() => onChange(linhas.filter((_, j) => j !== i))} className="p-2 text-zinc-500 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>}
          </div>
          {!l.passageiro_id && <>
            <input className={inputCls} placeholder="Nome completo" value={l.nome} onChange={e => set(i, { nome: e.target.value })} />
            <div className="flex gap-2">
              <div className="shrink-0"><Pilulas valor={l.documento_tipo} onChange={(v: any) => set(i, { documento_tipo: v })} opcoes={[['CPF', 'CPF'], ['PASSAPORTE', 'Passaporte']]} /></div>
              <input className={inputCls} placeholder={l.documento_tipo === 'CPF' ? 'CPF' : 'Nº do passaporte'} inputMode={l.documento_tipo === 'CPF' ? 'numeric' : 'text'} value={l.documento} onChange={e => set(i, { documento: e.target.value })} />
            </div>
          </>}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...linhas, paxVazio()])} className="text-xs font-bold text-violet-300 flex items-center gap-1 py-1"><Plus className="w-3.5 h-3.5" /> Passageiro</button>
    </div>
  );
}

/** Linhas válidas para gravar em milhas_venda_passageiro (sem o movimento_id). */
export function paxParaGravar(linhas: PaxLinha[], cadastro: PassageiroCad[]) {
  return linhas.map(l => {
    if (l.passageiro_id) { const p = cadastro.find(x => x.id === l.passageiro_id); return p ? { passageiro_id: p.id, nome: p.nome, cpf: p.documento, documento_tipo: p.documento_tipo } : null; }
    const doc = l.documento_tipo === 'CPF' ? soDigitos(l.documento) : l.documento.trim().toUpperCase();
    return l.nome.trim() && doc ? { nome: l.nome.trim(), cpf: doc, documento_tipo: l.documento_tipo } : null;
  }).filter(Boolean) as { passageiro_id?: string; nome: string; cpf: string; documento_tipo: string }[];
}

export async function gravarPassageiros(movimentoId: string, linhas: ReturnType<typeof paxParaGravar>) {
  return db.from('milhas_venda_passageiro').insert(linhas.map(l => ({ ...l, movimento_id: movimentoId })));
}

export { Campo };
