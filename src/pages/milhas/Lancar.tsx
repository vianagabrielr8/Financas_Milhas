import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowDown } from 'lucide-react';
import { hojeLocal } from '@/lib/utils';
import {
  db, buscarProgramas, buscarContas, buscarContatos, buscarMovimentos, situacaoDaConta, custoDaSaida,
  milhasFmt, brl, milheiro, erroAmigavel, somaMeses, Conta, Programa,
} from '@/lib/milhas';
import { Campo, Pilulas, BotaoRoxo, Cartao, inputCls } from '@/components/milhas/ui';

type Aba = 'COMPRA' | 'BONUS' | 'TRANSF' | 'USO' | 'EXPIROU' | 'AJUSTE';
// Aceita "10.000", "350,50" e "350.50".
const num = (v: string) => {
  const t = String(v).trim();
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
  if (/^\d+\.\d{1,2}$/.test(t)) return Number(t) || 0;
  return Number(t.replace(/\./g, '')) || 0;
};

export default function Lancar() {
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>('COMPRA');
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const contatos = useQuery({ queryKey: ['milhas_contatos'], queryFn: buscarContatos });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });

  const situacoes = useMemo(() => {
    const porConta = new Map<string, any[]>();
    for (const m of movs.data || []) { if (!porConta.has(m.conta_id)) porConta.set(m.conta_id, []); porConta.get(m.conta_id)!.push(m); }
    return new Map(Array.from(porConta.entries()).map(([id, l]) => [id, situacaoDaConta(l)]));
  }, [movs.data]);
  const sit = (contaId: string) => situacoes.get(contaId) || situacaoDaConta([]);

  const nomeProg = (id: string) => programas.data?.find(p => p.id === id)?.nome || '?';
  const contasAtivas = (contas.data || []).filter(c => c.ativo);
  const rotulo = (c: Conta) => `${c.titular} – ${nomeProg(c.programa_id)}`;
  const recarregar = () => { qc.invalidateQueries({ queryKey: ['milhas_movimentos'] }); qc.invalidateQueries({ queryKey: ['milhas_parcelas'] }); };

  if (!contas.isLoading && contasAtivas.length === 0) {
    return <Cartao className="max-w-xl mx-auto text-center text-sm text-zinc-400">Cadastre primeiro uma conta em <b className="text-violet-300">Cadastros → Contas (CPFs)</b>.</Cartao>;
  }

  const props = { contas: contasAtivas, rotulo, sit, recarregar, programas: programas.data || [] };
  return (
    <div className="space-y-4 max-w-xl mx-auto text-zinc-100">
      <Pilulas<Aba> valor={aba} onChange={setAba} opcoes={[['COMPRA', 'Compra'], ['BONUS', 'Bônus'], ['TRANSF', 'Transferência'], ['USO', 'Uso'], ['EXPIROU', 'Expirou'], ['AJUSTE', 'Ajuste']]} />
      {aba === 'COMPRA' && <FormCompra {...props} fornecedores={(contatos.data || []).filter(c => c.ativo && c.tipo !== 'CLIENTE')} />}
      {aba === 'BONUS' && <FormSimples {...props} tipo="BONUS" />}
      {aba === 'TRANSF' && <FormTransferencia {...props} />}
      {aba === 'USO' && <FormUso {...props} />}
      {aba === 'EXPIROU' && <FormSimples {...props} tipo="EXPIROU" />}
      {aba === 'AJUSTE' && <FormSimples {...props} tipo="AJUSTE" />}
    </div>
  );
}

type Props = { contas: Conta[]; rotulo: (c: Conta) => string; sit: (id: string) => ReturnType<typeof situacaoDaConta>; recarregar: () => void; programas: Programa[] };

function SeletorConta({ contas, rotulo, sit, valor, onChange, rotuloCampo = 'Conta' }: Props & { valor: string; onChange: (v: string) => void; rotuloCampo?: string }) {
  const s = valor ? sit(valor) : null;
  return (
    <Campo rotulo={rotuloCampo} dica={s ? `Saldo: ${milhasFmt(s.saldo)} milhas · milheiro ${brl(s.milheiro)}` : undefined}>
      <select required className={inputCls} value={valor} onChange={e => onChange(e.target.value)}>
        <option value="" disabled>Escolha a conta</option>
        {contas.map(c => <option key={c.id} value={c.id}>{rotulo(c)}</option>)}
      </select>
    </Campo>
  );
}

