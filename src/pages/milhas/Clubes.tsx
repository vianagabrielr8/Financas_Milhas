import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Ban, CalendarPlus } from 'lucide-react';
import { hojeLocal } from '@/lib/utils';
import {
  db, buscarClubes, buscarTitulares, buscarProgramas, buscarContas, buscarCartoesFinancas, buscarMovimentos, buscarParcelas,
  obterConta, vencimentoNoCartao, somaMeses, lerNumero, milhasFmt, brl, dataBR, milheiro, erroAmigavel, Clube, CartaoFin,
} from '@/lib/milhas';
import { Campo, Pilulas, BotaoRoxo, Cartao, Janela, Vazio, Indicador, inputCls } from '@/components/milhas/ui';

// Data do i-ésimo crédito: no dia do crédito, a partir do mês de início
// (se o dia já passou no mês de início, começa no mês seguinte).
function dataCredito(inicio: string, dia: number, i: number) {
  const [a, m, d] = inicio.split('-').map(Number);
  const mes0 = m - 1 + (d > dia ? 1 : 0) + i;
  const ano = a + Math.floor(mes0 / 12), mes = ((mes0 % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

/** Gera os créditos (pontos do plano + bônus) e as parcelas de pagamento de "meses" meses a partir de "desde". */
async function gerarMeses(c: Clube & { familia_id?: string }, desde: number, meses: number, cartao: CartaoFin | undefined, descricao: string) {
  const custoMes = c.periodicidade === 'MENSAL' ? Number(c.valor) : Math.round((Number(c.valor) / 12) * 100) / 100;
  const movs: any[] = [];
  for (let i = desde; i < desde + meses; i++) {
    const data = dataCredito(c.data_inicio, c.dia_credito, i);
    if (c.pontos_mes > 0) movs.push({ conta_id: c.conta_id, tipo: 'CLUBE', quantidade: c.pontos_mes, custo: custoMes, data, clube_id: c.id, observacao: descricao });
    if (c.bonus_mes > 0) movs.push({ conta_id: c.conta_id, tipo: 'CLUBE_BONUS', quantidade: c.bonus_mes, custo: 0, data, clube_id: c.id, observacao: `${descricao} (bônus)` });
  }
  const parcelas: any[] = [];
  const venc = (dataCobranca: string, k = 0) => c.forma_pagamento === 'CARTAO' ? vencimentoNoCartao(dataCobranca, cartao, k) : somaMeses(dataCobranca, k);
  if (c.periodicidade === 'MENSAL') {
    for (let i = desde; i < desde + meses; i++) {
      const cobranca = somaMeses(c.data_inicio, i);
      parcelas.push({ tipo: 'PAGAR', clube_id: c.id, cartao_id: c.forma_pagamento === 'CARTAO' ? c.cartao_id : null, descricao: `${descricao} – mensalidade`, numero: i + 1, total: (c.meses || i + 1), valor: Number(c.valor), vencimento: venc(cobranca) });
    }
  } else {
    const n = Math.max(1, c.parcelas), base = Math.floor((Number(c.valor) / n) * 100) / 100;
    for (let ano = Math.floor(desde / 12); ano * 12 < desde + meses; ano++) {
      const cobranca = somaMeses(c.data_inicio, ano * 12);
      for (let k = 0; k < n; k++) parcelas.push({
        tipo: 'PAGAR', clube_id: c.id, cartao_id: c.forma_pagamento === 'CARTAO' ? c.cartao_id : null, descricao: `${descricao} – anuidade ${ano + 1}`,
        numero: k + 1, total: n, valor: k === n - 1 ? Math.round((Number(c.valor) - base * (n - 1)) * 100) / 100 : base, vencimento: venc(cobranca, k),
      });
    }
  }
  const { error: e1 } = await db.from('milhas_movimento').insert(movs);
  if (e1) throw e1;
  const { error: e2 } = await db.from('milhas_parcela').insert(parcelas);
  if (e2) throw e2;
}

export default function Clubes() {
  const qc = useQueryClient();
  const clubes = useQuery({ queryKey: ['milhas_clubes'], queryFn: buscarClubes });
  const titulares = useQuery({ queryKey: ['milhas_titulares'], queryFn: buscarTitulares });
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const cartoes = useQuery({ queryKey: ['cartoes_financas'], queryFn: buscarCartoesFinancas });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const parcelas = useQuery({ queryKey: ['milhas_parcelas'], queryFn: buscarParcelas });
  const [novo, setNovo] = useState(false);
  const hoje = hojeLocal();

  const nomeConta = (contaId: string) => {
    const c = contas.data?.find(x => x.id === contaId);
    return c ? `${c.titular} – ${programas.data?.find(p => p.id === c.programa_id)?.nome || '?'}` : '?';
  };
  const recarregar = () => ['milhas_clubes', 'milhas_movimentos', 'milhas_parcelas', 'milhas_contas'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));

  const resumo = useMemo(() => (clubes.data || []).map(c => {
    const creditos = (movs.data || []).filter(m => m.clube_id === c.id);
    const ps = (parcelas.data || []).filter((p: any) => p.clube_id === c.id);
    const recebidos = creditos.filter(m => m.data <= hoje).reduce((a, m) => a + Number(m.quantidade), 0);
    const programados = creditos.reduce((a, m) => a + Number(m.quantidade), 0);
    const pago = ps.filter(p => p.vencimento <= hoje || p.situacao === 'PAGA').reduce((a, p) => a + Number(p.valor), 0);
    const totalPagar = ps.reduce((a, p) => a + Number(p.valor), 0);
    const proximo = creditos.filter(m => m.data > hoje).map(m => m.data).sort()[0];
    const ultimoCredito = creditos.map(m => m.data).sort().at(-1);
    return { c, recebidos, programados, pago, totalPagar, proximo, ultimoCredito, milheiroFinal: milheiro(totalPagar, programados) };
  }), [clubes.data, movs.data, parcelas.data, hoje]);

  const cancelar = async (c: Clube) => {
    if (!window.confirm(`Cancelar "${c.nome_plano}" a partir de hoje? Os créditos e as parcelas futuras (em aberto) serão apagados.`)) return;
    await db.from('milhas_movimento').delete().eq('clube_id', c.id).gt('data', hoje);
    await db.from('milhas_parcela').delete().eq('clube_id', c.id).eq('situacao', 'ABERTA').gt('vencimento', hoje);
    const { error } = await db.from('milhas_clube').update({ ativo: false, cancelado_em: hoje }).eq('id', c.id);
    if (error) toast.error(erroAmigavel(error)); else { toast.success('Clube cancelado.'); recarregar(); }
  };
  const apagar = async (c: Clube) => {
    if (!window.confirm(`Apagar "${c.nome_plano}" e TODOS os créditos e parcelas dele (inclusive os passados)?`)) return;
    await db.from('milhas_movimento').delete().eq('clube_id', c.id);
    const { error } = await db.from('milhas_clube').delete().eq('id', c.id); // parcelas saem junto
    if (error) toast.error(erroAmigavel(error)); else { toast.success('Clube apagado.'); recarregar(); }
  };
  const renovar = async (c: Clube, jaGerados: number) => {
    try {
      await gerarMeses(c, jaGerados, 12, cartoes.data?.find(x => x.id === c.cartao_id), `Clube ${c.nome_plano}`);
      toast.success('Mais 12 meses programados.'); recarregar();
    } catch (e) { toast.error(erroAmigavel(e)); }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto text-zinc-100">
      <div className="flex items-center gap-2">
        <p className="text-sm text-zinc-400 flex-1">Assinaturas que creditam milhas todo mês. O app programa os créditos e as parcelas e calcula o milheiro final.</p>
        <BotaoRoxo onClick={() => setNovo(true)} className="h-10 text-sm shrink-0"><Plus className="w-4 h-4" /> Novo</BotaoRoxo>
      </div>
      {resumo.length === 0 ? <Vazio>Nenhum clube cadastrado.</Vazio> : resumo.map(({ c, recebidos, programados, pago, totalPagar, proximo, milheiroFinal }) => {
        const mesesGerados = new Set((movs.data || []).filter(m => m.clube_id === c.id).map(m => m.data)).size;
        return (
          <Cartao key={c.id} className={c.ativo ? '' : 'opacity-60'}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase text-violet-300 truncate">{nomeConta(c.conta_id)}</p>
                <p className="font-semibold">{c.nome_plano}{!c.ativo && <span className="text-xs text-zinc-500"> (cancelado {dataBR(c.cancelado_em)})</span>}</p>
                <p className="text-[11px] text-zinc-500">
                  {brl(c.valor)} {c.periodicidade === 'MENSAL' ? 'por mês' : `por ano${c.parcelas > 1 ? ` em ${c.parcelas}x` : ''}`} · {c.forma_pagamento === 'CARTAO' ? `cartão ${cartoes.data?.find(x => x.id === c.cartao_id)?.nome || ''}` : c.forma_pagamento === 'PIX' ? 'Pix' : 'boleto'}
                  {' · '}{milhasFmt(c.pontos_mes)}{c.bonus_mes ? ` + ${milhasFmt(c.bonus_mes)} bônus` : ''}/mês, dia {c.dia_credito}
                </p>
              </div>
              {c.ativo && !c.meses && <button onClick={() => renovar(c, mesesGerados)} title="Programar mais 12 meses" className="p-2 text-zinc-400 hover:text-violet-300"><CalendarPlus className="w-4 h-4" /></button>}
              {c.ativo && <button onClick={() => cancelar(c)} title="Cancelar a partir de hoje" className="p-2 text-zinc-400 hover:text-amber-400"><Ban className="w-4 h-4" /></button>}
              <button onClick={() => apagar(c)} title="Apagar" className="p-2 text-zinc-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              <Indicador titulo="Recebido" valor={milhasFmt(recebidos)} sub={`de ${milhasFmt(programados)} programadas`} />
              <Indicador titulo="Pago até hoje" valor={brl(pago)} sub={`de ${brl(totalPagar)}`} />
              <Indicador titulo="Milheiro final" valor={brl(milheiroFinal)} destaque />
              <Indicador titulo="Próximo crédito" valor={proximo ? dataBR(proximo) : '—'} />
            </div>
          </Cartao>
        );
      })}
      <NovoClube aberto={novo} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); recarregar(); }}
        titulares={(titulares.data || []).filter(t => t.ativo)} programas={(programas.data || []).filter(p => p.ativo)} contas={contas.data || []} cartoes={cartoes.data || []} />
    </div>
  );
}

