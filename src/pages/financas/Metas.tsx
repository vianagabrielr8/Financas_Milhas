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
// - Gasto da CASA do mês = despesas - estornos dos centros de custo marcados
//   "conta na meta". Compra no cartão conta no mês da fatura; na conta, no mês da data.
// - Categoria INGRID = despesas - estornos da categoria "Ingrid", pela data.
//   A quinzena (1–15 / 16–fim) usa metade da verba do mês.
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
  const [edicao, setEdicao] = useState<Record<string, { meta_casa: string; verba_ingrid: string }>>({});
  const [novoMes, setNovoMes] = useState('');
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
    queryKey: ['metas_mes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('meta_mes').select('*').order('mes');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['metas_categorias'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categoria_pessoal').select('id, nome');
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
  const gastoCasa = useMemo(() => (gastos?.casa || []).filter((t: any) => idsNaMeta.has(t.centro_custo_id)).reduce((s: number, t: any) => s + valorGasto(t), 0), [gastos, idsNaMeta]);
  const ingridMes = useMemo(() => (gastos?.ingrid || []).reduce((s: number, t: any) => s + valorGasto(t), 0), [gastos]);
  const ehMesAtual = mesSel === chaveMes(hoje);
  const primeiraQuinzena = hoje.getDate() <= 15;
  const ingridQuinzena = useMemo(() => (gastos?.ingrid || [])
    .filter((t: any) => { const dia = Number(String(t.data).slice(8, 10)); return primeiraQuinzena ? dia <= 15 : dia >= 16; })
    .reduce((s: number, t: any) => s + valorGasto(t), 0), [gastos, primeiraQuinzena]);

  const metaSel = metas.find((m: any) => m.mes === mesSel);
  const opcoesMes = useMemo(() => Array.from(new Set([chaveMes(hoje), ...metas.map((m: any) => m.mes)])).sort(), [metas]);
  const nomeMes = (k: string) => { const [a, m] = k.split('-').map(Number); return `${NOMES_MES[m - 1]} de ${a}`; };

  // Trimestre (jan–mar, abr–jun, jul–set, out–dez) do mês escolhido
  const tri = Math.floor((mesNum - 1) / 3);
  const mesesTri = [0, 1, 2].map(i => `${ano}-${String(tri * 3 + i + 1).padStart(2, '0')}-01`);
  const metaTri = mesesTri.reduce((s, k) => s + Number(metas.find((m: any) => m.mes === k)?.meta_casa || 0), 0);

  // ---------- ações ----------
  const salvarMeta = async (m: any) => {
    const e = edicao[m.id]; if (!e) return;
    const { error } = await supabase.from('meta_mes').update({
      meta_casa: Number(e.meta_casa.replace(',', '.')),
      verba_ingrid: e.verba_ingrid === '' ? null : Number(e.verba_ingrid.replace(',', '.')),
    }).eq('id', m.id);
    if (error) return toast.error('Erro ao salvar: ' + error.message);
    toast.success('Meta atualizada.');
    setEdicao(({ [m.id]: _, ...resto }) => resto);
    refetchMetas();
  };

  const adicionarMes = async () => {
    if (!novoMes) return;
    const ultima = metas[metas.length - 1];
    const { error } = await supabase.from('meta_mes').insert([{ mes: `${novoMes}-01`, meta_casa: ultima?.meta_casa || 17000, verba_ingrid: ultima?.verba_ingrid ?? 2800 }]);
    if (error) return toast.error(error.code === '23505' ? 'Esse mês já tem meta.' : 'Erro: ' + error.message);
    setNovoMes(''); refetchMetas();
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

      {!metaSel ? (
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6 text-sm text-zinc-400">
          Não há meta cadastrada para {nomeMes(mesSel)}.{isAdmin && ' Adicione o mês na tabela abaixo.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CartaoMeta titulo={`Casa em ${nomeMes(mesSel)}`} icone={<Home className="w-4 h-4" />} gasto={gastoCasa} meta={Number(metaSel.meta_casa)} />
          {metaSel.verba_ingrid != null && (
            <CartaoMeta titulo="Categoria Ingrid no mês" icone={<User className="w-4 h-4" />} gasto={ingridMes} meta={Number(metaSel.verba_ingrid)} />
          )}
          {metaSel.verba_ingrid != null && ehMesAtual && (
            <CartaoMeta titulo={`Ingrid: ${primeiraQuinzena ? '1ª' : '2ª'} quinzena`} icone={<User className="w-4 h-4" />} gasto={ingridQuinzena}
              meta={Number(metaSel.verba_ingrid) / 2} rodape={primeiraQuinzena ? `até dia 15` : `até dia ${ultimoDia}`} />
          )}
        </div>
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
            <h2 className="font-bold">Metas por mês</h2>
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs text-zinc-500 font-bold uppercase">
              <span>Mês</span><span>Meta da casa</span><span>Verba Ingrid</span><span />
            </div>
            {metas.map((m: any) => {
              const e = edicao[m.id];
              return (
                <div key={m.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                  <span className="text-sm">{nomeMes(m.mes)}</span>
                  <Input value={e ? e.meta_casa : String(m.meta_casa)} onChange={ev => setEdicao(s => ({ ...s, [m.id]: { meta_casa: ev.target.value, verba_ingrid: e ? e.verba_ingrid : String(m.verba_ingrid ?? '') } }))} className="bg-[#141417] border-white/10 h-9" />
                  <Input value={e ? e.verba_ingrid : String(m.verba_ingrid ?? '')} onChange={ev => setEdicao(s => ({ ...s, [m.id]: { meta_casa: e ? e.meta_casa : String(m.meta_casa), verba_ingrid: ev.target.value } }))} className="bg-[#141417] border-white/10 h-9" />
                  <Button size="icon" disabled={!e} onClick={() => salvarMeta(m)} className="h-9 w-9 bg-[#10b981] hover:bg-[#059669] text-black"><Save className="w-4 h-4" /></Button>
                </div>
              );
            })}
            <div className="flex gap-2 pt-2">
              <Input type="month" value={novoMes} onChange={e => setNovoMes(e.target.value)} className="bg-[#141417] border-white/10 h-9 w-48 [color-scheme:dark]" />
              <Button variant="outline" onClick={adicionarMes} className="h-9 border-white/10 bg-transparent text-zinc-300">Adicionar mês</Button>
            </div>
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
