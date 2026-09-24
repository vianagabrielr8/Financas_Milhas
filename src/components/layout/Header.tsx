import { useLocation } from 'react-router-dom';

// Título de cada página, com os mesmos nomes do menu lateral.
const TITULOS: Record<string, string> = {
  '/financas': 'Dashboard',
  '/financas/transacoes': 'Transações',
  '/financas/metas': 'Metas da Casa',
  '/financas/fluxo-caixa': 'Fluxo por Dia',
  '/financas/contas': 'Contas e Caixas',
  '/financas/cartoes': 'Cartões',
  '/financas/centros-custo': 'Centros de Custo',
  '/financas/categorias': 'Categorias',
  '/financas/transferencias': 'Transferências',
  '/financas/contas-pagar': 'Contas a Pagar',
  '/financas/contas-receber': 'Contas a Receber',
  '/milhas': 'Dashboard de Milhas',
  '/milhas/estoque': 'Estoque',
  '/milhas/transferencias': 'Transferências',
  '/milhas/contas': 'Contas (CPFs)',
  '/milhas/programas': 'Programas',
  '/milhas/passageiros': 'Passageiros',
  '/milhas/limites': 'Limites CPF',
  '/configuracoes/familia': 'Família',
  '/configuracoes/telegram': 'Telegram',
  '/configuracoes/contestacoes': 'Contestações',
};

export const Header = () => {
  const { pathname } = useLocation();
  const caminho = pathname.replace(/\/+$/, '') || '/';

  const titulo = TITULOS[caminho]
    ?? (caminho.startsWith('/financas/cartoes/') ? 'Fatura do Cartão'
      : caminho.startsWith('/milhas/estoque/') ? 'Detalhes do Programa'
      : '');

  return (
    <header className="h-16 bg-[#141417] border-b border-white/5 flex items-center justify-between px-6 lg:px-8 flex-shrink-0 z-30">
      <h1 className="text-xl font-bold text-zinc-100 truncate">{titulo}</h1>
    </header>
  );
};
