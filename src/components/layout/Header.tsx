import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';

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
  '/milhas': 'Painel de Milhas',
  '/milhas/lancar': 'Lançar Milhas',
  '/milhas/estoque': 'Estoque de Milhas',
  '/milhas/titulares': 'Titulares',
  '/milhas/programas': 'Programas',
  '/milhas/passageiros': 'Passageiros',
  '/milhas/clientes': 'Clientes e fornecedores',
  '/milhas/clubes': 'Clubes de assinatura',
  '/milhas/cartoes': 'Cartões (Milhas)',
  '/milhas/vendas': 'Vendas de Milhas',
  '/milhas/receber-pagar': 'A receber / a pagar',
  '/milhas/limites-cpf': 'Limites de emissão',
  '/configuracoes/familia': 'Família',
  '/configuracoes/telegram': 'Telegram',
  '/configuracoes/contestacoes': 'Contestações',
};

export const Header = ({ onAbrirMenu }: { onAbrirMenu?: () => void }) => {
  const { pathname } = useLocation();
  const caminho = pathname.replace(/\/+$/, '') || '/';

  const titulo = TITULOS[caminho]
    ?? (caminho.startsWith('/financas/cartoes/') ? 'Fatura do Cartão'
      : caminho.startsWith('/milhas/estoque/') ? 'Histórico da Conta'
      : '');

  return (
    <header className="h-14 md:h-16 bg-[#141417] border-b border-white/5 flex items-center gap-2 px-2 md:px-6 lg:px-8 flex-shrink-0 z-30">
      <button onClick={onAbrirMenu} className="md:hidden p-2.5 text-zinc-300 hover:text-white rounded-lg hover:bg-white/5" aria-label="Abrir menu">
        <Menu className="w-5 h-5" />
      </button>
      <h1 className="text-lg md:text-xl font-bold text-zinc-100 truncate">{titulo}</h1>
    </header>
  );
};
