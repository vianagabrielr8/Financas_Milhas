import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserPlus, Trash2, Mail, Shield, Eye, X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useFamilia, Papel } from '@/contexts/FamiliaContext';

interface Membro {
  user_id: string;
  nome: string;
  email: string;
  papel: Papel;
  sou_eu: boolean;
}

interface Convite {
  id: string;
  email: string;
  papel: Papel;
  criado_em: string;
}

const NOME_PAPEL: Record<Papel, string> = {
  admin: 'Admin',
  membro: 'Membro',
};

export default function Familia() {
  const { familiaId } = useFamilia();
  const [emailConvite, setEmailConvite] = useState('');
  const [papelConvite, setPapelConvite] = useState<Papel>('membro');
  const [enviando, setEnviando] = useState(false);
  const [nomeEditando, setNomeEditando] = useState<string | null>(null);

  const { data: familia, refetch: refetchFamilia } = useQuery({
    queryKey: ['familia', familiaId],
    queryFn: async () => {
      const { data, error } = await supabase.from('familia').select('id, nome').eq('id', familiaId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!familiaId,
  });

  const { data: membros = [], refetch: refetchMembros } = useQuery({
    queryKey: ['familia_membros', familiaId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_membros_da_familia');
      if (error) throw error;
      return (data || []) as Membro[];
    },
    enabled: !!familiaId,
  });

  const { data: convites = [], refetch: refetchConvites } = useQuery({
    queryKey: ['familia_convites', familiaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('convite_familia')
        .select('id, email, papel, criado_em')
        .is('aceito_em', null)
        .order('criado_em');
      if (error) throw error;
      return (data || []) as Convite[];
    },
    enabled: !!familiaId,
  });

  const salvarNome = async () => {
    const nome = (nomeEditando || '').trim();
    if (!nome) return toast.error('Digite um nome para a família.');
    const { error } = await supabase.from('familia').update({ nome }).eq('id', familiaId);
    if (error) return toast.error('Erro ao renomear: ' + error.message);
    toast.success('Nome da família atualizado.');
    setNomeEditando(null);
    refetchFamilia();
  };

  const convidar = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = emailConvite.trim().toLowerCase();
    if (!email.includes('@')) return toast.error('Digite um e-mail válido.');
    if (membros.some(m => m.email?.toLowerCase() === email)) {
      return toast.error('Essa pessoa já faz parte da família.');
    }

    setEnviando(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('convite_familia').insert([{
      email,
      papel: papelConvite,
      familia_id: familiaId,
      convidado_por: user?.id,
    }]);
    setEnviando(false);

    if (error) {
      if (error.code === '23505') return toast.error('Esse e-mail já tem um convite pendente.');
      return toast.error('Erro ao convidar: ' + error.message);
    }
    toast.success('Convite criado. Avise a pessoa para entrar no app com o Google usando esse e-mail.');
    setEmailConvite('');
    setPapelConvite('membro');
    refetchConvites();
  };

  const cancelarConvite = async (convite: Convite) => {
    if (!confirm(`Cancelar o convite de ${convite.email}?`)) return;
    const { error } = await supabase.from('convite_familia').delete().eq('id', convite.id);
    if (error) return toast.error('Erro ao cancelar: ' + error.message);
    toast.success('Convite cancelado.');
    refetchConvites();
  };

  const mudarPapel = async (membro: Membro) => {
    const novo: Papel = membro.papel === 'admin' ? 'membro' : 'admin';
    const aviso = novo === 'admin'
      ? `Tornar ${membro.nome} ADMIN? Ele(a) poderá lançar, editar, apagar e mexer nas configurações.`
      : `Tornar ${membro.nome} MEMBRO? Ele(a) passará só a consultar.`;
    if (!confirm(aviso)) return;
    const { error } = await supabase.from('familia_membro').update({ papel: novo }).eq('user_id', membro.user_id);
    if (error) return toast.error('Erro ao mudar papel: ' + error.message);
    toast.success('Papel atualizado.');
    refetchMembros();
  };

  const remover = async (membro: Membro) => {
    if (!confirm(`Remover ${membro.nome} da família? Ele(a) perde o acesso aos dados da família.`)) return;
    const { error } = await supabase.from('familia_membro').delete().eq('user_id', membro.user_id);
    if (error) return toast.error('Erro ao remover: ' + error.message);
    toast.success('Pessoa removida da família.');
    refetchMembros();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto text-zinc-100">
      <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <Users className="w-5 h-5 text-[#10b981]" />
          {nomeEditando === null ? (
            <>
              <h2 className="text-lg font-bold">{familia?.nome || 'Minha família'}</h2>
              <button onClick={() => setNomeEditando(familia?.nome || '')} className="text-xs text-zinc-500 hover:text-white underline">
                renomear
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <Input value={nomeEditando} onChange={e => setNomeEditando(e.target.value)} className="bg-[#141417] border-white/10 h-9 max-w-xs" />
              <Button size="icon" onClick={salvarNome} className="h-9 w-9 bg-[#10b981] hover:bg-[#059669] text-black"><Save className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setNomeEditando(null)} className="h-9 w-9 text-zinc-400"><X className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
        <p className="text-sm text-zinc-400">
          <b className="text-zinc-300">Admin</b> faz tudo. <b className="text-zinc-300">Membro</b> só consulta no app e lança despesas pelo bot do Telegram.
        </p>
      </div>

      <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Pessoas da família</h3>
        <div className="divide-y divide-white/5">
          {membros.map(m => (
            <div key={m.user_id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">
                  {m.nome} {m.sou_eu && <span className="text-[10px] text-zinc-500 font-normal">(você)</span>}
                </p>
                <p className="text-xs text-zinc-500 truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={m.papel === 'admin'
                  ? 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/20 text-[#10b981] flex items-center gap-1'
                  : 'text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300 flex items-center gap-1'}>
                  {m.papel === 'admin' ? <Shield className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {NOME_PAPEL[m.papel]}
                </span>
                {!m.sou_eu && (
                  <>
                    <Button variant="ghost" onClick={() => mudarPapel(m)} className="h-8 text-xs text-zinc-400 hover:text-white">
                      Tornar {m.papel === 'admin' ? 'membro' : 'admin'}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remover(m)} className="h-8 w-8 text-zinc-500 hover:text-red-400" title="Remover da família">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Convidar pessoa</h3>
        <form onSubmit={convidar} className="flex flex-col md:flex-row gap-3">
          <Input
            type="email"
            placeholder="e-mail do Google da pessoa"
            value={emailConvite}
            onChange={e => setEmailConvite(e.target.value)}
            className="bg-[#141417] border-white/10 h-10 flex-1"
          />
          <select
            value={papelConvite}
            onChange={e => setPapelConvite(e.target.value as Papel)}
            className="bg-[#141417] border border-white/10 rounded-md h-10 px-3 text-sm text-zinc-200"
          >
            <option value="membro">Membro (só consulta)</option>
            <option value="admin">Admin (faz tudo)</option>
          </select>
          <Button type="submit" disabled={enviando} className="bg-[#10b981] hover:bg-[#059669] text-black font-bold h-10 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Convidar
          </Button>
        </form>
        <p className="text-xs text-zinc-500">
          A pessoa só precisa entrar no app com o Google usando esse e-mail: ela já cai na sua família com o papel escolhido.
        </p>

        {convites.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Convites aguardando a pessoa entrar</p>
            <div className="divide-y divide-white/5">
              {convites.map(c => (
                <div key={c.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span className="text-sm text-zinc-300 truncate">{c.email}</span>
                    <span className="text-[10px] text-zinc-500">({NOME_PAPEL[c.papel]})</span>
                  </div>
                  <Button variant="ghost" onClick={() => cancelarConvite(c)} className="h-8 text-xs text-zinc-500 hover:text-red-400">
                    Cancelar convite
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
