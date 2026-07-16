import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MainLayout } from "./components/layout/MainLayout";
import Index from "./pages/Index";
import Compras from "./pages/Compras";
import Vendas from "./pages/Vendas";
import ContasPagar from "./pages/ContasPagar";
import ContasReceber from "./pages/ContasReceber";
import CentrosCusto from './pages/CentrosCusto';
import Categorias from './pages/Categorias';
import Passageiros from "./pages/Passageiros";
import Programas from "./pages/Programas";
import Contas from "./pages/Contas";
import Estoque from "./pages/Estoque";
import ProgramDetails from "./pages/ProgramDetails";
import Limites from "./pages/Limites";
import Transferencias from "./pages/Transferencias";
import NotFound from "./pages/NotFound";
import Transacoes from "./pages/Transacoes";
import FinancasDashboard from "./pages/FinancasDashboard";
import Cartoes from "./pages/Cartoes";
import Metas from "./pages/Metas";
import FaturaCartao from "./pages/FaturaCartao";
import FluxoCaixa from "./pages/FluxoCaixa";

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
              {/* MÓDULO GESTÃO DE MILHAS */}
              <Route path="/" element={<Index />} />
              <Route path="/estoque" element={<Estoque />} />
              <Route path="/estoque/:id" element={<ProgramDetails />} />
              <Route path="/compras" element={<Compras />} />
              <Route path="/vendas" element={<Vendas />} />
              <Route path="/transferencias" element={<Transferencias />} />
              <Route path="/contas-pagar" element={<ContasPagar />} />
              <Route path="/contas-receber" element={<ContasReceber />} />
              <Route path="/cartoes" element={<Cartoes />} />
              <Route path="/limites" element={<Limites />} />
              <Route path="/passageiros" element={<Passageiros />} />
              <Route path="/programas" element={<Programas />} />
              <Route path="/contas" element={<Contas />} />

              {/* MÓDULO FINANÇAS PESSOAIS */}
              <Route path="/financas" element={<FinancasDashboard />} />
              <Route path="/financas/transacoes" element={<Transacoes />} />
              <Route path="/financas/metas" element={<Metas />} />
              <Route path="/financas/fluxo-caixa" element={<FluxoCaixa />} />
              <Route path="/financas/cartoes" element={<Cartoes />} />
              <Route path="/financas/cartoes/:id" element={<FaturaCartao />} />
              <Route path="/financas/centros-custo" element={<CentrosCusto />} />
              <Route path="/financas/categorias" element={<Categorias />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MainLayout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;