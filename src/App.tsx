import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MainLayout } from "./components/layout/MainLayout";
import Login from "./pages/Login";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// IMPORTS MILHAS
import Passageiros from "./pages/milhas/Passageiros";
import Programas from "./pages/milhas/Programas";
import Estoque from "./pages/milhas/Estoque";
import ProgramDetails from "./pages/milhas/ProgramDetails";
import Limites from "./pages/milhas/Limites";
import ContasMilhas from "./pages/milhas/Titulares"; 
import TransferenciasMilhas from "./pages/milhas/Transferencias"; 

// IMPORTS FINANÇAS
import FinancasDashboard from "./pages/financas/FinancasDashboard";
import Contas from "./pages/financas/Contas";
import Transacoes from "./pages/financas/Transacoes";
import FluxoCaixa from "./pages/financas/FluxoCaixa";
import ContasPagar from "./pages/financas/ContasPagar";
import ContasReceber from "./pages/financas/ContasReceber";
import TransferenciasFinancas from "./pages/financas/Transferencias"; 
import Cartoes from "./pages/financas/Cartoes";
import FaturaCartao from "./pages/financas/FaturaCartao";
import CentrosCusto from './pages/financas/CentrosCusto';
import Categorias from './pages/financas/Categorias';
import Metas from "./pages/financas/Metas";

const queryClient = new QueryClient();

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
            /* Se está logado, libera o Layout e o Sistema inteiro */
            <MainLayout>
              <Routes>
                <Route path="/" element={<Index />} />

                <Route path="/milhas/estoque" element={<Estoque />} />
                <Route path="/milhas/estoque/:id" element={<ProgramDetails />} />
                <Route path="/milhas/limites" element={<Limites />} />
                <Route path="/milhas/passageiros" element={<Passageiros />} />
                <Route path="/milhas/programas" element={<Programas />} />
                <Route path="/milhas/contas" element={<ContasMilhas />} />
                <Route path="/milhas/transferencias" element={<TransferenciasMilhas />} />

                <Route path="/financas" element={<FinancasDashboard />} />
                <Route path="/financas/contas" element={<Contas />} />
                <Route path="/financas/transacoes" element={<Transacoes />} />
                <Route path="/financas/fluxo-caixa" element={<FluxoCaixa />} />
                <Route path="/financas/transferencias" element={<TransferenciasFinancas />} />
                <Route path="/financas/contas-pagar" element={<ContasPagar />} />
                <Route path="/financas/contas-receber" element={<ContasReceber />} />
                <Route path="/financas/cartoes" element={<Cartoes />} />
                <Route path="/financas/cartoes/:id" element={<FaturaCartao />} />
                <Route path="/financas/centros-custo" element={<CentrosCusto />} />
                <Route path="/financas/categorias" element={<Categorias />} />
                <Route path="/financas/metas" element={<Metas />} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MainLayout>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;