import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn, hojeLocal } from '@/lib/utils';
import {
  db, buscarProgramas, buscarContas, buscarContatos, buscarMovimentos, buscarVendas, buscarParcelas, buscarPassageiros,
  buscarTitulares, buscarPassageirosCad, buscarBeneficiarios, obterConta, docFmt,
  situacaoDaConta, custoDaSaida, calcularLimites, lucroDaVenda, lerNumero, milhasFmt, brl, dataBR, erroAmigavel, somaMeses,
  Venda,
} from '@/lib/milhas';
import { Campo, Pilulas, BotaoRoxo, Cartao, Indicador, Janela, Vazio, inputCls } from '@/components/milhas/ui';
import { SeletorCarteira, Carteira, contaDe, EditorPassageiros, paxVazio, paxParaGravar, gravarPassageiros, PaxLinha } from '@/components/milhas/escolhas';

export default function Vendas() {
  const qc = useQueryClient();
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const contatos = useQuery({ queryKey: ['milhas_contatos'], queryFn: buscarContatos });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const vendas = useQuery({ queryKey: ['milhas_vendas'], queryFn: buscarVendas });
  const parcelas = useQuery({ queryKey: ['milhas_parcelas'], queryFn: buscarParcelas });
  const pax = useQuery({ queryKey: ['milhas_passageiros'], queryFn: buscarPassageiros });
  const titulares = useQuery({ queryKey: ['milhas_titulares'], queryFn: buscarTitulares });
  const cadastroPax = useQuery({ queryKey: ['milhas_passageiros_cad'], queryFn: buscarPassageirosCad });
  const beneficiarios = useQuery({ queryKey: ['milhas_beneficiarios'], queryFn: buscarBeneficiarios });

  const hoje = hojeLocal();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState<Venda | null>(null);

  const nomeProg = (id: string) => programas.data?.find(p => p.id === id)?.nome || '?';
  const nomeConta = (id: string) => { const c = contas.data?.find(x => x.id === id); return c ? `${c.titular} – ${nomeProg(c.programa_id)}` : '?'; };
  const nomeContato = (id: string | null) => (id && contatos.data?.find(c => c.id === id)?.nome) || 'Sem cliente';
  const parcelasDa = (vendaId: string) => (parcelas.data || []).filter(p => p.venda_id === vendaId);

  const doMes = useMemo(() => (vendas.data || []).filter(v => !mes || v.data.startsWith(mes)), [vendas.data, mes]);
  const totalMes = doMes.reduce((a, v) => a + Number(v.valor_total), 0);
  const lucroMes = doMes.reduce((a, v) => a + lucroDaVenda(v), 0);
  const aReceber = (parcelas.data || []).filter(p => p.tipo === 'RECEBER' && p.situacao === 'ABERTA').reduce((a, p) => a + Number(p.valor), 0);

  const recarregar = () => ['milhas_vendas', 'milhas_parcelas', 'milhas_movimentos', 'milhas_passageiros', 'milhas_passageiros_cad', 'milhas_contatos', 'milhas_contas'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));

  return (
    <div className="space-y-4 max-w-4xl mx-auto text-zinc-100">
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Indicador titulo="Vendido no mês" valor={brl(totalMes)} sub={`${doMes.length} venda(s)`} />
        <Indicador titulo="Lucro no mês" valor={brl(lucroMes)} destaque />
        <Indicador titulo="A receber" valor={brl(aReceber)} sub="todas as vendas" />
      </div>

      <div className="flex gap-2">
        <input type="month" className={inputCls + ' max-w-[11rem]'} value={mes} onChange={e => setMes(e.target.value)} />
        <button onClick={() => setMes('')} className={cn('px-3 rounded-xl text-xs font-bold border', !mes ? 'border-violet-500 text-violet-300' : 'border-white/10 text-zinc-400')}>Todas</button>
        <BotaoRoxo onClick={() => setNova(true)} className="ml-auto"><Plus className="w-4 h-4" /> Nova venda</BotaoRoxo>
      </div>

      {doMes.length === 0 ? <Vazio>Nenhuma venda {mes ? 'neste mês' : 'ainda'}.</Vazio> : (
        <Cartao className="p-0 divide-y divide-white/5">
          {doMes.map(v => {
            const ps = parcelasDa(v.id), pagas = ps.filter(p => p.situacao === 'PAGA').length;
            const lucro = lucroDaVenda(v);
            return (
              <button key={v.id} onClick={() => setAberta(v)} className="w-full text-left flex gap-3 px-4 py-3 hover:bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{nomeContato(v.contato_id)}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{dataBR(v.data)} · {nomeConta(v.conta_id)} · {milhasFmt(v.milhas)} milhas{v.localizador ? ` · ${v.localizador}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{brl(v.valor_total)}</p>
                  <p className={cn('text-[11px] font-bold', lucro >= 0 ? 'text-violet-300' : 'text-red-400')}>lucro {brl(lucro)}</p>
                  {ps.length > 0 && <p className={cn('text-[10px]', pagas === ps.length ? 'text-zinc-500' : 'text-amber-400')}>{pagas === ps.length ? 'recebida' : `recebido ${pagas}/${ps.length}`}</p>}
                </div>
              </button>
            );
          })}
        </Cartao>
      )}

      <NovaVenda aberta={nova} onFechar={() => setNova(false)} onSalvo={() => { setNova(false); recarregar(); }}
        contas={contas.data || []} programas={(programas.data || []).filter(p => p.ativo)} titulares={(titulares.data || []).filter(t => t.ativo)}
        cadastroPax={cadastroPax.data || []} beneficiarios={beneficiarios.data || []} contatos={(contatos.data || []).filter(c => c.ativo && c.tipo !== 'FORNECEDOR')}
        movs={movs.data || []} pax={pax.data || []} nomeConta={nomeConta} />

      <Janela titulo="Venda" aberta={!!aberta} onFechar={() => setAberta(null)}>
        {aberta && <DetalheVenda venda={aberta} parcelas={parcelasDa(aberta.id)} nomeConta={nomeConta} nomeContato={nomeContato}
          passageiros={(pax.data || []).filter(p => (movs.data || []).some(m => m.id === p.movimento_id && m.venda_id === aberta.id))}
          onMudou={recarregar} onApagada={() => { setAberta(null); recarregar(); }} />}
      </Janela>
    </div>
  );
}

