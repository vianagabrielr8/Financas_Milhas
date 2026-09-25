import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MainLayout } from "./components/layout/MainLayout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

// IMPORTS MILHAS
import PainelMilhas from "./pages/milhas/Painel";
import LancarMilhas from "./pages/milhas/Lancar";
import EstoqueMilhas from "./pages/milhas/Estoque";
import ContaHistorico from "./pages/milhas/ContaHistorico";
import TitularesMilhas from "./pages/milhas/Titulares";
import ProgramasMilhas from "./pages/milhas/Programas";
import PassageirosMilhas from "./pages/milhas/Passageiros";
import ContatosMilhas from "./pages/milhas/Contatos";
import ClubesMilhas from "./pages/milhas/Clubes";
import CartoesMilhas from "./pages/milhas/CartoesMilhas";
import VendasMilhas from "./pages/milhas/Vendas";
import ContasReceberPagar from "./pages/milhas/ContasReceberPagar";
import LimitesCpf from "./pages/milhas/LimitesCpf";

// IMPORTS FINANÇAS
import FinancasDashboard from "./pages/financas/FinancasDashboard";
import Contas from "./pages/financas/Contas";
import Transacoes from "./pages/financas/Transacoes";
import FluxoCaixa from "./pages/financas/FluxoCaixa";
import Cartoes from "./pages/financas/Cartoes";
import FaturaCartao from "./pages/financas/FaturaCartao";
import CentrosCusto from './pages/financas/CentrosCusto';
import Categorias from './pages/financas/Categorias';
import Metas from "./pages/financas/Metas";

// FAMÍLIA E ACESSO
import { FamiliaProvider, useFamilia } from "./contexts/FamiliaContext";
import AcessoNaoLiberado from "./pages/AcessoNaoLiberado";
import Familia from "./pages/configuracoes/Familia";
import Telegram from "./pages/configuracoes/Telegram";
import Contestacoes from "./pages/configuracoes/Contestacoes";

const queryClient = new QueryClient();

// Páginas que o MEMBRO não acessa (configurações, cadastros e o módulo Milhas).
// Os botões de lançar/editar/apagar também somem para ele nas outras páginas.
const SomenteAdmin = ({ children }: { children: JSX.Element }) => {
  const { isAdmin } = useFamilia();
  return isAdmin ? children : <Navigate to="/financas" replace />;
};

const AppLogado = () => {
  const { situacao, recarregar } = useFamilia();

  if (situacao === 'CARREGANDO') {
    return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-emerald-500 font-bold tracking-widest uppercase">Carregando...</div>;
  }
  if (situacao !== 'OK') {
    return <AcessoNaoLiberado erro={situacao === 'ERRO'} onTentarNovamente={recarregar} />;
  }

  return (
    <MainLayout>
      <Routes>
        {/* Depois do login, cai sempre no painel de Finanças. O painel de Milhas fica em /milhas. */}
        <Route path="/" element={<Navigate to="/financas" replace />} />
        <Route path="/login" element={<Navigate to="/financas" replace />} />
        <Route path="/milhas" element={<SomenteAdmin><PainelMilhas /></SomenteAdmin>} />
        <Route path="/milhas/lancar" element={<SomenteAdmin><LancarMilhas /></SomenteAdmin>} />
        <Route path="/milhas/estoque" element={<SomenteAdmin><EstoqueMilhas /></SomenteAdmin>} />
        <Route path="/milhas/estoque/:id" element={<SomenteAdmin><ContaHistorico /></SomenteAdmin>} />
        <Route path="/milhas/cadastros" element={<Navigate to="/milhas/titulares" replace />} />
        <Route path="/milhas/titulares" element={<SomenteAdmin><TitularesMilhas /></SomenteAdmin>} />
        <Route path="/milhas/programas" element={<SomenteAdmin><ProgramasMilhas /></SomenteAdmin>} />
        <Route path="/milhas/passageiros" element={<SomenteAdmin><PassageirosMilhas /></SomenteAdmin>} />
        <Route path="/milhas/clientes" element={<SomenteAdmin><ContatosMilhas /></SomenteAdmin>} />
        <Route path="/milhas/clubes" element={<SomenteAdmin><ClubesMilhas /></SomenteAdmin>} />
        <Route path="/milhas/cartoes" element={<SomenteAdmin><CartoesMilhas /></SomenteAdmin>} />
        <Route path="/milhas/vendas" element={<SomenteAdmin><VendasMilhas /></SomenteAdmin>} />
        <Route path="/milhas/receber-pagar" element={<SomenteAdmin><ContasReceberPagar /></SomenteAdmin>} />
        <Route path="/milhas/limites-cpf" element={<SomenteAdmin><LimitesCpf /></SomenteAdmin>} />

        <Route path="/financas" element={<FinancasDashboard />} />
        <Route path="/financas/contas" element={<SomenteAdmin><Contas /></SomenteAdmin>} />
        <Route path="/financas/transacoes" element={<Transacoes />} />
        <Route path="/financas/fluxo-caixa" element={<FluxoCaixa />} />
        <Route path="/financas/cartoes" element={<Cartoes />} />
        <Route path="/financas/cartoes/:id" element={<FaturaCartao />} />
        <Route path="/financas/centros-custo" element={<SomenteAdmin><CentrosCusto /></SomenteAdmin>} />
        <Route path="/financas/categorias" element={<SomenteAdmin><Categorias /></SomenteAdmin>} />
        <Route path="/financas/metas" element={<Metas />} />

        <Route path="/configuracoes/familia" element={<SomenteAdmin><Familia /></SomenteAdmin>} />
        <Route path="/configuracoes/telegram" element={<Telegram />} />
        <Route path="/configuracoes/contestacoes" element={<SomenteAdmin><Contestacoes /></SomenteAdmin>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </MainLayout>
  );
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-emerald-500 font-bold tracking-widest uppercase">Carregando...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* TRAVA DE SEGURANÇA: Se não tem sessão ativa, carrega APENAS as rotas de Login */}
          {!session ? (
            <Routes>
              <Route path="*" element={<Login />} />
            </Routes>
          ) : (
            /* Se está logado, descobre a família e o papel antes de liberar o sistema */
            <FamiliaProvider userId={session.user.id}>
              <AppLogado />
            </FamiliaProvider>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;