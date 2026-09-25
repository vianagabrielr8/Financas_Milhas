import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, Package, PlusCircle, DollarSign,
  Wallet, UserCircle, ShieldCheck, Plane, Users, Contact, Repeat, LogOut, ChevronLeft, Menu, Target, CalendarDays, Tags, FolderTree, Landmark, Home, Send, MessageSquareWarning 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFamilia } from '@/contexts/FamiliaContext';

// gaveta = versão do celular (dentro do menu que desliza): sempre aberta, sem botão de recolher.
export const Sidebar = ({ gaveta = false }: { gaveta?: boolean }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [recolhido, setCollapsed] = useState(false);
  const collapsed = !gaveta && recolhido;
  const { isAdmin } = useFamilia();
  // O módulo vem da página aberta: /milhas... = MILHAS; o resto (Finanças e
  // Configurações) = FINANÇAS.
  const moduloDaPagina = pathname.startsWith('/milhas') ? 'MILHAS' : 'FINANCAS';
  // O membro só usa Finanças (o módulo Milhas é só do admin).
  const moduloAtivo = isAdmin ? moduloDaPagina : 'FINANCAS';

  // Estados para armazenar os dados reais do usuário logado
  const [userName, setUserName] = useState('Carregando...');
  const [userInitial, setUserInitial] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const buscarUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Tenta pegar o nome completo do Google. Se não tiver, usa a primeira parte do e-mail.
        const nomeCompleto = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário';
        setUserName(nomeCompleto);
        setUserInitial(nomeCompleto.charAt(0).toUpperCase());
        setUserRole(user.email || 'Usuário');
      }
    };
    buscarUsuario();
  }, []);

  const alterarModulo = (modulo: 'FINANCAS' | 'MILHAS') => {
    navigate(modulo === 'MILHAS' ? '/milhas' : '/financas');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const menuCompleto = moduloAtivo === 'FINANCAS' ? [
    { group: "VISÃO GERAL", items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/financas' },
      { icon: DollarSign, label: 'Transações', path: '/financas/transacoes' },
      { icon: Target, label: 'Metas', path: '/financas/metas' },
      { icon: CalendarDays, label: 'Fluxo por Dia', path: '/financas/fluxo-caixa' },
    ]},
    { group: "FINANCEIRO", items: [
      { icon: Landmark, label: 'Contas e Caixas', path: '/financas/contas' },
      { icon: Wallet, label: 'Cartões', path: '/financas/cartoes' },
      { icon: FolderTree, label: 'Centros de Custo', path: '/financas/centros-custo' },
      { icon: Tags, label: 'Categorias', path: '/financas/categorias' },
    ]}
  ] : [
    { group: "MILHAS", items: [
      { icon: LayoutDashboard, label: 'Painel', path: '/milhas' },
      { icon: PlusCircle, label: 'Lançar', path: '/milhas/lancar' },
      { icon: Package, label: 'Estoque', path: '/milhas/estoque' },
      { icon: DollarSign, label: 'Vendas', path: '/milhas/vendas' },
      { icon: CalendarDays, label: 'A receber / a pagar', path: '/milhas/receber-pagar' },
      { icon: Wallet, label: 'Cartões', path: '/milhas/cartoes' },
      { icon: ShieldCheck, label: 'Limites', path: '/milhas/limites-cpf' },
    ]},
    { group: "CADASTROS", items: [
      { icon: UserCircle, label: 'Titulares', path: '/milhas/titulares' },
      { icon: Plane, label: 'Programas', path: '/milhas/programas' },
      { icon: Users, label: 'Passageiros', path: '/milhas/passageiros' },
      { icon: Contact, label: 'Clientes e fornecedores', path: '/milhas/clientes' },
      { icon: Repeat, label: 'Clubes', path: '/milhas/clubes' },
    ]},
  ];

  // Admin vê tudo + Família e Telegram. Membro só vê as telas de consulta + Telegram.
  const PATHS_DO_MEMBRO = ['/financas', '/financas/transacoes', '/financas/metas', '/financas/fluxo-caixa', '/financas/cartoes'];
  const itemTelegram = { icon: Send, label: 'Telegram', path: '/configuracoes/telegram' };
  const menuConfig = isAdmin
    // Configurações só aparecem no módulo Finanças.
    ? [...menuCompleto, ...(moduloAtivo === 'FINANCAS' ? [{ group: "CONFIGURAÇÕES", items: [{ icon: Home, label: 'Família', path: '/configuracoes/familia' }, { icon: MessageSquareWarning, label: 'Contestações', path: '/configuracoes/contestacoes' }, itemTelegram] }] : [])]
    : [...menuCompleto
        .map(g => ({ ...g, items: g.items.filter(i => PATHS_DO_MEMBRO.includes(i.path)) }))
        .filter(g => g.items.length > 0),
       { group: "CONFIGURAÇÕES", items: [itemTelegram] }];

  return (
    <aside className={cn(
      "h-full bg-[#0a0a0b] transition-all duration-300 flex flex-col shrink-0 z-40 relative",
      gaveta ? "w-full" : cn("h-screen border-r border-white/5", collapsed ? "w-20" : "w-64")
    )}>
      
      <div className={cn("h-16 flex items-center border-b border-white/5", collapsed ? "justify-center" : "px-6 justify-between")}>
        {!collapsed && (
          <span className="text-lg font-black tracking-tighter text-white truncate">
            Milheiro<span className={moduloAtivo === 'MILHAS' ? "text-violet-400" : "text-[#10b981]"}>Smart</span>
          </span>
        )}
        {!gaveta && <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="text-zinc-400 hover:text-white shrink-0">
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>}
      </div>

      {isAdmin && <div className="p-4 border-b border-white/5">
        <div className={cn("flex bg-[#141417] rounded-lg p-1 border border-white/5", collapsed ? "flex-col gap-1.5" : "gap-1")}>
          <button 
            onClick={() => alterarModulo('FINANCAS')} 
            className={cn("py-1.5 text-[10px] font-bold rounded transition-colors text-center", collapsed ? "w-full" : "flex-1", moduloAtivo === 'FINANCAS' ? "bg-[#10b981] text-black" : "text-zinc-500 hover:text-zinc-300")}
          >
            {collapsed ? "F" : "FINANÇAS"}
          </button>
          <button 
            onClick={() => alterarModulo('MILHAS')} 
            className={cn("py-1.5 text-[10px] font-bold rounded transition-colors text-center", collapsed ? "w-full" : "flex-1", moduloAtivo === 'MILHAS' ? "bg-violet-500 text-white" : "text-zinc-500 hover:text-zinc-300")}
          >
            {collapsed ? "M" : "MILHAS"}
          </button>
        </div>
      </div>}

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-hide">
        {menuConfig.map((group) => (
          <div key={group.group}>
            {!collapsed && <p className="text-[10px] font-bold text-zinc-500 mb-2 px-3 uppercase tracking-wider">{group.group}</p>}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink 
                  key={item.label} 
                  to={item.path} 
                  end={item.path === '/financas' || item.path === '/milhas'}
                  title={collapsed ? item.label : undefined}
                  className={({isActive}) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors", 
                    collapsed ? "justify-center" : "",
                    isActive 
                      ? (moduloAtivo === 'FINANCAS' ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-violet-500/10 text-violet-400') 
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" /> 
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("p-4 border-t border-white/5 flex items-center gap-3", collapsed ? "justify-center" : "")}>
        <div className={cn("w-8 h-8 rounded-full border flex items-center justify-center shrink-0 text-xs font-bold", moduloAtivo === 'MILHAS' ? "bg-violet-500/20 border-violet-500/30 text-violet-300" : "bg-[#10b981]/20 border-[#10b981]/30 text-[#10b981]")}>
          {userInitial}
        </div>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-[10px] text-zinc-500 truncate" title={userRole}>{userRole}</p>
          </div>
        )}
        <button onClick={handleLogout} title="Sair" className="p-2 -m-2 text-zinc-500 hover:text-red-400 shrink-0 transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
