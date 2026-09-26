// Planilha-modelo (.xlsx) para importar compras na fatura do cartão, com listas
// suspensas de Centro de Custo, Categoria, Fatura e Cartão (titular/adicionais).
// A ordem das colunas é a mesma do modelo CSV antigo, mais a coluna "Cartão".
// A biblioteca (exceljs) só é carregada quando alguém baixa ou importa.

export const COLUNAS_MODELO = ['Data (DD/MM/AAAA)', 'Descrição', 'Valor Total', 'Fatura (ex.: Set/2026)', 'Categoria', 'Centro de Custo', 'Parcelas', 'Observação', 'Cartão (titular ou adicional)'];
export const TITULAR = 'Titular';
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const LINHAS = 500;

type Nome = { id: string; nome: string };

/** Opções da lista de Categoria: "Categoria" e "Categoria • Subcategoria". */
export function opcoesCategoria(categorias: (Nome & { centro_custo_id?: string | null })[], subcategorias: (Nome & { categoria_id: string })[]) {
  const l: string[] = [];
  for (const c of [...categorias].sort((a, b) => a.nome.localeCompare(b.nome))) {
    l.push(c.nome);
    for (const s of subcategorias.filter((s) => s.categoria_id === c.id).sort((a, b) => a.nome.localeCompare(b.nome))) l.push(`${c.nome} • ${s.nome}`);
  }
  return Array.from(new Set(l));
}

export async function gerarModeloFatura(d: {
  cartaoNome: string; faturaAtual: string; centros: Nome[];
  categorias: (Nome & { centro_custo_id?: string | null })[]; subcategorias: (Nome & { categoria_id: string })[];
  adicionais: { nome_impresso: string }[];
}): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();

  // Listas (aba escondida)
  const listas = wb.addWorksheet('Listas', { state: 'veryHidden' });
  const [mf, af] = d.faturaAtual.split('/');
  const base = MESES.indexOf(mf) + Number(af) * 12;
  const faturas = Array.from({ length: 15 }, (_, i) => { const k = base - 2 + i; return `${MESES[k % 12]}/${Math.floor(k / 12)}`; });
  const colunas: [string, string[]][] = [
    ['A', d.centros.map((c) => c.nome).sort((a, b) => a.localeCompare(b))],
    ['B', opcoesCategoria(d.categorias, d.subcategorias)],
    ['C', faturas],
    ['D', [TITULAR, ...d.adicionais.map((a) => a.nome_impresso)]],
  ];
  for (const [col, valores] of colunas) valores.forEach((v, i) => { listas.getCell(`${col}${i + 1}`).value = v; });
  const faixa = (col: string, n: number) => `Listas!$${col}$1:$${col}$${Math.max(n, 1)}`;

  // Lançamentos
  const ws = wb.addWorksheet('Lançamentos', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUNAS_MODELO.map((h, i) => ({ header: h, width: [14, 34, 13, 18, 30, 22, 10, 30, 24][i] }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
  const lista = (formula: string, titulo: string) => ({
    type: 'list' as const, allowBlank: true, formulae: [formula], showErrorMessage: true,
    errorStyle: 'stop' as const, errorTitle: titulo, error: 'Escolha um item da lista (clique na setinha).',
  });
  for (let r = 2; r <= LINHAS + 1; r++) {
    ws.getCell(`A${r}`).numFmt = 'dd/mm/yyyy';
    ws.getCell(`C${r}`).numFmt = '#,##0.00';
    ws.getCell(`D${r}`).dataValidation = lista(faixa('C', colunas[2][1].length), 'Fatura');
    ws.getCell(`E${r}`).dataValidation = lista(faixa('B', colunas[1][1].length), 'Categoria');
    ws.getCell(`F${r}`).dataValidation = lista(faixa('A', colunas[0][1].length), 'Centro de Custo');
    ws.getCell(`G${r}`).dataValidation = { type: 'whole', operator: 'between', allowBlank: true, formulae: [1, 48], showErrorMessage: true, errorTitle: 'Parcelas', error: 'Número de parcelas de 1 a 48.' };
    ws.getCell(`I${r}`).dataValidation = lista(faixa('D', colunas[3][1].length), 'Cartão');
  }

  // Instruções
  const ajuda = wb.addWorksheet('Como preencher');
  ajuda.getColumn(1).width = 110;
  [
    `Modelo de importação — cartão ${d.cartaoNome}`,
    '',
    '• Preencha a aba "Lançamentos", uma compra por linha. Uma compra parcelada é UMA linha com o valor TOTAL e o nº de parcelas.',
    '• Centro de Custo, Categoria, Fatura e Cartão: clique na célula e use a setinha para escolher da lista.',
    '• Categoria aparece como "Categoria" ou "Categoria • Subcategoria". A categoria precisa ser do centro de custo escolhido.',
    '• Fatura em branco: o app calcula pela data da compra e o dia de fechamento do cartão.',
    '• Cartão em branco ou "Titular" = cartão principal. Para compra no adicional, escolha o nome dele.',
    '• Valor negativo vira estorno. Obrigatórios: Data, Descrição, Valor e Centro de Custo.',
    '• Depois, na tela da fatura, clique em "Importar" e escolha este arquivo.',
  ].forEach((t, i) => { const c = ajuda.getCell(`A${i + 1}`); c.value = t; if (i === 0) c.font = { bold: true, size: 13 }; });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Lê a 1ª aba de um .xlsx e devolve as linhas (sem o cabeçalho) como textos, na ordem das colunas do modelo. */
export async function lerPlanilha(arquivo: File): Promise<string[][]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await arquivo.arrayBuffer());
  const ws = wb.worksheets.find((w) => w.state === 'visible') || wb.worksheets[0];
  const texto = (v: unknown): string => {
    if (v == null) return '';
    if (v instanceof Date) return `${String(v.getUTCDate()).padStart(2, '0')}/${String(v.getUTCMonth() + 1).padStart(2, '0')}/${v.getUTCFullYear()}`;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object') {
      const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
      if (o.richText) return o.richText.map((p) => p.text).join('');
      if (o.result !== undefined) return texto(o.result);
      if (o.text !== undefined) return String(o.text);
    }
    return String(v).replace(/;/g, ',').trim();
  };
  const linhas: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const cols = Array.from({ length: COLUNAS_MODELO.length }, (_, i) => texto(row.getCell(i + 1).value));
    if (cols.some((c) => c !== '')) linhas.push(cols);
  });
  return linhas;
}
