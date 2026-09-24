import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Send, CheckCircle2, Unlink, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Nome do bot no Telegram (opcional). Ex.: VITE_TELEGRAM_BOT_USERNAME=MeuBot
const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;

export default function Telegram() {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);

  // Vínculo do usuário logado (a regra do banco só mostra o próprio / da família).
  const { data: vinculo, refetch } = useQuery({
    queryKey: ['telegram_vinculo_meu'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('telegram_vinculo')
        .select('telegram_user_id, criado_em')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // Enquanto há um código na tela, confere a cada 5s se a pessoa já mandou no bot.
    refetchInterval: codigo ? 5000 : false,
  });

  const conectado = !!vinculo;

  const gerarCodigo = async () => {
    setGerando(true);
    const { data, error } = await supabase.rpc('gerar_codigo_telegram');
    setGerando(false);
    if (error) return toast.error('Erro ao gerar código: ' + error.message);
    setCodigo(data as string);
  };

  const desconectar = async () => {
    if (!confirm('Desconectar seu Telegram? O bot deixa de aceitar suas mensagens até você conectar de novo.')) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('telegram_vinculo').delete().eq('user_id', user?.id);
    if (error) return toast.error('Erro ao desconectar: ' + error.message);
    toast.success('Telegram desconectado.');
    setCodigo(null);
    refetch();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto text-zinc-100">
      <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-bold">Bot do Telegram</h2>
        </div>
        <p className="text-sm text-zinc-400">
          Conecte o seu Telegram para lançar despesas pelo bot. Tudo que você mandar vai para a sua família, com o seu nome como quem lançou.
        </p>
      </div>

      {conectado ? (
        <div className="bg-[#1e1e24] border border-emerald-500/20 rounded-2xl p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <div>
              <p className="font-semibold">Telegram conectado</p>
              <p className="text-xs text-zinc-500">
                Desde {new Date(vinculo!.criado_em).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={desconectar} className="text-zinc-400 hover:text-red-400 flex items-center gap-2">
            <Unlink className="w-4 h-4" /> Desconectar
          </Button>
        </div>
      ) : (
        <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-6 space-y-5">
          {!codigo ? (
            <>
              <p className="text-sm text-zinc-300">Seu Telegram ainda não está conectado.</p>
              <Button onClick={gerarCodigo} disabled={gerando} className="bg-[#10b981] hover:bg-[#059669] text-black font-bold flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Gerar código de conexão
              </Button>
            </>
          ) : (
            <>
              <ol className="text-sm text-zinc-300 space-y-2 list-decimal list-inside">
                <li>
                  Abra o bot no Telegram
                  {BOT_USERNAME && (
                    <> (<a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noreferrer" className="text-sky-400 underline">@{BOT_USERNAME}</a>)</>
                  )}.
                </li>
                <li>Envie esta mensagem:</li>
              </ol>
              <div className="bg-[#141417] border border-white/10 rounded-xl p-4 text-center">
                <code className="text-2xl font-bold tracking-widest text-emerald-400">/vincular {codigo}</code>
              </div>
              <p className="text-xs text-zinc-500">
                O código vale 10 minutos. Esta tela avisa sozinha quando a conexão der certo.
              </p>
              <Button variant="ghost" onClick={gerarCodigo} className="text-xs text-zinc-400 hover:text-white">
                Gerar outro código
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
