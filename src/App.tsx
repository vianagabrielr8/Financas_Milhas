import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MainLayout } from "./components/layout/MainLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// IMPORTS MILHAS
import Compras from "./pages/milhas/Compras";
import Vendas from "./pages/milhas/Vendas";
import Passageiros from "./pages/milhas/Passageiros";
import Programas from "./pages/milhas/Programas";
import Estoque from "./pages/milhas/Estoque";
import ProgramDetails from "./pages/milhas/ProgramDetails";
import Limites from "./pages/milhas/Limites";

// IMPORTS FINANÇAS
import FinancasDashboard from "./pages/financas/FinancasDashboard";
import Contas from "./pages/financas/Contas";
import Transacoes from "./pages/financas/Transacoes";
import FluxoCaixa from "./pages/financas/FluxoCaixa";
import ContasPagar from "./pages/financas/ContasPagar";
import ContasReceber from "./pages/financas/ContasReceber";
import Transferencias from "./pages/financas/Transferencias";
import Cartoes from "./pages/financas/Cartoes";
import FaturaCartao from "./pages/financas/FaturaCartao";
import CentrosCusto from './pages/financas/CentrosCusto';
import Categorias from './pages/financas/Categorias';
import Metas from "./pages/financas/Metas";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <MainLayout>
            <Routes>
              {/* ROTA PRINCIPAL */}
              <Route path="/" element={<Index />} />

              {/* MÓDULO GESTÃO DE MILHAS */}
              <Route path="/milhas/compras" element={<Compras />} />
              <Route path="/milhas/vendas" element={<Vendas />} />
              <Route path="/milhas/estoque" element={<Estoque />} />
              <Route path="/milhas/estoque/:id" element={<ProgramDetails />} />
              <Route path="/milhas/limites" element={<Limites />} />
              <Route path="/milhas/passageiros" element={<Passageiros />} />
              <Route path="/milhas/programas" element={<Programas />} />

              {/* MÓDULO FINANÇAS PESSOAIS */}
              <Route path="/financas" element={<FinancasDashboard />} />
              <Route path="/financas/contas" element={<Contas />} />
              <Route path="/financas/transacoes" element={<Transacoes />} />
              <Route path="/financas/fluxo-caixa" element={<FluxoCaixa />} />
              <Route path="/financas/transferencias" element={<Transferencias />} />
              <Route path="/financas/contas-pagar" element={<ContasPagar />} />
              <Route path="/financas/contas-receber" element={<ContasReceber />} />
              <Route path="/financas/cartoes" element={<Cartoes />} />
              <Route path="/financas/cartoes/:id" element={<FaturaCartao />} />
              <Route path="/financas/centros-custo" element={<CentrosCusto />} />
              <Route path="/financas/categorias" element={<Categorias />} />
              <Route path="/financas/metas" element={<Metas />} />
              
              {/* FALLBACK (404) */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MainLayout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;