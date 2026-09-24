import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Target, Home, User, Gift, Plus, Trash2, Save, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useFamilia } from '@/contexts/FamiliaContext';

// ------------------------------------------------------------------
// Regras do jogo (Pacote 3):
// - Cada CATEGORIA tem meta por mês (tabela meta_categoria). A meta da CASA
//   é a soma delas.
// - Gasto da CASA = despesas - estornos dos centros "conta na meta", só das
//   categorias que têm meta no mês + "Sem categoria". Categoria sem meta
//   (ex.: Investimentos) fica fora do placar. Cartão conta no mês da fatura;
//   conta bancária, no mês da data.
// - Categoria INGRID (verba = meta dela): no MÊS, conta igual às barras
//   (cartão pelo mês da fatura). Na QUINZENA (1–15 / 16–fim), conta as
//   compras feitas no período (pela data), com metade da verba do mês.
// - PAGAMENTO_FATURA e RECEITA nunca contam como gasto.
// ------------------------------------------------------------------

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const NIVEL: Record<string, string> = { QUINZENA: '🥉 Quinzena', MES: '🥈 Mês', TRIMESTRE: '🥇 Trimestre' };

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const normalizar = (t: string) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
const valorGasto = (t: any) => (t.tipo === 'ESTORNO' ? -1 : t.tipo === 'DESPESA' ? 1 : 0) * Math.abs(Number(t.valor) || 0);

// O Supabase devolve no máximo 1000 linhas por vez: busca em páginas.
async function buscarTudo(montar: () => any) {
  const todas: any[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await montar().range(i, i + 999);
    if (error) throw error;
    todas.push(...(data || []));
    if (!data || data.length < 1000) return todas;
  }
}

function Barra({ gasto, meta }: { gasto: number; meta: number }) {
  const pct = meta > 0 ? (gasto / meta) * 100 : 0;
  const cor = pct <= 80 ? 'bg-emerald-500' : pct <= 100 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="h-2.5 bg-black/40 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', cor)} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function CartaoMeta({ titulo, icone, gasto, meta, rodape }: { titulo: string; icone: React.ReactNode; gasto: number; meta: number; rodape?: string }) {
  const livre = meta - gasto;
  return (
    <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-xs font-medium flex items-center gap-2">{icone} {titulo}</p>
        <p className="text-[11px] text-zinc-500">meta {brl(meta)}</p>
      </div>
      <p className={cn('text-2xl font-bold', livre >= 0 ? 'text-emerald-400' : 'text-red-400')}>
        {livre >= 0 ? `${brl(livre)} livres` : `${brl(-livre)} acima`}
      </p>
      <Barra gasto={gasto} meta={meta} />
      <p className="text-[11px] text-zinc-500">Gasto: {brl(gasto)}{rodape ? ` • ${rodape}` : ''}</p>
    </div>
  );
}