function NovoClube({ aberto, onFechar, onSalvo, titulares, programas, contas, cartoes }: any) {
  const inicial = { titular: '', programa: '', nome_plano: '', valor: '', periodicidade: 'MENSAL', parcelas: '1', forma_pagamento: 'CARTAO', cartao_id: '', data_inicio: hojeLocal(), dia_credito: '', pontos_mes: '', bonus_mes: '', meses: '12', observacao: '' };
  const [f, setF] = useState<any>(inicial);
  const [salvando, setSalvando] = useState(false);
  const valor = lerNumero(f.valor), pontos = lerNumero(f.pontos_mes), bonus = lerNumero(f.bonus_mes);
  const custoMes = f.periodicidade === 'MENSAL' ? valor : valor / 12;
  const mil = milheiro(custoMes, pontos + bonus);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pontos <= 0 || valor <= 0) return toast.error('Informe o valor e os pontos do plano.');
    if (f.forma_pagamento === 'CARTAO' && !f.cartao_id) return toast.error('Escolha o cartão.');
    setSalvando(true);
    try {
      const contaId = await obterConta(f.titular, f.programa, contas);
      const dia = Number(f.dia_credito) || Number(f.data_inicio.slice(8, 10));
      const { data: clube, error } = await db.from('milhas_clube').insert([{
        conta_id: contaId, nome_plano: f.nome_plano.trim(), valor, periodicidade: f.periodicidade, parcelas: f.periodicidade === 'ANUAL' ? Math.max(1, Number(f.parcelas) || 1) : 1,
        forma_pagamento: f.forma_pagamento, cartao_id: f.forma_pagamento === 'CARTAO' ? f.cartao_id : null, data_inicio: f.data_inicio, dia_credito: dia,
        pontos_mes: pontos, bonus_mes: bonus, meses: f.meses ? Number(f.meses) : null, observacao: f.observacao.trim() || null,
      }]).select('*').single();
      if (error) throw error;
      try {
        await gerarMeses(clube, 0, clube.meses || 12, cartoes.find((x: CartaoFin) => x.id === clube.cartao_id), `Clube ${clube.nome_plano}`);
      } catch (err) {
        await db.from('milhas_movimento').delete().eq('clube_id', clube.id);
        await db.from('milhas_clube').delete().eq('id', clube.id);
        throw err;
      }
      toast.success('Clube cadastrado e créditos programados.');
      setF(inicial); onSalvo();
    } catch (err) { toast.error('Não gravei: ' + erroAmigavel(err)); }
    finally { setSalvando(false); }
  };

  return (
    <Janela titulo="Novo clube" aberta={aberto} onFechar={onFechar}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Titular"><select required className={inputCls} value={f.titular} onChange={e => setF({ ...f, titular: e.target.value })}><option value="" disabled>Escolha</option>{titulares.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></Campo>
          <Campo rotulo="Programa"><select required className={inputCls} value={f.programa} onChange={e => setF({ ...f, programa: e.target.value })}><option value="" disabled>Escolha</option>{programas.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
        </div>
        <Campo rotulo="Nome do plano"><input required className={inputCls} value={f.nome_plano} onChange={e => setF({ ...f, nome_plano: e.target.value })} placeholder="Ex.: Clube Smiles 2.000" /></Campo>
        <Pilulas valor={f.periodicidade} onChange={(v: string) => setF({ ...f, periodicidade: v })} opcoes={[['MENSAL', 'Mensal'], ['ANUAL', 'Anual']]} />
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo={f.periodicidade === 'MENSAL' ? 'Valor por mês (R$)' : 'Valor por ano (R$)'}><input required inputMode="decimal" className={inputCls} value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} /></Campo>
          {f.periodicidade === 'ANUAL' && <Campo rotulo="Parcelado em"><input type="number" min="1" max="24" className={inputCls} value={f.parcelas} onChange={e => setF({ ...f, parcelas: e.target.value })} /></Campo>}
        </div>
        <Campo rotulo="Como paga">
          <select className={inputCls} value={f.forma_pagamento} onChange={e => setF({ ...f, forma_pagamento: e.target.value })}>
            <option value="CARTAO">Cartão de crédito</option><option value="PIX">Pix</option><option value="BOLETO">Boleto</option>
          </select>
        </Campo>
        {f.forma_pagamento === 'CARTAO' && <Campo rotulo="Cartão (de Finanças)" dica="As parcelas aparecem em Milhas → Cartões, no mês da fatura.">
          <select required className={inputCls} value={f.cartao_id} onChange={e => setF({ ...f, cartao_id: e.target.value })}><option value="" disabled>Escolha</option>{cartoes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        </Campo>}
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Data de início"><input type="date" required className={inputCls} value={f.data_inicio} onChange={e => setF({ ...f, data_inicio: e.target.value })} /></Campo>
          <Campo rotulo="Dia do crédito" dica="Dia em que os pontos caem no extrato"><input type="number" min="1" max="31" className={inputCls} value={f.dia_credito} placeholder={f.data_inicio.slice(8, 10)} onChange={e => setF({ ...f, dia_credito: e.target.value })} /></Campo>
          <Campo rotulo="Pontos do plano / mês"><input required inputMode="numeric" className={inputCls} value={f.pontos_mes} onChange={e => setF({ ...f, pontos_mes: e.target.value })} /></Campo>
          <Campo rotulo="Bônus do clube / mês"><input inputMode="numeric" className={inputCls} value={f.bonus_mes} onChange={e => setF({ ...f, bonus_mes: e.target.value })} placeholder="0" /></Campo>
        </div>
        <Campo rotulo="Duração (meses)" dica="Vazio = sem prazo: o app programa 12 meses e você renova com um toque."><input type="number" min="1" className={inputCls} value={f.meses} onChange={e => setF({ ...f, meses: e.target.value })} /></Campo>
        <Campo rotulo="Observação"><input className={inputCls} value={f.observacao} onChange={e => setF({ ...f, observacao: e.target.value })} /></Campo>
        {pontos > 0 && valor > 0 && <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3 text-xs flex justify-between"><span className="text-zinc-400">Milheiro do clube</span><b className="text-violet-200">{brl(mil)}</b></div>}
        <BotaoRoxo type="submit" disabled={salvando} className="w-full">{salvando ? 'Gravando...' : 'Cadastrar clube'}</BotaoRoxo>
      </form>
    </Janela>
  );
}