/* ------------------------------ Nova venda ------------------------------ */
function NovaVenda({ aberta, onFechar, onSalvo, contas, programas, titulares, cadastroPax, beneficiarios, contatos, movs, pax }: any) {
  const hoje = hojeLocal();
  const [cart, setCart] = useState<Carteira>({ titular: '', programa: '' });
  const contaSel = contaDe(contas, cart);
  const nomeCart = `${titulares.find((t: any) => t.id === cart.titular)?.nome || '?'} – ${programas.find((p: any) => p.id === cart.programa)?.nome || '?'}`;
  const inicial = { contato: '', novoCliente: '', data: hoje, milhas: '', modo: 'MILHEIRO', milheiro: '', total: '', taxaEm: 'NENHUMA', taxa: '', taxaMilhas: '', localizador: '', obs: '', parcelas: '1', venc1: hoje, jaRecebido: false };
  const [f, setF] = useState<any>(inicial);
  const [passageiros, setPassageiros] = useState<PaxLinha[]>([paxVazio()]);
  const [salvando, setSalvando] = useState(false);

  const milhas = lerNumero(f.milhas);
  const total = f.modo === 'TOTAL' ? lerNumero(f.total) : Math.round(lerNumero(f.milheiro) * milhas / 10) / 100;
  const taxaDinheiro = f.taxaEm === 'DINHEIRO' ? lerNumero(f.taxa) : 0;
  const taxaMilhas = f.taxaEm === 'MILHAS' ? lerNumero(f.taxaMilhas) : 0;
  const sit = useMemo(() => situacaoDaConta(contaSel ? movs.filter((m: any) => m.conta_id === contaSel.id) : []), [movs, contaSel]);
  const custo = custoDaSaida(sit, milhas + taxaMilhas);
  const lucro = total - custo - taxaDinheiro;

  // Aviso de limite de CPF (quantos CPFs novos esta venda consome)
  // Aviso de limite do programa (quantas vagas esta venda consome)
  const avisoLimite = useMemo(() => {
    if (!contaSel) return null;
    const lim = calcularLimites(programas, [contaSel], movs, pax, hoje, beneficiarios, cadastroPax)[0];
    if (!lim) return null;
    const lista = paxParaGravar(passageiros, cadastroPax);
    const titular = (contaSel.cpf || '').replace(/\D/g, '');
    const deTerceiros = lista.filter(p => p.cpf !== titular);
    const ja = new Set(lim.itens.map(i => i.doc));
    const novos = lim.unidade === 'passagens' ? deTerceiros.length
      : lim.unidade === 'pessoas' ? new Set(deTerceiros.map(p => docFmt(p.documento_tipo, p.cpf)).filter(d => !ja.has(d))).size : 0;
    const foraDaLista = lim.unidade === 'beneficiários' ? deTerceiros.filter(p => !ja.has(docFmt(p.documento_tipo, p.cpf))).map(p => p.nome) : [];
    const depois = lim.usados + novos;
    return { usados: lim.usados, depois, limite: lim.limite, unidade: lim.unidade, estoura: depois > lim.limite, foraDaLista };
  }, [programas, contaSel, movs, pax, passageiros, hoje, beneficiarios, cadastroPax]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const lista = paxParaGravar(passageiros, cadastroPax);
    if (milhas <= 0 || total <= 0) return toast.error('Informe as milhas e o valor da venda.');
    if (milhas + taxaMilhas > sit.saldo) return toast.error(`A conta só tem ${milhasFmt(sit.saldo)} milhas.`);
    if (lista.length === 0) return toast.error('Informe pelo menos um passageiro.');
    const n = Math.max(1, Number(f.parcelas) || 1);
    setSalvando(true);
    try {
      const contaId = await obterConta(cart.titular, cart.programa, contas);
      let contatoId = f.contato || null;
      if (f.contato === 'NOVO') {
        const { data: c, error } = await db.from('milhas_contato').insert([{ nome: f.novoCliente.trim(), tipo: 'CLIENTE' }]).select('id').single();
        if (error) throw error;
        contatoId = c.id;
      }
      const { data: venda, error: e1 } = await db.from('milhas_venda').insert([{
        conta_id: contaId, contato_id: contatoId, data: f.data, milhas, valor_total: total, taxa_dinheiro: taxaDinheiro, taxa_milhas: taxaMilhas,
        custo_milhas: custo, localizador: f.localizador.trim() || null, observacao: f.obs.trim() || null,
      }]).select('id').single();
      if (e1) throw e1;
      // Daqui em diante, se algo falhar, apaga a venda (apaga junto o movimento, os passageiros e as parcelas).
      try {
        const { data: mov, error: e2 } = await db.from('milhas_movimento').insert([{
          conta_id: contaId, tipo: 'VENDA', quantidade: milhas + taxaMilhas, custo, data: f.data, venda_id: venda.id, contato_id: contatoId,
          observacao: f.localizador.trim() ? `Venda ${f.localizador.trim()}` : 'Venda',
        }]).select('id').single();
        if (e2) throw e2;
        const { error: e3 } = await gravarPassageiros(mov.id, lista);
        if (e3) throw e3;
        const base = Math.floor((total / n) * 100) / 100;
        const { error: e4 } = await db.from('milhas_parcela').insert(Array.from({ length: n }, (_, i) => ({
          tipo: 'RECEBER', venda_id: venda.id, contato_id: contatoId, descricao: `Venda ${milhasFmt(milhas)} milhas – ${nomeCart}`,
          numero: i + 1, total: n, valor: i === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base,
          vencimento: somaMeses(f.venc1, i), situacao: f.jaRecebido && n === 1 ? 'PAGA' : 'ABERTA', pago_em: f.jaRecebido && n === 1 ? f.data : null,
        })));
        if (e4) throw e4;
      } catch (err) {
        await db.from('milhas_venda').delete().eq('id', venda.id);
        throw err;
      }
      toast.success(`Venda gravada. Lucro ${brl(lucro)}.`);
      setF(inicial); setPassageiros([paxVazio()]);
      onSalvo();
    } catch (err) {
      toast.error('Não gravei: ' + erroAmigavel(err));
    } finally { setSalvando(false); }
  };

  return (
    <Janela titulo="Nova venda" aberta={aberta} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <SeletorCarteira valor={cart} onChange={setCart} titulares={titulares} programas={programas} contas={contas}
          sit={(id: string) => situacaoDaConta(movs.filter((m: any) => m.conta_id === id))} rotulo="Titular e programa que emitem" soComSaldo />
        <Campo rotulo="Cliente">
          <select className={inputCls} value={f.contato} onChange={e => setF({ ...f, contato: e.target.value })}>
            <option value="">Sem cliente</option>
            {contatos.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value="NOVO">+ Novo cliente</option>
          </select>
        </Campo>
        {f.contato === 'NOVO' && <Campo rotulo="Nome do novo cliente"><input required className={inputCls} value={f.novoCliente} onChange={e => setF({ ...f, novoCliente: e.target.value })} /></Campo>}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data da emissão"><input type="date" required className={inputCls} value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo rotulo="Milhas da passagem"><input required inputMode="numeric" className={inputCls} value={f.milhas} onChange={e => setF({ ...f, milhas: e.target.value })} /></Campo>
        </div>
        <Pilulas valor={f.modo} onChange={(v: string) => setF({ ...f, modo: v })} opcoes={[['MILHEIRO', 'Preço do milheiro'], ['TOTAL', 'Valor total']]} />
        <div className="grid grid-cols-2 gap-3">
          {f.modo === 'MILHEIRO'
            ? <Campo rotulo="Milheiro (R$)"><input inputMode="decimal" className={inputCls} value={f.milheiro} onChange={e => setF({ ...f, milheiro: e.target.value })} placeholder="23,50" /></Campo>
            : <Campo rotulo="Valor total (R$)"><input inputMode="decimal" className={inputCls} value={f.total} onChange={e => setF({ ...f, total: e.target.value })} /></Campo>}
          <div className="flex flex-col justify-end text-xs text-zinc-400 pb-3">
            {f.modo === 'MILHEIRO' ? <>Total: <b className="text-white text-sm">{brl(total)}</b></> : <>Milheiro: <b className="text-white text-sm">{brl(milhas > 0 ? total / milhas * 1000 : 0)}</b></>}
          </div>
        </div>
        <Campo rotulo="Taxa de embarque paga por você">
          <select className={inputCls} value={f.taxaEm} onChange={e => setF({ ...f, taxaEm: e.target.value })}>
            <option value="NENHUMA">Nenhuma / o cliente pagou</option>
            <option value="DINHEIRO">Paguei em R$</option>
            <option value="MILHAS">Paguei em milhas</option>
          </select>
        </Campo>
        {f.taxaEm === 'DINHEIRO' && <Campo rotulo="Taxa (R$)"><input inputMode="decimal" className={inputCls} value={f.taxa} onChange={e => setF({ ...f, taxa: e.target.value })} /></Campo>}
        {f.taxaEm === 'MILHAS' && <Campo rotulo="Taxa (milhas)"><input inputMode="numeric" className={inputCls} value={f.taxaMilhas} onChange={e => setF({ ...f, taxaMilhas: e.target.value })} /></Campo>}

        <div className="space-y-2">
          <EditorPassageiros linhas={passageiros} onChange={setPassageiros} cadastro={cadastroPax} />
          {avisoLimite && <p className={cn('text-[11px] flex items-center gap-1', avisoLimite.estoura || avisoLimite.foraDaLista.length ? 'text-red-400 font-bold' : 'text-zinc-500')}>
            {(avisoLimite.estoura || avisoLimite.foraDaLista.length > 0) && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
            {avisoLimite.unidade === 'beneficiários'
              ? (avisoLimite.foraDaLista.length ? `Fora da lista de beneficiários: ${avisoLimite.foraDaLista.join(', ')}. Inclua em Limites antes de emitir.` : `Lista de beneficiários: ${avisoLimite.usados} de ${avisoLimite.limite}`)
              : `${avisoLimite.unidade === 'passagens' ? 'Passagens p/ terceiros (12 meses)' : 'Pessoas no ano'}: ${avisoLimite.depois} de ${avisoLimite.limite}${avisoLimite.estoura ? ' — passa do limite do programa!' : ''}`}
          </p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Recebimento em (parcelas)"><input type="number" min="1" max="24" className={inputCls} value={f.parcelas} onChange={e => setF({ ...f, parcelas: e.target.value })} /></Campo>
          <Campo rotulo="1º recebimento"><input type="date" className={inputCls} value={f.venc1} onChange={e => setF({ ...f, venc1: e.target.value })} /></Campo>
        </div>
        {Number(f.parcelas) === 1 && <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" className="accent-violet-500 w-4 h-4" checked={f.jaRecebido} onChange={e => setF({ ...f, jaRecebido: e.target.checked })} /> Já recebi</label>}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Localizador"><input className={inputCls} value={f.localizador} onChange={e => setF({ ...f, localizador: e.target.value })} /></Campo>
          <Campo rotulo="Observação"><input className={inputCls} value={f.obs} onChange={e => setF({ ...f, obs: e.target.value })} /></Campo>
        </div>

        {contaSel && milhas > 0 && (
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-zinc-400">Cliente paga</span><b>{brl(total)}</b></div>
            <div className="flex justify-between"><span className="text-zinc-400">Custo das milhas ({milhasFmt(milhas + taxaMilhas)})</span><b>− {brl(custo)}</b></div>
            {taxaDinheiro > 0 && <div className="flex justify-between"><span className="text-zinc-400">Taxa em R$</span><b>− {brl(taxaDinheiro)}</b></div>}
            <div className="flex justify-between text-sm pt-1 border-t border-violet-500/20"><span className="text-zinc-300">Lucro</span><b className={lucro >= 0 ? 'text-violet-200' : 'text-red-400'}>{brl(lucro)}{total > 0 ? ` (${Math.round(lucro / total * 100)}%)` : ''}</b></div>
          </div>
        )}
        <BotaoRoxo type="submit" disabled={salvando} className="w-full">{salvando ? 'Gravando...' : 'Gravar venda'}</BotaoRoxo>
      </form>
    </Janela>
  );
}

/* ---------------------------- Detalhe da venda ---------------------------- */
function DetalheVenda({ venda, parcelas, passageiros, nomeConta, nomeContato, onMudou, onApagada }: any) {
  const lucro = lucroDaVenda(venda);
  const marcar = async (p: any) => {
    const paga = p.situacao !== 'PAGA';
    const { error } = await db.from('milhas_parcela').update({ situacao: paga ? 'PAGA' : 'ABERTA', pago_em: paga ? hojeLocal() : null }).eq('id', p.id);
    if (error) toast.error(erroAmigavel(error)); else onMudou();
  };
  const apagar = async () => {
    if (!window.confirm('Apagar esta venda? As milhas voltam para o estoque e as parcelas somem.')) return;
    const { error } = await db.from('milhas_venda').delete().eq('id', venda.id);
    if (error) toast.error(erroAmigavel(error)); else { toast.success('Venda apagada.'); onApagada(); }
  };
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-1">
        <p className="font-bold text-base">{nomeContato(venda.contato_id)}</p>
        <p className="text-zinc-400 text-xs">{dataBR(venda.data)} · {nomeConta(venda.conta_id)}{venda.localizador ? ` · ${venda.localizador}` : ''}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Indicador titulo="Valor" valor={brl(venda.valor_total)} />
        <Indicador titulo="Custo" valor={brl(Number(venda.custo_milhas) + Number(venda.taxa_dinheiro))} />
        <Indicador titulo="Lucro" valor={brl(lucro)} destaque />
      </div>
      <p className="text-xs text-zinc-400">{milhasFmt(venda.milhas)} milhas{venda.taxa_milhas > 0 ? ` + ${milhasFmt(venda.taxa_milhas)} de taxa` : ''}{venda.observacao ? ` · ${venda.observacao}` : ''}</p>
      {passageiros.length > 0 && <div>
        <p className="text-[11px] font-bold uppercase text-zinc-400 mb-1">Passageiros</p>
        {passageiros.map((p: any) => <p key={p.id} className="text-xs text-zinc-300">{p.nome} · {docFmt(p.documento_tipo, p.cpf)}</p>)}
      </div>}
      <div>
        <p className="text-[11px] font-bold uppercase text-zinc-400 mb-1">Recebimento</p>
        <div className="divide-y divide-white/5">
          {parcelas.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 py-2">
              <div className="flex-1 text-xs"><b>{p.numero}/{p.total}</b> · vence {dataBR(p.vencimento)}{p.pago_em ? ` · recebido ${dataBR(p.pago_em)}` : ''}</div>
              <b className="text-xs">{brl(p.valor)}</b>
              <button onClick={() => marcar(p)} className={cn('text-[11px] font-bold px-2 py-1.5 rounded-lg border flex items-center gap-1', p.situacao === 'PAGA' ? 'border-violet-500/30 text-violet-300 bg-violet-500/10' : 'border-white/10 text-zinc-400')}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {p.situacao === 'PAGA' ? 'Recebida' : 'Receber'}
              </button>
            </div>
          ))}
        </div>
      </div>
      <button onClick={apagar} className="text-xs text-red-400 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Apagar venda</button>
    </div>
  );
}