export default function Metas() {
  const { isAdmin } = useFamilia();
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(chaveMes(hoje));
  const [edicao, setEdicao] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [desejoTitulo, setDesejoTitulo] = useState('');
  const [desejoValor, setDesejoValor] = useState('');
  const [desejoNivel, setDesejoNivel] = useState('MES');

  const { data: centros = [], refetch: refetchCentros } = useQuery({
    queryKey: ['metas_centros'],
    queryFn: async () => {
      const { data, error } = await supabase.from('centro_custo_projeto').select('id, nome, conta_na_meta').order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: metas = [], refetch: refetchMetas } = useQuery({
    queryKey: ['meta_categoria'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meta_categoria').select('id, mes, categoria_id, valor').order('mes');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['metas_categorias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categoria_pessoal').select('id, nome, centro_custo_id').order('nome');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: desejos = [], refetch: refetchDesejos } = useQuery({
    queryKey: ['desejos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('desejo').select('*').order('criado_em');
      if (error) throw error;
      return data || [];
    },
  });

  const idIngrid = useMemo(() => categorias.find((c: any) => normalizar(c.nome) === 'ingrid')?.id, [categorias]);
  const [ano, mesNum] = mesSel.split('-').map(Number);
  const inicio = mesSel;
  const fim = chaveMes(new Date(ano, mesNum, 1)); // 1º dia do mês seguinte
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  const rotuloFatura = `${MESES[mesNum - 1]}/${ano}`;

  const { data: gastos } = useQuery({
    queryKey: ['metas_gastos', mesSel, idIngrid],
    queryFn: async () => {
      const cols = 'valor, tipo, centro_custo_id, categoria_id, data';
      const [cartao, conta, ingrid] = await Promise.all([
        buscarTudo(() => supabase.from('transacao_pessoal').select(cols).not('cartao_id', 'is', null).eq('mes_fatura', rotuloFatura).order('id')),
        buscarTudo(() => supabase.from('transacao_pessoal').select(cols).is('cartao_id', null).gte('data', inicio).lt('data', fim).order('id')),
        idIngrid
          ? buscarTudo(() => supabase.from('transacao_pessoal').select(cols).eq('categoria_id', idIngrid).gte('data', inicio).lt('data', fim).order('id'))
          : Promise.resolve([]),
      ]);
      return { casa: [...cartao, ...conta], ingrid };
    },
  });

  const idsNaMeta = useMemo(() => new Set(centros.filter((c: any) => c.conta_na_meta).map((c: any) => c.id)), [centros]);
  const metasDoMes = useMemo(() => metas.filter((m: any) => m.mes === mesSel), [metas, mesSel]);
  const metaPorCat = useMemo(() => new Map(metasDoMes.map((m: any) => [m.categoria_id, Number(m.valor)])), [metasDoMes]);
  const metaCasa = metasDoMes.reduce((s: number, m: any) => s + Number(m.valor), 0);
  // gasto por categoria (só centros que contam na meta); '' = sem categoria
  const gastoPorCat = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const t of gastos?.casa || []) {
      if (!idsNaMeta.has(t.centro_custo_id)) continue;
      const k = t.categoria_id || '';
      mapa.set(k, (mapa.get(k) || 0) + valorGasto(t));
    }
    return mapa;
  }, [gastos, idsNaMeta]);
  const gastoCasa = useMemo(() => Array.from(gastoPorCat.entries())
    .filter(([k]) => k === '' || metaPorCat.has(k)).reduce((s, [, v]) => s + v, 0), [gastoPorCat, metaPorCat]);
  const foraDoPlacar = useMemo(() => Array.from(gastoPorCat.entries())
    .filter(([k, v]) => k !== '' && !metaPorCat.has(k) && Math.abs(v) > 0.009), [gastoPorCat, metaPorCat]);
  const nomeCat = (id: string) => id === '' ? 'Sem categoria' : (categorias.find((c: any) => c.id === id)?.nome || '?');
  // categorias que o admin pode ter meta: as dos centros que contam na meta
  const categoriasDaCasa = useMemo(() => categorias.filter((c: any) => idsNaMeta.has(c.centro_custo_id)), [categorias, idsNaMeta]);
  // Mês da Ingrid: mesma conta das barras (cartão pelo mês da fatura), para os números baterem.
  const ingridMes = idIngrid ? (gastoPorCat.get(idIngrid) || 0) : 0;
  const ehMesAtual = mesSel === chaveMes(hoje);
  const primeiraQuinzena = hoje.getDate() <= 15;
  const ingridQuinzena = useMemo(() => (gastos?.ingrid || [])
    .filter((t: any) => { const dia = Number(String(t.data).slice(8, 10)); return primeiraQuinzena ? dia <= 15 : dia >= 16; })
    .reduce((s: number, t: any) => s + valorGasto(t), 0), [gastos, primeiraQuinzena]);

  const verbaIngrid = idIngrid ? metaPorCat.get(idIngrid) : undefined;
  const opcoesMes = useMemo(() => {
    const prox = Array.from({ length: 6 }, (_, i) => chaveMes(new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)));
    return Array.from(new Set([...prox, ...metas.map((m: any) => m.mes)])).sort();
  }, [metas]);
  const nomeMes = (k: string) => { const [a, m] = k.split('-').map(Number); return `${NOMES_MES[m - 1]} de ${a}`; };

  // Trimestre (jan–mar, abr–jun, jul–set, out–dez) do mês escolhido
  const tri = Math.floor((mesNum - 1) / 3);
  const mesesTri = [0, 1, 2].map(i => `${ano}-${String(tri * 3 + i + 1).padStart(2, '0')}-01`);
  const metaTri = metas.filter((m: any) => mesesTri.includes(m.mes)).reduce((s: number, m: any) => s + Number(m.valor), 0);

  // ---------- ações ----------
  // Salva as metas do mês escolhido: valor vazio = sem meta (apaga).
  const salvarMetas = async () => {
    setSalvando(true);
    try {
      for (const [catId, texto] of Object.entries(edicao)) {
        const existente = metasDoMes.find((m: any) => m.categoria_id === catId);
        const valor = texto.trim() === '' ? null : Number(texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto);
        if (valor !== null && (isNaN(valor) || valor < 0)) { toast.error(`Valor inválido em ${nomeCat(catId)}`); continue; }
        const { error } = valor === null
          ? (existente ? await supabase.from('meta_categoria').delete().eq('id', existente.id) : { error: null })
          : existente
            ? await supabase.from('meta_categoria').update({ valor }).eq('id', existente.id)
            : await supabase.from('meta_categoria').insert([{ mes: mesSel, categoria_id: catId, valor }]);
        if (error) toast.error(`${nomeCat(catId)}: ${error.message}`);
      }
      toast.success('Metas salvas.');
      setEdicao({});
      refetchMetas();
    } finally { setSalvando(false); }
  };

  const copiarMesAnterior = async () => {
    const anterior = chaveMes(new Date(ano, mesNum - 2, 1));
    const doAnterior = metas.filter((m: any) => m.mes === anterior);
    if (doAnterior.length === 0) return toast.error('O mês anterior não tem metas.');
    if (metasDoMes.length > 0 && !confirm('Este mês já tem metas. Substituir pelas do mês anterior?')) return;
    if (metasDoMes.length > 0) await supabase.from('meta_categoria').delete().eq('mes', mesSel);
    const { error } = await supabase.from('meta_categoria').insert(doAnterior.map((m: any) => ({ mes: mesSel, categoria_id: m.categoria_id, valor: m.valor })));
    if (error) return toast.error('Erro: ' + error.message);
    toast.success('Metas copiadas.'); setEdicao({}); refetchMetas();
  };

  const alternarCentro = async (c: any) => {
    const { error } = await supabase.from('centro_custo_projeto').update({ conta_na_meta: !c.conta_na_meta }).eq('id', c.id);
    if (error) return toast.error('Erro: ' + error.message);
    refetchCentros();
  };

  const adicionarDesejo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desejoTitulo.trim()) return toast.error('Diga o que é o desejo.');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('desejo').insert([{
      titulo: desejoTitulo.trim(),
      valor: desejoValor ? Number(desejoValor.replace(',', '.')) : null,
      nivel: desejoNivel,
      criado_por: user?.id,
    }]);
    if (error) return toast.error('Erro: ' + error.message);
    setDesejoTitulo(''); setDesejoValor(''); refetchDesejos();
  };

  const mudarSituacao = async (d: any, situacao: string) => {
    const { error } = await supabase.from('desejo').update({ situacao }).eq('id', d.id);
    if (error) return toast.error('Erro: ' + error.message);
    refetchDesejos();
  };

  const apagarDesejo = async (d: any) => {
    if (!confirm(`Apagar "${d.titulo}" da lista?`)) return;
    const { error } = await supabase.from('desejo').delete().eq('id', d.id);
    if (error) return toast.error('Erro: ' + error.message);
    refetchDesejos();
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto text-zinc-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#141417] p-4 rounded-xl border border-white/5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Target className="w-6 h-6 text-emerald-500" /> Metas da Casa</h1>
          <p className="text-zinc-400 text-xs mt-0.5">Quanto ainda está livre no mês, no trimestre e na quinzena.</p>
        </div>
        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
          <CalendarDays className="w-4 h-4 text-zinc-400" />
          <select value={mesSel} onChange={e => setMesSel(e.target.value)} className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer">
            {opcoesMes.map(k => <option key={k} value={k} className="bg-[#141417]">{nomeMes(k)}</option>)}
          </select>
        </div>
      </div>

      {metasDoMes.length === 0 ? (
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6 text-sm text-zinc-400">
          Não há metas cadastradas para {nomeMes(mesSel)}.{isAdmin && ' Defina abaixo ou copie do mês anterior.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CartaoMeta titulo={`Casa em ${nomeMes(mesSel)}`} icone={<Home className="w-4 h-4" />} gasto={gastoCasa} meta={metaCasa} />
            {verbaIngrid != null && (
              <CartaoMeta titulo="Categoria Ingrid no mês" icone={<User className="w-4 h-4" />} gasto={ingridMes} meta={verbaIngrid} />
            )}
            {verbaIngrid != null && ehMesAtual && (
              <CartaoMeta titulo={`Ingrid: ${primeiraQuinzena ? '1ª' : '2ª'} quinzena`} icone={<User className="w-4 h-4" />} gasto={ingridQuinzena}
                meta={verbaIngrid / 2} rodape={primeiraQuinzena ? 'até dia 15' : `até dia ${ultimoDia}`} />
            )}
          </div>

          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6 space-y-3">
            <h2 className="font-bold">Por categoria</h2>
            <p className="text-[11px] text-zinc-500 -mt-1">
              <span className="text-emerald-400">● até 80%</span> &nbsp; <span className="text-amber-400">● 80% a 100%</span> &nbsp; <span className="text-red-400">● acima da meta</span>
            </p>
            {/* Do maior gasto para o menor; "Sem categoria" sempre por último */}
            {[...metasDoMes.map((m: any) => m.categoria_id)]
              .sort((a: string, b: string) => (gastoPorCat.get(b) || 0) - (gastoPorCat.get(a) || 0))
              .concat(gastoPorCat.has('') ? [''] : [])
              .map((catId: string) => {
              const meta = metaPorCat.get(catId) ?? 0;
              const gasto = gastoPorCat.get(catId) || 0;
              const livre = meta - gasto;
              const pct = meta > 0 ? (gasto / meta) * 100 : 0;
              const corTexto = catId === '' ? 'text-zinc-400' : pct <= 80 ? 'text-emerald-400' : pct <= 100 ? 'text-amber-400' : 'text-red-400';
              return (
                <div key={catId || 'sem'} className="space-y-1">
                  <div className="flex justify-between items-baseline gap-3 text-sm">
                    <span className="font-semibold">{nomeCat(catId)}</span>
                    <span className="text-xs text-zinc-400 text-right">
                      {catId === '' ? (
                        <>{brl(gasto)} • <span className="text-amber-400">sem meta: classifique esses lançamentos</span></>
                      ) : (
                        <>
                          {brl(gasto)} de {brl(meta)} •{' '}
                          <span className={cn('font-bold', corTexto)}>
                            {Math.round(pct)}% • {livre >= 0 ? `${brl(livre)} livres` : `${brl(-livre)} acima`}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  {catId !== '' && <Barra gasto={gasto} meta={meta} />}
                </div>
              );
            })}
            {foraDoPlacar.length > 0 && (
              <p className="text-[11px] text-zinc-500 pt-2">
                Fora do placar (sem meta neste mês): {foraDoPlacar.map(([k, v]) => `${nomeCat(k)} ${brl(v)}`).join(' • ')}
              </p>
            )}
          </div>
        </>
      )}

      {metaTri > 0 && (
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 text-sm text-zinc-300">
          🥇 <b>Trimestre ({mesesTri.map(k => MESES[Number(k.slice(5, 7)) - 1]).join('/')} {ano}):</b> meta somada da casa de <b>{brl(metaTri)}</b>.
          Um mês bom compensa um mês ruim. O acompanhamento completo do trimestre vem no painel do jogo.
        </div>
      )}

      {/* Lista de desejos */}
      <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><Gift className="w-5 h-5 text-pink-400" /> Lista de desejos (prêmios)</h2>
        <form onSubmit={adicionarDesejo} className="flex flex-col md:flex-row gap-2">
          <Input placeholder="O que você quer ganhar?" value={desejoTitulo} onChange={e => setDesejoTitulo(e.target.value)} className="bg-[#141417] border-white/10 flex-1" />
          <Input placeholder="Valor (R$)" value={desejoValor} onChange={e => setDesejoValor(e.target.value)} className="bg-[#141417] border-white/10 md:w-36" />
          <select value={desejoNivel} onChange={e => setDesejoNivel(e.target.value)} className="bg-[#141417] border border-white/10 rounded-md h-10 px-3 text-sm">
            <option value="QUINZENA">🥉 Quinzena (pequeno)</option>
            <option value="MES">🥈 Mês (médio)</option>
            <option value="TRIMESTRE">🥇 Trimestre (grande)</option>
          </select>
          <Button type="submit" className="bg-[#10b981] hover:bg-[#059669] text-black font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
        </form>
        {(['TRIMESTRE', 'MES', 'QUINZENA'] as const).map(nv => {
          const lista = desejos.filter((d: any) => d.nivel === nv);
          if (lista.length === 0) return null;
          return (
            <div key={nv}>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{NIVEL[nv]}</p>
              <div className="divide-y divide-white/5">
                {lista.map((d: any) => (
                  <div key={d.id} className="py-2 flex items-center justify-between gap-3">
                    <span className={cn('text-sm', d.situacao === 'ENTREGUE' && 'line-through text-zinc-500')}>
                      {d.titulo}{d.valor != null && <span className="text-zinc-500"> • {brl(Number(d.valor))}</span>}
                      {d.situacao === 'CONQUISTADO' && <span className="ml-2 text-[10px] font-bold text-emerald-400">🏆 conquistado</span>}
                      {d.situacao === 'ENTREGUE' && <span className="ml-2 text-[10px] font-bold text-zinc-500">✅ entregue</span>}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && (
                        <select value={d.situacao} onChange={e => mudarSituacao(d, e.target.value)} className="bg-[#141417] border border-white/10 rounded-md h-8 px-2 text-xs">
                          <option value="DESEJADO">Desejado</option>
                          <option value="CONQUISTADO">Conquistado</option>
                          <option value="ENTREGUE">Entregue</option>
                        </select>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => apagarDesejo(d)} className="h-8 w-8 text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuração: só o admin mexe */}
      {isAdmin && (
        <>
          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Metas de {nomeMes(mesSel)} por categoria</h2>
              <Button variant="outline" onClick={copiarMesAnterior} className="h-8 text-xs border-white/10 bg-transparent text-zinc-300">Copiar do mês anterior</Button>
            </div>
            <p className="text-xs text-zinc-500">Deixe em branco para a categoria ficar sem meta (fora do placar). Soma atual: <b className="text-zinc-300">{brl(metaCasa)}</b></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {categoriasDaCasa.map((c: any) => {
                const atual = metaPorCat.get(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-3 bg-[#141417] border border-white/5 rounded-lg px-3 py-1.5">
                    <span className="text-sm flex-1">{c.nome}</span>
                    <Input value={edicao[c.id] ?? (atual != null ? String(atual) : '')} placeholder="sem meta"
                      onChange={ev => setEdicao(s => ({ ...s, [c.id]: ev.target.value }))} className="bg-black/30 border-white/10 h-8 w-32 text-right" />
                  </label>
                );
              })}
            </div>
            <Button onClick={salvarMetas} disabled={salvando || Object.keys(edicao).length === 0} className="bg-[#10b981] hover:bg-[#059669] text-black font-bold flex items-center gap-2"><Save className="w-4 h-4" /> Salvar metas</Button>
          </div>

          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6 space-y-3">
            <h2 className="font-bold">O que conta na meta da casa</h2>
            <p className="text-xs text-zinc-500">Marque só os centros de custo que são gasto da casa. Os outros continuam no app, mas não entram no placar do jogo.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {centros.map((c: any) => (
                <label key={c.id} className="flex items-center gap-3 bg-[#141417] border border-white/5 rounded-lg px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={!!c.conta_na_meta} onChange={() => alternarCentro(c)} className="accent-emerald-500 w-4 h-4" />
                  <span className="text-sm">{c.nome}</span>
                  <span className={cn('ml-auto text-[10px] font-bold', c.conta_na_meta ? 'text-emerald-400' : 'text-zinc-500')}>{c.conta_na_meta ? 'conta na meta' : 'fora da meta'}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
