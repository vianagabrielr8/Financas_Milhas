import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("Página não encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-zinc-100">404</h1>
        <p className="mb-4 text-lg text-zinc-400">Página não encontrada.</p>
        <Link to="/financas" className="text-emerald-400 underline hover:text-emerald-300">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
