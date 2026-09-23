import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Situação do acesso de quem está logado:
// CARREGANDO -> perguntando ao banco; OK -> tem família;
// NAO_LIBERADO -> e-mail sem convite nem liberação; ERRO -> falha ao perguntar.
export type SituacaoAcesso = 'CARREGANDO' | 'OK' | 'NAO_LIBERADO' | 'ERRO';
export type Papel = 'admin' | 'membro';

interface FamiliaContextType {
  situacao: SituacaoAcesso;
  familiaId: string | null;
  papel: Papel | null;
  isAdmin: boolean;
  // Hoje só o admin lança, edita e apaga pelo app. O membro só consulta.
  podeEditar: boolean;
  recarregar: () => void;
}

const FamiliaContext = createContext<FamiliaContextType | undefined>(undefined);

export function FamiliaProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [situacao, setSituacao] = useState<SituacaoAcesso>('CARREGANDO');
  const [familiaId, setFamiliaId] = useState<string | null>(null);
  const [papel, setPapel] = useState<Papel | null>(null);

  const carregar = useCallback(async () => {
    setSituacao('CARREGANDO');
    // entrar_no_app(): devolve a família e o papel; na primeira vez,
    // aceita o convite ou cria a família de quem foi liberado.
    const { data, error } = await supabase.rpc('entrar_no_app');
    if (error || !data) {
      console.error('Erro ao verificar acesso:', error);
      setSituacao('ERRO');
      return;
    }
    if (data.situacao === 'OK') {
      setFamiliaId(data.familia_id);
      setPapel(data.papel);
      setSituacao('OK');
    } else {
      setFamiliaId(null);
      setPapel(null);
      setSituacao('NAO_LIBERADO');
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [userId, carregar]);

  const isAdmin = papel === 'admin';

  return (
    <FamiliaContext.Provider value={{ situacao, familiaId, papel, isAdmin, podeEditar: isAdmin, recarregar: carregar }}>
      {children}
    </FamiliaContext.Provider>
  );
}

export function useFamilia() {
  const context = useContext(FamiliaContext);
  if (!context) throw new Error('useFamilia precisa estar dentro de FamiliaProvider');
  return context;
}
