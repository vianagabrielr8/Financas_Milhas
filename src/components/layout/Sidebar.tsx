import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, Package, ArrowRightLeft, DollarSign,
  Wallet, UserCircle, Plane, Users, ShieldCheck, LogOut, ChevronLeft, Menu, Target, CalendarDays, Tags, FolderTree, Landmark 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const Sidebar = () => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [moduloAtivo, setModuloAtivo] = useState<'FINANCAS' | 'MILHAS'>(() => {
    return (localStorage.getItem('erp_modulo_ativo') as 'FINANCAS' | 'MILHAS') || 'FINANCAS';
  });

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
    setModuloAtivo(modulo);
    localStorage.setItem('erp_modulo_ativo', modulo);
    window.location.reload();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login'); 
    window.location.reload();
  };

  const menuConfig = moduloAtivo === 'FINANCAS' ? [
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
    { group: "PRINCIPAL", items: [{ icon: LayoutDashboard, label: 'Dashboard', path: '/' }] },
    { group: "OPERACIONAL", items: [
      { icon: Package, label: 'Estoque', path: '/milhas/estoque' },
      { icon: ArrowRightLeft, label: 'Transferências', path: '/milhas/transferencias' },
    ]},
    { group: "GESTÃO E CADASTROS", items: [
      { icon: UserCircle, label: 'Contas (CPFs)', path: '/milhas/contas' },
      { icon: Plane, label: 'Programas', path: '/milhas/programas' },
      { icon: Users, label: 'Passageiros', path: '/milhas/passageiros' },
    ]},
    { group: "SEGURANÇA", items: [{ icon: ShieldCheck, label: 'Limites CPF', path: '/milhas/limites' }]}
  ];

  return (
    <aside className={cn(
      "h-screen bg-[#0a0a0b] border-r border-white/5 transition-all duration-300 flex flex-col shrink-0 z-40 relative", 
      collapsed ? "w-20" : "w-64"
    )}>
      
      <div className={cn("h-16 flex items-center border-b border-white/5", collapsed ? "justify-center" : "px-6 justify-between")}>
        {!collapsed && (
          <span className="text-lg font-black tracking-tighter text-white truncate">
            Milheiro<span className="text-[#10b981]">Smart</span>
          </span>
        )}
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="text-zinc-400 hover:text-white shrink-0">
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </Button>
      </div>

      <div className="p-4 border-b border-white/5">
        <div className={cn("flex bg-[#141417] rounded-lg p-1 border border-white/5", collapsed ? "flex-col gap-1.5" : "gap-1")}>
          <button 
            onClick={() => alterarModulo('FINANCAS')} 
            className={cn("py-1.5 text-[10px] font-bold rounded transition-colors text-center", collapsed ? "w-full" : "flex-1", moduloAtivo === 'FINANCAS' ? "bg-[#10b981] text-black" : "text-zinc-500 hover:text-zinc-300")}
          >
            {collapsed ? "F" : "FINANÇAS"}
          </button>
          <button 
            onClick={() => alterarModulo('MILHAS')} 
            className={cn("py-1.5 text-[10px] font-bold rounded transition-colors text-center", collapsed ? "w-full" : "flex-1", moduloAtivo === 'MILHAS' ? "bg-indigo-500 text-white" : "text-zinc-500 hover:text-zinc-300")}
          >
            {collapsed ? "M" : "MILHAS"}
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-hide">
        {menuConfig.map((group) => (
          <div key={group.group}>
            {!collapsed && <p className="text-[10px] font-bold text-zinc-500 mb-2 px-3 uppercase tracking-wider">{group.group}</p>}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink 
                  key={item.label} 
                  to={item.path} 
                  end={item.path === '/financas' || item.path === '/'}
                  title={collapsed ? item.label : undefined}
                  className={({isActive}) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors", 
                    collapsed ? "justify-center" : "",
                    isActive 
                      ? (moduloAtivo === 'FINANCAS' ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-indigo-500/10 text-indigo-500') 
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
        <div className="w-8 h-8 rounded-full bg-[#10b981]/20 border border-[#10b981]/30 flex items-center justify-center shrink-0 text-xs text-[#10b981] font-bold">
          {userInitial}
        </div>
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-[10px] text-zinc-500 truncate" title={userRole}>{userRole}</p>
          </div>
        )}
        <LogOut 
          className="w-4 h-4 text-zinc-500 cursor-pointer hover:text-red-400 shrink-0 transition-colors" 
          onClick={handleLogout}
        />
      </div>
    </aside>
  );
};