function Resumo({ linhas }: { linhas: [string, string][] }) {
  return (
    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 space-y-1">
      {linhas.map(([a, b]) => <div key={a} className="flex justify-between text-xs"><span className="text-zinc-400">{a}</span><span className="font-bold text-violet-200">{b}</span></div>)}
    </div>
  );
}

/* ------------------------------ Compra ------------------------------ */
function FormCompra(p: Props & { fornecedores: any[] }) {
  const [f, setF] = useState({ conta: '', data: hojeLocal(), qtd: '', custo: '', validade: '', forma: 'CARTAO', parcelas: '2', venc1: '', contato: '', obs: '' });
  const [salvando, setSalvando] = useState(false);
  const qtd = num(f.qtd), custo = num(f.custo);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qtd <= 0) return toast.error('Informe a quantidade de milhas.');
    if (f.forma === 'PARCELADO' && (!f.venc1 || Number(f.parcelas) < 1)) return toast.error('Informe as parcelas e o 1º vencimento.');
    setSalvando(true);
    const { data: mov, error } = await db.from('milhas_movimento').insert([{
      conta_id: f.conta, tipo: 'COMPRA', quantidade: qtd, custo, data: f.data, validade: f.validade || null,
      forma_pagamento: f.forma, contato_id: f.contato || null, observacao: f.obs.trim() || null,
    }]).select('id').single();
    if (error) { setSalvando(false); return toast.error(erroAmigavel(error)); }
    if (f.forma === 'PARCELADO') {
      const n = Number(f.parcelas), base = Math.floor((custo / n) * 100) / 100;
      const conta = p.contas.find(c => c.id === f.conta)!;
      const linhas = Array.from({ length: n }, (_, i) => ({
        tipo: 'PAGAR', movimento_id: mov.id, contato_id: f.contato || null,
        descricao: `Compra de ${milhasFmt(qtd)} milhas – ${p.rotulo(conta)}`, numero: i + 1, total: n,
        valor: i === n - 1 ? Math.round((custo - base * (n - 1)) * 100) / 100 : base, vencimento: somaMeses(f.venc1, i),
      }));
      const { error: e2 } = await db.from('milhas_parcela').insert(linhas);
      if (e2) { await db.from('milhas_movimento').delete().eq('id', mov.id); setSalvando(false); return toast.error('Não gravei (erro nas parcelas): ' + erroAmigavel(e2)); }
    }
    setSalvando(false);
    toast.success(`Compra de ${milhasFmt(qtd)} milhas lançada.`);
    setF({ ...f, qtd: '', custo: '', validade: '', obs: '' });
    p.recarregar();
  };

  return (
    <Cartao>
      <form onSubmit={salvar} className="space-y-4">
        <SeletorConta {...p} valor={f.conta} onChange={v => setF({ ...f, conta: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Milhas"><input required inputMode="numeric" className={inputCls} value={f.qtd} onChange={e => setF({ ...f, qtd: e.target.value })} placeholder="10.000" /></Campo>
          <Campo rotulo="Valor pago (R$)"><input required inputMode="decimal" className={inputCls} value={f.custo} onChange={e => setF({ ...f, custo: e.target.value })} placeholder="350,00" /></Campo>
          <Campo rotulo="Data"><input type="date" required className={inputCls} value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo rotulo="Vencem em"><input type="date" className={inputCls} value={f.validade} onChange={e => setF({ ...f, validade: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Como pagou" dica={f.forma === 'CARTAO' ? 'A compra no cartão já aparece em Finanças (centro "Gestão de Milhas"). Aqui não gera conta a pagar.' : f.forma === 'PARCELADO' ? 'Gera as parcelas em Contas a pagar.' : undefined}>
          <select className={inputCls} value={f.forma} onChange={e => setF({ ...f, forma: e.target.value })}>
            <option value="CARTAO">Cartão de crédito</option>
            <option value="A_VISTA">Pix / boleto à vista</option>
            <option value="PARCELADO">Parcelado com o fornecedor</option>
          </select>
        </Campo>
        {f.forma === 'PARCELADO' && <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Parcelas"><input type="number" min="1" max="48" className={inputCls} value={f.parcelas} onChange={e => setF({ ...f, parcelas: e.target.value })} /></Campo>
          <Campo rotulo="1º vencimento"><input type="date" className={inputCls} value={f.venc1} onChange={e => setF({ ...f, venc1: e.target.value })} /></Campo>
        </div>}
        {p.fornecedores.length > 0 && <Campo rotulo="Fornecedor (opcional)">
          <select className={inputCls} value={f.contato} onChange={e => setF({ ...f, contato: e.target.value })}>
            <option value="">—</option>{p.fornecedores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>}
        <Campo rotulo="Observação"><input className={inputCls} value={f.obs} onChange={e => setF({ ...f, obs: e.target.value })} /></Campo>
        {qtd > 0 && custo > 0 && <Resumo linhas={[['Milheiro desta compra', brl(milheiro(custo, qtd))],
          ...(f.conta ? [['Novo milheiro da conta', brl(milheiro(p.sit(f.conta).custo + custo, p.sit(f.conta).saldo + qtd))] as [string, string]] : [])]} />}
        <BotaoRoxo type="submit" disabled={salvando} className="w-full">{salvando ? 'Gravando...' : 'Lançar compra'}</BotaoRoxo>
      </form>
    </Cartao>
  );
}

/* ------------------- Bônus, Expirou e Ajuste ------------------- */
function FormSimples(p: Props & { tipo: 'BONUS' | 'EXPIROU' | 'AJUSTE' }) {
  const [f, setF] = useState({ conta: '', data: hojeLocal(), qtd: '', validade: '', sinal: 'MAIS', custo: '', obs: '' });
  const [salvando, setSalvando] = useState(false);
  const qtd = num(f.qtd);
  const entra = p.tipo === 'BONUS' || (p.tipo === 'AJUSTE' && f.sinal === 'MAIS');
  const tipoFinal = p.tipo === 'AJUSTE' ? (f.sinal === 'MAIS' ? 'AJUSTE_MAIS' : 'AJUSTE_MENOS') : p.tipo;
  const s = f.conta ? p.sit(f.conta) : null;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qtd <= 0) return toast.error('Informe a quantidade.');
    if (!entra && s && qtd > s.saldo) return toast.error(`A conta só tem ${milhasFmt(s.saldo)} milhas.`);
    setSalvando(true);
    const custo = entra ? num(f.custo) : custoDaSaida(s!, qtd);
    const { error } = await db.from('milhas_movimento').insert([{
      conta_id: f.conta, tipo: tipoFinal, quantidade: qtd, custo, data: f.data,
      validade: entra ? (f.validade || null) : null, observacao: f.obs.trim() || null,
    }]);
    setSalvando(false);
    if (error) return toast.error(erroAmigavel(error));
    toast.success('Lançado.'); setF({ ...f, qtd: '', custo: '', validade: '', obs: '' }); p.recarregar();
  };

  const titulo = p.tipo === 'BONUS' ? 'Lançar bônus' : p.tipo === 'EXPIROU' ? 'Lançar milhas vencidas' : 'Lançar ajuste';
  return (
    <Cartao>
      <form onSubmit={salvar} className="space-y-4">
        {p.tipo === 'BONUS' && <p className="text-xs text-zinc-500">Milhas que entraram sem você pagar: bônus do cartão, promoção, indicação...</p>}
        {p.tipo === 'AJUSTE' && <p className="text-xs text-zinc-500">Para o saldo do app bater com o extrato do programa.</p>}
        <SeletorConta {...p} valor={f.conta} onChange={v => setF({ ...f, conta: v })} />
        {p.tipo === 'AJUSTE' && <Pilulas valor={f.sinal} onChange={v => setF({ ...f, sinal: v })} opcoes={[['MAIS', 'Somar milhas'], ['MENOS', 'Tirar milhas']]} />}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Milhas"><input required inputMode="numeric" className={inputCls} value={f.qtd} onChange={e => setF({ ...f, qtd: e.target.value })} /></Campo>
          <Campo rotulo="Data"><input type="date" required className={inputCls} value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></Campo>
          {entra && <Campo rotulo="Vencem em"><input type="date" className={inputCls} value={f.validade} onChange={e => setF({ ...f, validade: e.target.value })} /></Campo>}
          {p.tipo === 'AJUSTE' && entra && <Campo rotulo="Custo (R$)" dica="Se pagou algo"><input inputMode="decimal" className={inputCls} value={f.custo} onChange={e => setF({ ...f, custo: e.target.value })} placeholder="0" /></Campo>}
        </div>
        <Campo rotulo="Observação"><input className={inputCls} value={f.obs} onChange={e => setF({ ...f, obs: e.target.value })} /></Campo>
        {!entra && s && qtd > 0 && <Resumo linhas={[['Sai do estoque pelo custo médio', brl(custoDaSaida(s, qtd))], ['Saldo depois', `${milhasFmt(s.saldo - qtd)} milhas`]]} />}
        <BotaoRoxo type="submit" disabled={salvando} className="w-full">{salvando ? 'Gravando...' : titulo}</BotaoRoxo>
      </form>
    </Cartao>
  );
}

/* --------------------------- Transferência --------------------------- */
function FormTransferencia(p: Props) {
  const [f, setF] = useState({ origem: '', destino: '', data: hojeLocal(), qtd: '', bonus: '0', entrada: '', taxa: '', validade: '', obs: '' });
  const [salvando, setSalvando] = useState(false);
  const qtd = num(f.qtd);
  const entradaCalc = Math.round(qtd * (1 + num(f.bonus) / 100));
  const entrada = f.entrada ? num(f.entrada) : entradaCalc;
  const so = f.origem ? p.sit(f.origem) : null, sd = f.destino ? p.sit(f.destino) : null;
  const custoSaida = so ? custoDaSaida(so, qtd) : 0;
  const custoEntrada = custoSaida + num(f.taxa);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.origem === f.destino) return toast.error('Origem e destino precisam ser contas diferentes.');
    if (qtd <= 0 || entrada <= 0) return toast.error('Informe as quantidades.');
    if (so && qtd > so.saldo) return toast.error(`A conta de origem só tem ${milhasFmt(so.saldo)} milhas.`);
    setSalvando(true);
    const tid = crypto.randomUUID();
    const obs = f.obs.trim() || null;
    // As duas pontas vão juntas num único envio: ou grava as duas, ou nenhuma.
    const { error } = await db.from('milhas_movimento').insert([
      { conta_id: f.origem, tipo: 'TRANSF_SAIDA', quantidade: qtd, custo: custoSaida, data: f.data, transferencia_id: tid, observacao: obs },
      { conta_id: f.destino, tipo: 'TRANSF_ENTRADA', quantidade: entrada, custo: custoEntrada, data: f.data, validade: f.validade || null, transferencia_id: tid, observacao: obs },
    ]);
    setSalvando(false);
    if (error) return toast.error(erroAmigavel(error));
    toast.success(`Transferência lançada: entraram ${milhasFmt(entrada)} milhas.`);
    setF({ ...f, qtd: '', bonus: '0', entrada: '', taxa: '', validade: '', obs: '' }); p.recarregar();
  };

  return (
    <Cartao>
      <form onSubmit={salvar} className="space-y-4">
        <SeletorConta {...p} rotuloCampo="Sai de" valor={f.origem} onChange={v => setF({ ...f, origem: v })} />
        <div className="flex justify-center -my-1"><ArrowDown className="w-5 h-5 text-violet-400" /></div>
        <SeletorConta {...p} rotuloCampo="Entra em" valor={f.destino} onChange={v => setF({ ...f, destino: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Milhas que saem"><input required inputMode="numeric" className={inputCls} value={f.qtd} onChange={e => setF({ ...f, qtd: e.target.value })} /></Campo>
          <Campo rotulo="Bônus (%)"><input inputMode="decimal" className={inputCls} value={f.bonus} onChange={e => setF({ ...f, bonus: e.target.value })} /></Campo>
          <Campo rotulo="Milhas que entram" dica={f.entrada ? 'Valor digitado' : 'Calculado pelo bônus'}><input inputMode="numeric" className={inputCls} value={f.entrada} placeholder={entradaCalc ? milhasFmt(entradaCalc) : ''} onChange={e => setF({ ...f, entrada: e.target.value })} /></Campo>
          <Campo rotulo="Taxa paga (R$)"><input inputMode="decimal" className={inputCls} value={f.taxa} onChange={e => setF({ ...f, taxa: e.target.value })} placeholder="0" /></Campo>
          <Campo rotulo="Data"><input type="date" required className={inputCls} value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo rotulo="Vencem em"><input type="date" className={inputCls} value={f.validade} onChange={e => setF({ ...f, validade: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Observação"><input className={inputCls} value={f.obs} onChange={e => setF({ ...f, obs: e.target.value })} placeholder="Ex.: promoção Livelo → LATAM 80%" /></Campo>
        {qtd > 0 && so && <Resumo linhas={[
          ['Custo que sai da origem', brl(custoSaida)],
          ['Milheiro das milhas que entram', brl(milheiro(custoEntrada, entrada))],
          ...(sd ? [['Novo milheiro no destino', brl(milheiro(sd.custo + custoEntrada, sd.saldo + entrada))] as [string, string]] : []),
        ]} />}
        <BotaoRoxo type="submit" disabled={salvando} className="w-full">{salvando ? 'Gravando...' : 'Lançar transferência'}</BotaoRoxo>
      </form>
    </Cartao>
  );
}

/* ------------------------------- Uso ------------------------------- */
function FormUso(p: Props) {
  const [f, setF] = useState({ conta: '', data: hojeLocal(), qtd: '', obs: '' });
  const [pax, setPax] = useState<{ nome: string; cpf: string }[]>([{ nome: '', cpf: '' }]);
  const [salvando, setSalvando] = useState(false);
  const qtd = num(f.qtd);
  const s = f.conta ? p.sit(f.conta) : null;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const passageiros = pax.map(x => ({ nome: x.nome.trim(), cpf: x.cpf.replace(/\D/g, '') })).filter(x => x.nome && x.cpf);
    if (qtd <= 0) return toast.error('Informe as milhas usadas.');
    if (s && qtd > s.saldo) return toast.error(`A conta só tem ${milhasFmt(s.saldo)} milhas.`);
    if (passageiros.length === 0) return toast.error('Informe pelo menos um passageiro (nome e CPF).');
    setSalvando(true);
    const { data: mov, error } = await db.from('milhas_movimento').insert([{
      conta_id: f.conta, tipo: 'USO', quantidade: qtd, custo: custoDaSaida(s!, qtd), data: f.data, observacao: f.obs.trim() || null,
    }]).select('id').single();
    if (error) { setSalvando(false); return toast.error(erroAmigavel(error)); }
    const { error: e2 } = await db.from('milhas_venda_passageiro').insert(passageiros.map(x => ({ ...x, movimento_id: mov.id })));
    if (e2) { await db.from('milhas_movimento').delete().eq('id', mov.id); setSalvando(false); return toast.error('Não gravei (erro nos passageiros): ' + erroAmigavel(e2)); }
    setSalvando(false);
    toast.success('Emissão lançada.'); setF({ ...f, qtd: '', obs: '' }); setPax([{ nome: '', cpf: '' }]); p.recarregar();
  };

  return (
    <Cartao>
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-xs text-zinc-500">Passagem emitida para você ou para a família (sem venda). Os passageiros contam no limite de CPF do programa.</p>
        <SeletorConta {...p} valor={f.conta} onChange={v => setF({ ...f, conta: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Milhas usadas"><input required inputMode="numeric" className={inputCls} value={f.qtd} onChange={e => setF({ ...f, qtd: e.target.value })} /></Campo>
          <Campo rotulo="Data da emissão"><input type="date" required className={inputCls} value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></Campo>
        </div>
        <div className="space-y-2">
          <span className="text-zinc-400 text-[11px] font-bold uppercase block">Passageiros</span>
          {pax.map((x, i) => (
            <div key={i} className="flex gap-2">
              <input className={inputCls} placeholder="Nome" value={x.nome} onChange={e => setPax(pax.map((y, j) => j === i ? { ...y, nome: e.target.value } : y))} />
              <input className={inputCls + ' max-w-[9.5rem]'} inputMode="numeric" placeholder="CPF" value={x.cpf} onChange={e => setPax(pax.map((y, j) => j === i ? { ...y, cpf: e.target.value } : y))} />
              {pax.length > 1 && <button type="button" onClick={() => setPax(pax.filter((_, j) => j !== i))} className="p-2 text-zinc-500 hover:text-red-400 shrink-0"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
          <button type="button" onClick={() => setPax([...pax, { nome: '', cpf: '' }])} className="text-xs font-bold text-violet-300 flex items-center gap-1 py-1"><Plus className="w-3.5 h-3.5" /> Passageiro</button>
        </div>
        <Campo rotulo="Observação"><input className={inputCls} value={f.obs} onChange={e => setF({ ...f, obs: e.target.value })} placeholder="Ex.: GRU–LIS, localizador ABC123" /></Campo>
        {s && qtd > 0 && <Resumo linhas={[['Custo das milhas usadas', brl(custoDaSaida(s, qtd))], ['Saldo depois', `${milhasFmt(s.saldo - qtd)} milhas`]]} />}
        <BotaoRoxo type="submit" disabled={salvando} className="w-full">{salvando ? 'Gravando...' : 'Lançar emissão'}</BotaoRoxo>
      </form>
    </Cartao>
  );
}
