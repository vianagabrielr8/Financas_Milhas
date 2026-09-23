import { ShieldAlert, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  // true = o banco não respondeu (tenta de novo); false = e-mail não liberado.
  erro?: boolean;
  onTentarNovamente: () => void;
}

export default function AcessoNaoLiberado({ erro = false, onTentarNovamente }: Props) {
  const sair = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 text-zinc-100">
      <div className="max-w-md w-full bg-[#1e1e24] border border-white/5 rounded-2xl p-8 text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-amber-400" />
        </div>
        <h1 className="text-xl font-bold">
          {erro ? 'Não foi possível verificar seu acesso' : 'Acesso não liberado'}
        </h1>
        <p className="text-sm text-zinc-400">
          {erro
            ? 'Houve uma falha de comunicação. Tente de novo em alguns segundos.'
            : 'Este e-mail ainda não foi liberado nem convidado para uma família. Peça ao administrador para liberar ou convidar o seu e-mail e depois entre de novo.'}
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Button onClick={onTentarNovamente} className="bg-[#10b981] hover:bg-[#059669] text-black font-bold flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Tentar de novo
          </Button>
          <Button onClick={sair} variant="outline" className="border-white/10 bg-transparent hover:bg-white/5 text-zinc-300 flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
