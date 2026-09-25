import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  // No celular o menu vira uma gaveta, aberta pelo botão ☰ do cabeçalho.
  const [menuAberto, setMenuAberto] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMenuAberto(false); }, [pathname]);

  return (
    <div className="flex h-[100dvh] w-full bg-[#0a0a0b] overflow-hidden selection:bg-emerald-500/30 text-zinc-100">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="left" className="p-0 w-72 max-w-[85vw] bg-[#0a0a0b] border-white/5 text-zinc-100 [&>button]:text-zinc-400 [&>button]:top-5">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Sidebar gaveta />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <Header onAbrirMenu={() => setMenuAberto(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-[#141417]">
          <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
