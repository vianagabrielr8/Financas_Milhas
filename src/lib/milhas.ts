// Regras e contas do módulo Milhas (Pacotes 4 e 5).
// Tabelas: milhas_titular (pessoa), milhas_programa, milhas_conta (carteira
// titular x programa), milhas_contato, milhas_passageiro, milhas_clube,
// milhas_beneficiario, milhas_movimento, milhas_venda, milhas_venda_passageiro,
// milhas_parcela e a view milhas_saldo. Cartões vêm de Finanças (só leitura).
import { supabase } from '@/integrations/supabase/client';
import { hojeLocal } from '@/lib/utils';

export const db = supabase as any; // as tabelas novas ainda não estão nos tipos gerados

export const TIPOS_ENTRADA = ['COMPRA', 'BONUS', 'TRANSF_ENTRADA', 'AJUSTE_MAIS', 'CLUBE', 'CLUBE_BONUS'] as const;
export const TIPOS_SAIDA = ['TRANSF_SAIDA', 'VENDA', 'USO', 'EXPIROU', 'AJUSTE_MENOS'] as const;
export const ehEntrada = (tipo: string) => (TIPOS_ENTRADA as readonly string[]).includes(tipo);

export const NOME_TIPO: Record<string, string> = {
  COMPRA: 'Compra', BONUS: 'Bônus', TRANSF_ENTRADA: 'Transferência (entrou)', AJUSTE_MAIS: 'Ajuste (+)',
  CLUBE: 'Clube (pontos do plano)', CLUBE_BONUS: 'Clube (bônus)',
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

export type ModoLimite = 'PASSAGENS_12M' | 'PESSOAS_ANO' | 'LISTA_FIXA' | 'SEM_LIMITE';
export const NOME_MODO: Record<ModoLimite, string> = {
  PASSAGENS_12M: 'Passagens emitidas nos últimos 12 meses (cada uma libera 12 meses depois)',
  PESSOAS_ANO: 'Pessoas diferentes no ano (zera em 1º de janeiro)',
  LISTA_FIXA: 'Lista fixa de beneficiários',
  SEM_LIMITE: 'Sem limite',
};
export type Programa = {
  id: string; nome: string; tipo: 'AEREA' | 'BANCO'; limite_cpf: number | null; renovacao_cpf: 'ANO_CIVIL' | '12_MESES' | null; ativo: boolean;
  modo_limite: ModoLimite; espera_troca_dias: number | null; nivel: string | null;
};
/** Carteira: um titular num programa (criada sozinha no primeiro lançamento). */
export type Conta = { id: string; programa_id: string; titular_id: string; titular: string; cpf: string | null; numero_programa: string | null; ativo: boolean };
export type Titular = { id: string; nome: string; cpf: string | null; observacao: string | null; ativo: boolean };
export type PassageiroCad = { id: string; nome: string; documento_tipo: 'CPF' | 'PASSAPORTE'; documento: string; nascimento: string | null; telefone: string | null; email: string | null; observacao: string | null; ativo: boolean };
export type Clube = {
  id: string; conta_id: string; nome_plano: string; valor: number; periodicidade: 'MENSAL' | 'ANUAL'; parcelas: number;
  forma_pagamento: 'CARTAO' | 'PIX' | 'BOLETO'; cartao_id: string | null; data_inicio: string; dia_credito: number;
  pontos_mes: number; bonus_mes: number; meses: number | null; ativo: boolean; cancelado_em: string | null; observacao: string | null;
};
export type Beneficiario = { id: string; conta_id: string; passageiro_id: string; incluido_em: string; removido_em: string | null };
export type CartaoFin = { id: string; nome: string; dia_fechamento: number | null; dia_vencimento: number | null };
export type Contato = { id: string; nome: string; tipo: 'CLIENTE' | 'FORNECEDOR' | 'AMBOS'; telefone: string | null; documento: string | null; observacao: string | null; ativo: boolean };
export type Movimento = {
  id: string; conta_id: string; tipo: string; quantidade: number; custo: number; data: string; validade: string | null;
  forma_pagamento: string | null; transferencia_id: string | null; venda_id: string | null; contato_id: string | null; observacao: string | null;
  clube_id?: string | null; confirmado_em?: string | null;
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
const lista = (tabela: string, ordem: string) => async () => {
  const { data, error } = await db.from(tabela).select('*').order(ordem);
  if (error) throw error;
  return data || [];
};
export const buscarTitulares: () => Promise<Titular[]> = lista('milhas_titular', 'nome');
export const buscarPassageirosCad: () => Promise<PassageiroCad[]> = lista('milhas_passageiro', 'nome');
export const buscarClubes: () => Promise<Clube[]> = lista('milhas_clube', 'data_inicio');
export const buscarBeneficiarios: () => Promise<Beneficiario[]> = lista('milhas_beneficiario', 'incluido_em');
export const buscarCartoesFinancas = async (): Promise<CartaoFin[]> => {
  const { data, error } = await db.from('cartao_pessoal').select('id, nome, dia_fechamento, dia_vencimento').order('nome');
  if (error) throw error;
  return data || [];
};

/** Acha a carteira titular x programa; se não existir, cria. */
export async function obterConta(titularId: string, programaId: string, contas: Conta[]): Promise<string> {
  const ja = contas.find(c => c.titular_id === titularId && c.programa_id === programaId);
  if (ja) return ja.id;
  const { data, error } = await db.from('milhas_conta').insert([{ titular_id: titularId, programa_id: programaId, titular: '' }]).select('id').single();
  if (error) {
    // outra tela pode ter criado ao mesmo tempo: busca de novo
    const { data: d2 } = await db.from('milhas_conta').select('id').eq('titular_id', titularId).eq('programa_id', programaId).maybeSingle();
    if (d2) return d2.id;
    throw error;
  }
  return data.id;
}

/**
 * Vencimento de uma parcela paga no cartão: compra a partir do dia de
 * fechamento vai para a fatura seguinte; o vencimento cai no mês da fatura
 * (ou no mês seguinte, se o dia de vencimento for antes do fechamento).
 */
export function vencimentoNoCartao(dataCompra: string, cartao: CartaoFin | undefined, parcela = 0): string {
  if (!cartao?.dia_fechamento || !cartao?.dia_vencimento) return somaMeses(dataCompra, parcela + 1);
  const [a, m, d] = dataCompra.split('-').map(Number);
  let mesFech = m - 1 + (d >= cartao.dia_fechamento ? 1 : 0); // 0-based
  let mesVenc = mesFech + (cartao.dia_vencimento <= cartao.dia_fechamento ? 1 : 0) + parcela;
  const ano = a + Math.floor(mesVenc / 12); mesVenc = ((mesVenc % 12) + 12) % 12;
  const ultimo = new Date(Date.UTC(ano, mesVenc + 1, 0)).getUTCDate();
  return `${ano}-${String(mesVenc + 1).padStart(2, '0')}-${String(Math.min(cartao.dia_vencimento, ultimo)).padStart(2, '0')}`;
}

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
  futuro: number;         // créditos programados (clube) que ainda vão entrar
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
export function situacaoDaConta(movs: Movimento[], hoje: string = hojeLocal()): SituacaoConta {
  let saldo = 0, custo = 0, saidas = 0, futuro = 0;
  const lotes: { validade: string | null; qtd: number }[] = [];
  for (const m of movs) {
    const q = Number(m.quantidade) || 0, c = Number(m.custo) || 0;
    // Crédito com data futura (clube) ainda não está no saldo.
    if (m.data > hoje) { if (ehEntrada(m.tipo)) futuro += q; continue; }
    if (ehEntrada(m.tipo)) { saldo += q; custo += c; lotes.push({ validade: m.validade, qtd: q }); }
    else { saldo -= q; custo -= c; saidas += q; }
  }
  lotes.sort((a, b) => (a.validade ?? '9999').localeCompare(b.validade ?? '9999'));
  for (const l of lotes) { const usa = Math.min(l.qtd, saidas); l.qtd -= usa; saidas -= usa; }
  return {
    saldo, futuro,
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

/** Lê número digitado: aceita "10.000", "350,50" e "350.50". */
export function lerNumero(v: string | number) {
  const t = String(v ?? '').trim();
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
  if (/^\d+\.\d{1,2}$/.test(t)) return Number(t) || 0;
  return Number(t.replace(/\./g, '')) || 0;
}

export type Venda = {
  id: string; conta_id: string; contato_id: string | null; data: string; milhas: number; valor_total: number;
  taxa_dinheiro: number; taxa_milhas: number; custo_milhas: number; localizador: string | null; observacao: string | null;
};
export type Parcela = {
  id: string; tipo: 'PAGAR' | 'RECEBER'; venda_id: string | null; movimento_id: string | null; contato_id: string | null;
  descricao: string; numero: number; total: number; valor: number; vencimento: string; situacao: 'ABERTA' | 'PAGA'; pago_em: string | null;
  cartao_id?: string | null; clube_id?: string | null;
};
/** Passageiro de uma emissão (venda ou uso). "cpf" guarda o documento (CPF ou passaporte). */
export type Passageiro = { id: string; movimento_id: string; nome: string; cpf: string; documento_tipo?: string; passageiro_id?: string | null };

export const buscarVendas = (): Promise<Venda[]> =>
  buscarTudo(() => db.from('milhas_venda').select('*').order('data', { ascending: false }).order('id'));
export const buscarParcelas = (): Promise<Parcela[]> =>
  buscarTudo(() => db.from('milhas_parcela').select('*').order('vencimento').order('id'));
export const buscarPassageiros = (): Promise<Passageiro[]> =>
  buscarTudo(() => db.from('milhas_venda_passageiro').select('id, movimento_id, nome, cpf, documento_tipo, passageiro_id').order('id'));

/** Lucro da venda: o que o cliente paga − custo das milhas − taxa paga em R$. */
export const lucroDaVenda = (v: Pick<Venda, 'valor_total' | 'custo_milhas' | 'taxa_dinheiro'>) =>
  (Number(v.valor_total) || 0) - (Number(v.custo_milhas) || 0) - (Number(v.taxa_dinheiro) || 0);

export const soDigitos = (s: string) => String(s || '').replace(/\D/g, '');

export const docFmt = (tipo: string | undefined, doc: string) => (tipo === 'PASSAPORTE' ? `Passaporte ${doc}` : `CPF ${doc}`);

export type LimiteConta = {
  conta: Conta; programa: Programa; usados: number; limite: number;
  unidade: 'passagens' | 'pessoas' | 'beneficiários';
  itens: { chave: string; nome: string; doc: string; data: string; libera: string | null }[];
};

/**
 * Limite de emissão para terceiros, pelo "modo" do programa:
 *   PASSAGENS_12M -> cada passagem para terceiro nos últimos 12 meses conta; libera 12 meses depois (LATAM)
 *   PESSOAS_ANO   -> pessoas diferentes no ano; tudo libera em 1º de janeiro (Smiles, TAP)
 *   LISTA_FIXA    -> beneficiários cadastrados na lista (Azul, Iberia)
 *   SEM_LIMITE    -> não entra (bancos de pontos)
 * O próprio titular nunca conta.
 */
export function calcularLimites(programas: Programa[], contas: Conta[], movs: Movimento[], pax: Passageiro[], hoje: string,
  beneficiarios: Beneficiario[] = [], cadastro: PassageiroCad[] = []): LimiteConta[] {
  const movPorId = new Map(movs.map(m => [m.id, m]));
  const inicioAno = hoje.slice(0, 4) + '-01-01';
  const umAnoAtras = somaMeses(hoje, -12);
  const res: LimiteConta[] = [];
  for (const conta of contas) {
    const programa = programas.find(p => p.id === conta.programa_id);
    const modo = programa?.modo_limite || 'SEM_LIMITE';
    if (!programa || programa.tipo !== 'AEREA' || modo === 'SEM_LIMITE' || !programa.limite_cpf) continue;
    const docTitular = soDigitos(conta.cpf || '');
    const itens: LimiteConta['itens'] = [];
    if (modo === 'LISTA_FIXA') {
      for (const b of beneficiarios.filter(x => x.conta_id === conta.id && !x.removido_em)) {
        const p = cadastro.find(x => x.id === b.passageiro_id);
        itens.push({ chave: b.id, nome: p?.nome || '?', doc: p ? docFmt(p.documento_tipo, p.documento) : '', data: b.incluido_em, libera: null });
      }
    } else {
      const emissoes = pax.map(p => ({ p, m: movPorId.get(p.movimento_id) }))
        .filter(({ p, m }) => m && m.conta_id === conta.id && m.data <= hoje && soDigitos(p.cpf) !== docTitular || false) as { p: Passageiro; m: Movimento }[];
      if (modo === 'PASSAGENS_12M') {
        for (const { p, m } of emissoes) if (m.data > umAnoAtras)
          itens.push({ chave: p.id, nome: p.nome, doc: docFmt(p.documento_tipo, p.cpf), data: m.data, libera: somaMeses(m.data, 12) });
      } else {
        const porDoc = new Map<string, LimiteConta['itens'][number]>();
        for (const { p, m } of emissoes) if (m.data >= inicioAno) {
          const k = `${p.documento_tipo || 'CPF'}|${p.cpf}`;
          if (!porDoc.has(k) || m.data > porDoc.get(k)!.data)
            porDoc.set(k, { chave: k, nome: p.nome, doc: docFmt(p.documento_tipo, p.cpf), data: m.data, libera: `${Number(hoje.slice(0, 4)) + 1}-01-01` });
        }
        itens.push(...porDoc.values());
      }
    }
    itens.sort((a, b) => (a.libera ?? a.data).localeCompare(b.libera ?? b.data));
    res.push({ conta, programa, usados: itens.length, limite: programa.limite_cpf, unidade: modo === 'PASSAGENS_12M' ? 'passagens' : modo === 'LISTA_FIXA' ? 'beneficiários' : 'pessoas', itens });
  }
  return res;
}
