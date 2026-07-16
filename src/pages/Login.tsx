import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Plane, CheckCircle2 } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/');
      }
    });
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      alert('Erro ao conectar: ' + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#09090b] text-white">
      {/* Lado Esquerdo - Visual Atualizado para Ecossistema Unificado */}
      <div className="hidden lg:flex w-1/2 bg-emerald-950/30 relative items-center justify-center overflow-hidden border-r border-white/5">
        <div className="absolute w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[120px] -top-20 -left-20 animate-pulse" />
        <div className="relative z-10 p-12 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-2xl mb-8">
            <Plane className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-4xl font-bold mb-4 tracking-tight">Finanças & Milhas ERP</h2>
          <p className="text-zinc-400 text-lg max-w-md mx-auto">
            Sua gestão financeira pessoal, profissional e estoque de milhas unificados em um único ecossistema.
          </p>
        </div>
      </div>

      {/* Lado Direito - Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight">Bem-vindo de volta</h1>
            <p className="mt-2 text-zinc-400">Entre com sua conta para acessar o painel.</p>
          </div>

          <div className="space-y-4 mt-8">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white text-zinc-900 font-semibold h-12 px-6 rounded-lg hover:bg-zinc-200 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <img 
                  src="https://www.svgrepo.com/show/475656/google-color.svg" 
                  className="w-5 h-5" 
                  alt="Google" 
                />
              )}
              <span className="text-base">Continuar com Google</span>
            </button>

            <div className="pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 text-sm text-emerald-500 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4" />
                <span>Sistema 100% Seguro e Criptografado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;