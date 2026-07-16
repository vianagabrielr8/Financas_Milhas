import { useLocation } from 'react-router-dom';
import { Bell, Search } from 'lucide-react';

export const Header = () => {
  const location = useLocation();
  
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/financas') return 'Dashboard';
    const cleanPath = path.replace('/financas/', '').replace('/', '');
    return cleanPath.charAt(0).toUpperCase() + cleanPath.slice(1).replace('-', ' ');
  };

  return (
    <header className="h-16 bg-[#141417] border-b border-white/5 flex items-center justify-between px-6 lg:px-8 flex-shrink-0 z-30">
      <h1 className="text-xl font-bold text-zinc-100">{getPageTitle()}</h1>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            className="bg-[#0a0a0b] border border-white/5 text-sm rounded-full pl-9 pr-4 py-2 text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-colors w-64"
          />
        </div>

        <button className="text-zinc-400 hover:text-zinc-100 relative p-2 rounded-full hover:bg-white/5 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-[#141417]"></span>
        </button>
      </div>
    </header>
  );
};