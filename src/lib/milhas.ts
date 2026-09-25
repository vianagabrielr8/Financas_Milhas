// Regras e contas do módulo Milhas (Pacote 4).
// Tabelas: milhas_programa, milhas_conta, milhas_contato, milhas_movimento,
// milhas_venda, milhas_venda_passageiro, milhas_parcela e a view milhas_saldo.
import { supabase } from '@/integrations/supabase/client';

export const db = supabase as any; // as tabelas novas ainda não estão nos tipos gerados

export const TIPOS_ENTRADA = ['COMPRA', 'BONUS', 'TRANSF_ENTRADA', 'AJUSTE_MAIS'] as const;
export const TIPOS_SAIDA = ['TRANSF_SAIDA', 'VENDA', 'USO', 'EXPIROU', 'AJUSTE_MENOS'] as const;
export const ehEntrada = (tipo: string) => (TIPOS_ENTRADA as readonly string[]).includes(tipo);

export const NOME_TIPO: Record<string, string> = {
  COMPRA: 'Compra', BONUS: 'Bônus', TRANSF_ENTRADA: 'Transferência (entrou)', AJUSTE_MAIS: 'Ajuste (+)',
  TRANSF_SAIDA: 'Transferência (saiu)', VENDA: 'Venda', USO: 'Uso (emissão)', EXPIROU: 'Expirou', AJUSTE_MENOS: 'Ajuste (−)',
};

export const milhasFmt = (n: number) => Math.round(n).toLocaleString('pt-BR');
export const brl = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBR = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');
/** Custo do milheiro (R$ por 1.000 milhas). */
export const milheiro = (custo: number, qtd: number) => (qtd > 0 ? (custo / qtd) * 1000 : 0);

// O Supabase devolve no máximo 1000 linhas por vez: busca em páginas.
export async function buscarTudo(montar: () => any) {
  const todas: any[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await montar().range(i, i + 999);
    if (error) throw error;
    todas.push(...(data || []));
    if (!data || data.length < 1000) return todas;
  }
}

export type Programa = { id: string; nome: string; tipo: 'AEREA' | 'BANCO'; limite_cpf: number | null; renovacao_cpf: 'ANO_CIVIL' | '12_MESES' | null; ativo: boolean };
export type Conta = { id: string; programa_id: string; titular: string; cpf: string | null; numero_programa: string | null; ativo: boolean };
export type Contato = { id: string; nome: string; tipo: 'CLIENTE' | 'FORNECEDOR' | 'AMBOS'; telefone: string | null; documento: string | null; observacao: string | null; ativo: boolean };
export type Movimento = {
  id: string; conta_id: string; tipo: string; quantidade: number; custo: number; data: string; validade: string | null;
  forma_pagamento: string | null; transferencia_id: string | null; venda_id: string | null; contato_id: string | null; observacao: string | null;
};

export const buscarProgramas = async (): Promise<Programa[]> => {
  const { data, error } = await db.from('milhas_programa').select('*').order('nome');
  if (error) throw error;
  return data || [];
};
export const buscarContas = async (): Promise<Conta[]> => {
  const { data, error } = await db.from('milhas_conta').select('*').order('titular');
  if (error) throw error;
  return data || [];
};
export const buscarContatos = async (): Promise<Contato[]> => {
  const { data, error } = await db.from('milhas_contato').select('*').order('nome');
  if (error) throw error;
  return data || [];
};
export const buscarMovimentos = (contaId?: string): Promise<Movimento[]> =>
  buscarTudo(() => {
    let q = db.from('milhas_movimento').select('*');
    if (contaId) q = q.eq('conta_id', contaId);
    return q.order('data').order('criado_em').order('id');
  });

export type SituacaoConta = {
  saldo: number;
  custo: number;          // custo do que está em estoque (R$)
  milheiro: number;       // R$ por 1.000
  lotesComValidade: { validade: string; restante: number }[]; // o que ainda não saiu, por vencimento
};

/**
 * Situação de uma conta a partir dos movimentos.
 * Saldo e custo: entradas somam, saídas subtraem (cada saída já guarda o
 * custo médio do momento em que foi lançada).
 * Vencimentos: as saídas consomem primeiro as milhas que vencem antes.
 */
export function situacaoDaConta(movs: Movimento[]): SituacaoConta {
  let saldo = 0, custo = 0, saidas = 0;
  const lotes: { validade: string | null; qtd: number }[] = [];
  for (const m of movs) {
    const q = Number(m.quantidade) || 0, c = Number(m.custo) || 0;
    if (ehEntrada(m.tipo)) { saldo += q; custo += c; lotes.push({ validade: m.validade, qtd: q }); }
    else { saldo -= q; custo -= c; saidas += q; }
  }
  lotes.sort((a, b) => (a.validade ?? '9999').localeCompare(b.validade ?? '9999'));
  for (const l of lotes) { const usa = Math.min(l.qtd, saidas); l.qtd -= usa; saidas -= usa; }
  return {
    saldo,
    custo: Math.max(custo, 0),
    milheiro: milheiro(Math.max(custo, 0), saldo),
    lotesComValidade: lotes.filter(l => l.validade && l.qtd > 0).map(l => ({ validade: l.validade!, restante: l.qtd })),
  };
}

/** Custo (R$) de tirar "qtd" milhas de uma conta, pelo custo médio atual. */
export function custoDaSaida(sit: SituacaoConta, qtd: number) {
  if (sit.saldo <= 0) return 0;
  return Math.round(((sit.custo / sit.saldo) * qtd) * 100) / 100;
}

/** Mensagem amigável para erros do banco. */
export function erroAmigavel(e: any) {
  const msg = String(e?.message || e || '');
  if (msg.includes('violates foreign key') || e?.code === '23503') return 'Tem lançamentos ligados a este cadastro. Em vez de apagar, desative.';
  if (msg.includes('duplicate key') || e?.code === '23505') return 'Já existe um cadastro com esse nome.';
  if (msg.includes('row-level security')) return 'Só o admin da família pode alterar.';
  return msg || 'Erro desconhecido';
}

export function somaDias(data: string, dias: number) {
  const d = new Date(data + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function somaMeses(data: string, meses: number) {
  const d = new Date(data + 'T12:00:00Z'); const dia = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString().slice(0, 10);
}
