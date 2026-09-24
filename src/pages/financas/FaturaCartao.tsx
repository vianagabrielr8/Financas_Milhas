import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Calendar, DollarSign, Receipt,
  FileText, Trash2, Edit2, Plus, CreditCard, ChevronDown,
  Search, CornerDownRight, Upload, Download, Briefcase, AlertTriangle, X, DownloadCloud,
  ArrowUpDown, ArrowUp, ArrowDown, Calculator, SplitSquareHorizontal, Percent,
  Filter, CheckCircle2, Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, hojeLocal } from '@/lib/utils';
import { useFamilia } from '@/contexts/FamiliaContext';
import { ContestarModal, podeContestar } from '@/components/finance/ContestarModal';

type SortKey = 'data' | 'descricao' | 'categoria' | 'valor';

export default function FaturaCartao() {
  const { podeEditar } = useFamilia();
  const [contestando, setContestando] = useState<any>(null);
  const queryClient = useQueryClient();
  const { id: urlCardId } = useParams();

  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const [mesSelecionado, setMesSelecionado] = useState(mesesNomes[new Date().getMonth()]);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());

  const [cartaoAtivo, setCartaoAtivo] = useState<any>(null);
  const [filtroVinculado, setFiltroVinculado] = useState<string | 'ALL'>('ALL');

  const [modalAberto, setModalAberto] = useState(false);

  // Exclusão
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const [transacaoParaExcluir, setTransacaoParaExcluir] = useState<any>(null);

  // Pagamento da Fatura
  const [modalPagarFaturaAberto, setModalPagarFaturaAberto] = useState(false);
  const [contaPagamentoId, setContaPagamentoId] = useState('');
  const [dataPagamentoFatura, setDataPagamentoFatura] = useState(hojeLocal());
  const [processandoPagamento, setProcessandoPagamento] = useState(false);

  // Estados de Edição Lançamento/Parcela
  const [transacaoEditandoId, setTransacaoEditandoId] = useState<string | null>(null);
  const [transacaoEditandoOriginal, setTransacaoEditandoOriginal] = useState<any>(null);
  const [formParcelaAtual, setFormParcelaAtual] = useState<number | null>(null);
  const [formEdicaoLoteModo, setFormEdicaoLoteModo] = useState<'APENAS_ESTA' | 'DESTA_EM_DIANTE' | 'TODAS'>('APENAS_ESTA');

  const [formTipo, setFormTipo] = useState('DESPESA');
  const [formDescricao, setFormDescricao] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formData, setFormData] = useState(hojeLocal());
  const [formFaturaDestino, setFormFaturaDestino] = useState(`${mesSelecionado}/${anoSelecionado}`);
  const [formCentroCusto, setFormCentroCusto] = useState('');
  const [formParcelado, setFormParcelado] = useState(false);
  const [formParcelas, setFormParcelas] = useState(2);
  const [formObservacao, setFormObservacao] = useState('');

  const [categoriaSelecionada, setCategoriaSelecionada] = useState<{catId: string, subId?: string, nomeDisplay: string} | null>(null);
  const [dropdownCatAberto, setDropdownCatAberto] = useState<number | null>(null);
  const [buscaCat, setBuscaCat] = useState('');

  // Estados do Rateio
  const [isRateio, setIsRateio] = useState(false);
  const [tipoRateio, setTipoRateio] = useState<'VALOR' | 'PERCENTUAL'>('VALOR');
  const [rateios, setRateios] = useState([
    { id: 1, cc: '', cat: null as any, valorStr: '' },
    { id: 2, cc: '', cat: null as any, valorStr: '' }
  ]);

  // Estados da Calculadora
  const [calcAberto, setCalcAberto] = useState(false);
  const [calcVisor, setCalcVisor] = useState('');

  // Ordenação
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'data', direction: 'desc' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const opcoesFatura = useMemo(() => {
    return Array.from({length: 13}).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() + i - 2);
      return `${mesesNomes[d.getMonth()]}/${d.getFullYear()}`;
    });
  }, []);

  const { data: cartoes = [], isLoading: carregandoCartoes } = useQuery({
    queryKey: ['cartoes_pessoais'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartao_pessoal' as any).select('*').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas_financeiras'],
    queryFn: async () => {
      const { data, error } = await supabase.from('conta_financeira_pessoal' as any).select('*').order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    if (contas.length > 0 && !contaPagamentoId) {
      setContaPagamentoId(contas[0].id);
    }
  }, [contas, contaPagamentoId]);

  useEffect(() => {
    if (cartoes.length > 0) {
      if (urlCardId) {
        const cardEncontrado = cartoes.find((c: any) => c.id === urlCardId);
        setCartaoAtivo(cardEncontrado || cartoes[0]);
      } else if (!cartaoAtivo) {
        setCartaoAtivo(cartoes[0]);
      }
    }
  }, [cartoes, urlCardId]);

  useEffect(() => {
    setFiltroVinculado('ALL');
  }, [cartaoAtivo, mesSelecionado, anoSelecionado]);

  const { data: cartoesVinculados = [] } = useQuery({
    queryKey: ['cartoes_vinculados', cartaoAtivo?.id],
    enabled: !!cartaoAtivo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cartao_vinculado' as any)
        .select('*')
        .eq('cartao_pessoal_id', cartaoAtivo.id)
        .order('nome_impresso');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: centrosCusto = [] } = useQuery({
    queryKey: ['centros_custo_projeto'],
    queryFn: async () => {
      const { data, error } = await supabase.from('centro_custo_projeto' as any).select('*').order('nome');
      if (error) throw error; return data || [];
    }
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias_pessoais'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categoria_pessoal' as any).select('*').order('nome');
      if (error) throw error; return data || [];
    }
  });

  const { data: subcategorias = [] } = useQuery({
    queryKey: ['subcategorias_pessoais'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subcategoria_pessoal' as any).select('*').order('nome');
      if (error) throw error; return data || [];
    }
  });

  const faturaAtual = `${mesSelecionado}/${anoSelecionado}`;

  const { data: transacoes = [], refetch } = useQuery({
    queryKey: ['transacoes_cartao', cartaoAtivo?.id, faturaAtual],
    enabled: !!cartaoAtivo,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transacao_pessoal' as any)
        .select('*, centro_custo_projeto(nome)')
        .eq('cartao_id', cartaoAtivo.id)
        .eq('mes_fatura', faturaAtual);

      if (error) throw error;
      return data || [];
    }
  });

  const transacoesFiltradas = useMemo(() => {
    if (filtroVinculado === 'ALL') return transacoes;
    if (filtroVinculado === 'MAIN') return transacoes.filter((t: any) => !t.cartao_vinculado_id);
    return transacoes.filter((t: any) => t.cartao_vinculado_id === filtroVinculado);
  }, [transacoes, filtroVinculado]);

  const totalFatura = transacoesFiltradas.reduce((acc, curr) => {
    const valor = Number(curr.valor);
    return curr.tipo === 'ESTORNO' ? acc - valor : acc + valor;
  }, 0);

  // Total da fatura INTEIRA (todos os cartões vinculados), ignorando o filtro da tela.
  // É o valor usado no "Pagar Fatura", porque o pagamento quita a fatura toda.
  const totalFaturaCompleta = transacoes.reduce((acc, curr) => {
    const valor = Number(curr.valor);
    return curr.tipo === 'ESTORNO' ? acc - valor : acc + valor;
  }, 0);

  const faturaEstaPaga = useMemo(() => {
    if (transacoes.length === 0) return false;
    return transacoes.every((t: any) => t.situacao === 'PAGO');
  }, [transacoes]);

  useEffect(() => {
    if (!isRateio) return;
    const totalDesejado = tipoRateio === 'PERCENTUAL' ? 100 : (Number(formValor) || 0);
    if (totalDesejado === 0) return;

    let somaAtePenultima = 0;
    const novosRateios = [...rateios];

    for (let i = 0; i < novosRateios.length - 1; i++) {
      somaAtePenultima += Number(novosRateios[i].valorStr) || 0;
    }

    const restante = Math.max(0, totalDesejado - somaAtePenultima);
    const indexUltima = novosRateios.length - 1;

    if (Number(novosRateios[indexUltima].valorStr) !== restante) {
      novosRateios[indexUltima].valorStr = restante > 0 ? Number(restante.toFixed(2)).toString() : '';
      setRateios(novosRateios);
    }
  }, [formValor, tipoRateio, rateios.length, JSON.stringify(rateios.slice(0, -1).map(r => r.valorStr)), isRateio]);

  const categoriasFiltradas = (ccId: string) => {
    let baseCategorias = categorias;
    if (ccId) {
      baseCategorias = categorias.filter((cat: any) => !cat.centro_custo_id || cat.centro_custo_id === ccId);
    }
    const termo = buscaCat.toLowerCase();
    if (!termo) return baseCategorias;
    return baseCategorias.filter((cat: any) => {
      const matchCat = cat.nome.toLowerCase().includes(termo);
      const subs = subcategorias.filter((sub: any) => sub.categoria_id === cat.id);
      const matchSub = subs.some((sub: any) => sub.nome.toLowerCase().includes(termo));
      return matchCat || matchSub;
    });
  };

  const renderNomeCategoria = (catId: string, subId?: string) => {
    if (!catId) return 'A Classificar';
    const cat = categorias.find((c: any) => c.id === catId);
    if (!cat) return 'A Classificar';
    if (subId) {
      const sub = subcategorias.find((s: any) => s.id === subId);
      return sub ? `${cat.nome} • ${sub.nome}` : cat.nome;
    }
    return cat.nome;
  };

  const transacoesOrdenadas = useMemo(() => {
    let sortableItems = [...transacoesFiltradas];
    sortableItems.sort((a, b) => {
      if (sortConfig.key === 'data') {
        return new Date(a.data).getTime() - new Date(b.data).getTime();
      }
      if (sortConfig.key === 'descricao') {
        return (a.descricao || '').localeCompare(b.descricao || '');
      }
      if (sortConfig.key === 'categoria') {
        const catA = renderNomeCategoria(a.categoria_id, a.subcategoria_id);
        const catB = renderNomeCategoria(b.categoria_id, b.subcategoria_id);
        return catA.localeCompare(catB);
      }
      if (sortConfig.key === 'valor') {
        const valA = a.tipo === 'ESTORNO' ? Number(a.valor) : -Number(a.valor);
        const valB = b.tipo === 'ESTORNO' ? Number(b.valor) : -Number(b.valor);
        return valA - valB;
      }
      return 0;
    });
    if (sortConfig.direction === 'desc') sortableItems.reverse();
    return sortableItems;
  }, [transacoesFiltradas, sortConfig, categorias, subcategorias]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 group-hover:opacity-100 transition-opacity" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="w-3 h-3 ml-1 text-[#10b981]" />;
    return <ArrowDown className="w-3 h-3 ml-1 text-[#10b981]" />;
  };

  const resetarFormulario = () => {
    setTransacaoEditandoId(null);
    setTransacaoEditandoOriginal(null);
    setFormParcelaAtual(null);
    setFormEdicaoLoteModo('APENAS_ESTA');
    setFormTipo('DESPESA');
    setFormDescricao('');
    setFormValor('');
    setCategoriaSelecionada(null);
    setFormCentroCusto('');
    setFormParcelado(false);
    setFormParcelas(2);
    setFormObservacao('');
    setFormData(hojeLocal());
    setFormFaturaDestino(faturaAtual);
    setIsRateio(false);
    setRateios([{ id: 1, cc: '', cat: null as any, valorStr: '' }, { id: 2, cc: '', cat: null as any, valorStr: '' }]);
  };

  const abrirModalNovaDespesa = () => {
    resetarFormulario();
    setModalAberto(true);
  };

  const abrirModalEdicao = (t: any) => {
    setTransacaoEditandoId(t.id);
    setTransacaoEditandoOriginal(t);
    setFormTipo(t.tipo || 'DESPESA');
    setFormValor(Math.abs(Number(t.valor)).toString());
    setFormData(t.data);
    setFormObservacao(t.observacao || '');
    setFormFaturaDestino(t.mes_fatura || faturaAtual);
    setFormCentroCusto(t.centro_custo_id || '');

    if (t.categoria_id) {
      setCategoriaSelecionada({
        catId: t.categoria_id,
        subId: t.subcategoria_id,
        nomeDisplay: renderNomeCategoria(t.categoria_id, t.subcategoria_id)
      });
    } else {
      setCategoriaSelecionada(null);
    }

    const regexParcela = /(?:\(|\[Parc\s*)(\d+)\/(\d+)(?:\)|\])/i;
    const match = t.descricao.match(regexParcela);

    if (match) {
      setFormParcelaAtual(parseInt(match[1], 10));
      setFormParcelas(parseInt(match[2], 10));
      setFormDescricao(t.descricao.replace(regexParcela, '').trim());
      setFormEdicaoLoteModo('DESTA_EM_DIANTE');
      setFormParcelado(true);
    } else {
      setFormParcelaAtual(null);
      setFormParcelas(2);
      setFormDescricao(t.descricao);
      setFormEdicaoLoteModo('APENAS_ESTA');
      setFormParcelado(false);
    }

    setIsRateio(false);
    setModalAberto(true);
  };

  const avancarMesFatura = (faturaBase: string, addMeses: number) => {
    const [mes, anoStr] = faturaBase.split('/');
    let index = mesesNomes.indexOf(mes) + addMeses;
    let ano = parseInt(anoStr);
    while (index > 11) {
      index -= 12;
      ano++;
    }
    return `${mesesNomes[index]}/${ano}`;
  };

  const lidarComCalculadora = (calc: string) => {
    if (!calc || !calc.trim()) return;
    try {
      const expressaoTratada = calc.replace(/,/g, '.');
      const resultado = Function(`"use strict";return (${expressaoTratada})`)();

      if (!isNaN(resultado) && isFinite(resultado)) {
        setFormValor(Math.abs(resultado).toFixed(2));
        setCalcAberto(false);
        setCalcVisor('');
      }
    } catch {
      alert("Expressão matemática inválida. Verifique os números e operadores.");
    }
  };

  const handleSalvarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartaoAtivo) return alert('Você precisa ter um cartão ativo.');
    const valorOriginal = Number(formValor);
    if (valorOriginal <= 0) return alert('O valor deve ser maior que zero.');

    if (!transacaoEditandoId && isRateio) {
      for (let r of rateios) {
        if (!r.cc) return alert('Preencha o Centro de Custo em todas as linhas do rateio.');
      }
      const soma = rateios.reduce((acc, curr) => acc + Number(curr.valorStr), 0);
      const alvo = tipoRateio === 'PERCENTUAL' ? 100 : valorOriginal;
      if (Math.abs(soma - alvo) > 0.05) {
        return alert(`A soma do rateio (${soma}) não fecha com o total (${alvo}). Verifique os valores.`);
      }
    } else if (!isRateio && !formCentroCusto) {
      return alert('Selecione um Centro de Custo.');
    }

    if (transacaoEditandoId) {
      if (formParcelaAtual !== null) {
        // --- EDIÇÃO INTEGRADA DE LOTE DE PARCELAS ---
        const regexParcela = /(?:\(|\[Parc\s*)(\d+)\/(\d+)(?:\)|\])/i;
        const matchOrig = transacaoEditandoOriginal.descricao.match(regexParcela);
        const totalOriginal = parseInt(matchOrig[2], 10);
        const nomeBaseOriginal = transacaoEditandoOriginal.descricao.replace(regexParcela, '').trim();

        // Se escolheu 'APENAS_ESTA', mantemos o total de parcelas original por segurança
        const novoTotal = formEdicaoLoteModo === 'APENAS_ESTA' ? totalOriginal : formParcelas;

        // Busca todas as transações que podem pertencer a esse lote no cartão
        const { data: todasDB } = await supabase
          .from('transacao_pessoal' as any)
          .select('*')
          .eq('cartao_id', cartaoAtivo.id)
          .ilike('descricao', `%${nomeBaseOriginal}%`);

        const parcelasExistentes = (todasDB || []).filter((t: any) => {
          const m = t.descricao.match(regexParcela);
          return m && parseInt(m[2], 10) === totalOriginal; // Garante que é do mesmo lote original
        });

        const operacoesUpdate = [];
        const operacoesInsert = [];
        const operacoesDelete = [];

        // Varre de 1 até o maior número entre o Total Antigo e o Novo Total
        for (let i = 1; i <= Math.max(novoTotal, totalOriginal); i++) {
          const parcelaExistente = parcelasExistentes.find((t: any) => {
            const m = t.descricao.match(regexParcela);
            return m && parseInt(m[1], 10) === i;
          });

          let applyNewData = false;
          if (formEdicaoLoteModo === 'TODAS') applyNewData = true;
          if (formEdicaoLoteModo === 'DESTA_EM_DIANTE' && i >= formParcelaAtual) applyNewData = true;
          if (formEdicaoLoteModo === 'APENAS_ESTA' && i === formParcelaAtual) applyNewData = true;

          const novaDescricao = `${formDescricao.trim()} (${i}/${novoTotal})`;

          if (i <= novoTotal) {
            if (parcelaExistente) {
              // UPDATE
              const updateData: any = { descricao: novaDescricao };
              if (applyNewData) {
                updateData.valor = valorOriginal;
                updateData.tipo = formTipo;
                updateData.categoria_id = categoriaSelecionada?.catId || null;
                updateData.subcategoria_id = categoriaSelecionada?.subId || null;
                updateData.centro_custo_id = formCentroCusto;
                updateData.observacao = formObservacao;
                // Apenas altera a data/fatura se for exatamente a parcela sendo visualizada agora
                if (i === formParcelaAtual) {
                  updateData.data = formData;
                  updateData.mes_fatura = formFaturaDestino;
                }
              }
              operacoesUpdate.push({ id: parcelaExistente.id, ...updateData });
            } else {
              // INSERT (O usuário aumentou o total de parcelas, criando novas no futuro)
              if (formEdicaoLoteModo !== 'APENAS_ESTA') {
                const addMonths = i - formParcelaAtual;
                const faturaAlvo = avancarMesFatura(formFaturaDestino, addMonths);
                const dataObj = new Date(formData + 'T12:00:00Z');
                dataObj.setUTCMonth(dataObj.getUTCMonth() + addMonths);

                operacoesInsert.push({
                  cartao_id: cartaoAtivo.id,
                  cartao_vinculado_id: transacaoEditandoOriginal.cartao_vinculado_id,
                  user_id: transacaoEditandoOriginal.user_id,
                  descricao: novaDescricao,
                  valor: valorOriginal,
                  tipo: formTipo,
                  situacao: 'PENDENTE',
                  data: dataObj.toISOString().split('T')[0],
                  mes_fatura: faturaAlvo,
                  categoria_id: categoriaSelecionada?.catId || null,
                  subcategoria_id: categoriaSelecionada?.subId || null,
                  centro_custo_id: formCentroCusto,
                  observacao: formObservacao,
                  pluggy_transaction_id: `${transacaoEditandoOriginal.pluggy_transaction_id}_p${i}_ext`
                });
              }
            }
          } else {
            // DELETE (O usuário diminuiu o total de parcelas, então i > novoTotal)
            if (parcelaExistente && formEdicaoLoteModo !== 'APENAS_ESTA') {
              operacoesDelete.push(parcelaExistente.id);
            }
          }
        }

        // Executar as mutações
        const promises = [];
        for (const upd of operacoesUpdate) {
          const { id, ...rest } = upd;
          promises.push(supabase.from('transacao_pessoal' as any).update(rest as any).eq('id', id));
        }
        if (operacoesInsert.length > 0) promises.push(supabase.from('transacao_pessoal' as any).insert(operacoesInsert as any));
        if (operacoesDelete.length > 0) promises.push(supabase.from('transacao_pessoal' as any).delete().in('id', operacoesDelete));

        await Promise.all(promises);

        setModalAberto(false);
        resetarFormulario();
        refetch();
        queryClient.invalidateQueries({ queryKey: ['transacoes_gerais'] });
        return;
      } else {
        // --- EDIÇÃO SIMPLES (Transação normal, sem parcela) ---
        const dadosNovaEdicao = {
          tipo: formTipo,
          descricao: formDescricao,
          valor: valorOriginal,
          data: formData,
          mes_fatura: formFaturaDestino,
          observacao: formObservacao,
          categoria_id: categoriaSelecionada?.catId || null,
          subcategoria_id: categoriaSelecionada?.subId || null,
          centro_custo_id: formCentroCusto,
        };

        const { error } = await supabase.from('transacao_pessoal' as any).update(dadosNovaEdicao as any).eq('id', transacaoEditandoId);
        if (error) alert('Erro ao editar: ' + error.message);
        else {
          setModalAberto(false);
          resetarFormulario();
          refetch();
          queryClient.invalidateQueries({ queryKey: ['transacoes_gerais'] });
        }
        return;
      }
    }

    // --- CRIAÇÃO DE NOVA DESPESA ---
    const transacoesParaInserir = [];
    const qtdParcelas = formParcelado ? formParcelas : 1;

    for (let i = 0; i < qtdParcelas; i++) {
      const faturaAlvo = avancarMesFatura(formFaturaDestino, i);
      const descBase = formParcelado ? `${formDescricao} (${i + 1}/${qtdParcelas})` : formDescricao;

      if (isRateio) {
        for (let r of rateios) {
          let valorDestaLinha = 0;
          if (tipoRateio === 'PERCENTUAL') {
            valorDestaLinha = (valorOriginal * (Number(r.valorStr) / 100)) / qtdParcelas;
          } else {
            valorDestaLinha = Number(r.valorStr) / qtdParcelas;
          }

          if (valorDestaLinha > 0) {
            transacoesParaInserir.push({
              descricao: descBase,
              valor: valorDestaLinha,
              situacao: 'PENDENTE',
              tipo: formTipo,
              data: formData,
              mes_fatura: faturaAlvo,
              observacao: formObservacao,
              cartao_id: cartaoAtivo.id,
              cartao_vinculado_id: filtroVinculado === 'ALL' || filtroVinculado === 'MAIN' ? null : filtroVinculado,
              categoria_id: r.cat?.catId || null,
              subcategoria_id: r.cat?.subId || null,
              centro_custo_id: r.cc,
            });
          }
        }
      } else {
        transacoesParaInserir.push({
          descricao: descBase,
          valor: valorOriginal / qtdParcelas,
          situacao: 'PENDENTE',
          tipo: formTipo,
          data: formData,
          mes_fatura: faturaAlvo,
          observacao: formObservacao,
          cartao_id: cartaoAtivo.id,
          cartao_vinculado_id: filtroVinculado === 'ALL' || filtroVinculado === 'MAIN' ? null : filtroVinculado,
          categoria_id: categoriaSelecionada?.catId || null,
          subcategoria_id: categoriaSelecionada?.subId || null,
          centro_custo_id: formCentroCusto,
        });
      }
    }

    const { error } = await supabase.from('transacao_pessoal' as any).insert(transacoesParaInserir as any);
    if (error) alert('Erro ao salvar: ' + error.message);
    else {
      setModalAberto(false);
      resetarFormulario();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['transacoes_gerais'] });
    }
  };

  const iniciarExclusao = (t: any) => {
    const regexParcela = /(?:\(|\[Parc\s*)(\d+)\/(\d+)(?:\)|\])/i;
    if (regexParcela.test(t.descricao)) {
      setTransacaoParaExcluir(t);
      setModalExclusaoAberto(true);
    } else {
      if (window.confirm(`Deseja excluir "${t.descricao}"?`)) {
        executarExclusaoSimples(t.id);
      }
    }
  };

  const executarExclusaoSimples = async (id: string) => {
    await supabase.from('transacao_pessoal' as any).delete().eq('id', id);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['transacoes_gerais'] });
  };

  const executarExclusaoParcelada = async (modo: 'APENAS_ESTA' | 'DESTA_EM_DIANTE' | 'TODAS') => {
    if (!transacaoParaExcluir) return;

    const regexParcela = /(?:\(|\[Parc\s*)(\d+)\/(\d+)(?:\)|\])/i;
    const match = transacaoParaExcluir.descricao.match(regexParcela);

    if (!match) {
      await executarExclusaoSimples(transacaoParaExcluir.id);
      setModalExclusaoAberto(false);
      return;
    }

    const parcelaAtual = parseInt(match[1], 10);
    const totalParcelas = parseInt(match[2], 10);
    const nomeBaseOriginal = transacaoParaExcluir.descricao.replace(regexParcela, '').trim();

    if (modo === 'APENAS_ESTA') {
      await supabase.from('transacao_pessoal' as any).delete().eq('id', transacaoParaExcluir.id);
    } else {
      const { data: todasDoCartao } = await supabase
        .from('transacao_pessoal' as any)
        .select('*')
        .eq('cartao_id', transacaoParaExcluir.cartao_id)
        .ilike('descricao', `%${nomeBaseOriginal}%`);

      if (todasDoCartao && todasDoCartao.length > 0) {
        const idsParaDeletar: string[] = [];
        for (const t of todasDoCartao) {
          const m = t.descricao.match(regexParcela);
          if (m) {
            const p = parseInt(m[1], 10);
            const tot = parseInt(m[2], 10);
            if (tot === totalParcelas) {
              if (modo === 'TODAS' || (modo === 'DESTA_EM_DIANTE' && p >= parcelaAtual)) {
                idsParaDeletar.push(t.id);
              }
            }
          }
        }
        if (idsParaDeletar.length > 0) {
          await supabase.from('transacao_pessoal' as any).delete().in('id', idsParaDeletar);
        }
      }
    }

    setModalExclusaoAberto(false);
    setTransacaoParaExcluir(null);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['transacoes_gerais'] });
  };

  const handleConfirmarPagamentoFatura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contaPagamentoId) return alert('Selecione uma conta bancária para efetuar o débito.');
    if (transacoes.length === 0) return alert('Não há transações nesta fatura para pagar.');

    setProcessandoPagamento(true);
    try {
      const { data: ccGiro } = await supabase
        .from('centro_custo_projeto' as any)
        .select('id')
        .ilike('nome', '%Giro%')
        .limit(1)
        .maybeSingle();

      const { error: errUpdate } = await supabase
        .from('transacao_pessoal' as any)
        .update({ situacao: 'PAGO' } as any)
        .eq('cartao_id', cartaoAtivo.id)
        .eq('mes_fatura', faturaAtual);

      if (errUpdate) throw errUpdate;

      const { error: errInsert } = await supabase
        .from('transacao_pessoal' as any)
        .insert([{
          descricao: `Pagamento Fatura ${cartaoAtivo.nome} (${faturaAtual})`,
          valor: Math.abs(totalFaturaCompleta),
          // Tipo neutro: tira dinheiro da conta, mas não conta como gasto novo
          // (as compras do cartão já foram contadas na fatura)
          tipo: 'PAGAMENTO_FATURA',
          situacao: 'PAGO',
          data: dataPagamentoFatura,
          conta_id: contaPagamentoId,
          cartao_id: null,
          centro_custo_id: ccGiro ? (ccGiro as any).id : null,
          categoria_id: null,
          subcategoria_id: null,
          observacao: `Liquidação de fatura do cartão ${cartaoAtivo.nome}`
        }] as any);

      if (errInsert) throw errInsert;

      queryClient.invalidateQueries({ queryKey: ['transacoes_gerais'] });
      queryClient.invalidateQueries({ queryKey: ['transacoes_cartao'] });

      alert(`Fatura de ${faturaAtual} liquidada com sucesso!`);
      setModalPagarFaturaAberto(false);
      refetch();
    } catch (err: any) {
      alert('Erro ao pagar fatura: ' + err.message);
    } finally {
      setProcessandoPagamento(false);
    }
  };

  const baixarModeloCSV = () => {
    const conteudo = "Data;Descricao;Valor Total;Fatura Alvo (Ex: Set/2026);Categoria (Opcional);Centro Custo;Parcelas (Opcional);Observacao (Opcional)\n" +
                     "30/08/2026;Uber;26,22;Set/2026;Transporte;360 Gestão;1;Corrida cliente\n" +
                     "15/08/2026;Supermercado;450,00;Set/2026;Alimentação;Familiar;1;Compras do mês\n" +
                     "20/08/2026;Estorno Anuidade;-120,00;Set/2026;;Familiar;1;Valores negativos viram Estorno automaticamente";

    const blob = new Blob(["﻿" + conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_importacao_fatura.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarFaturaCSV = () => {
    if (transacoesOrdenadas.length === 0) {
      alert('Não há transações nesta fatura para exportar.');
      return;
    }
    const cabecalho = "Data;Descrição;Categoria;Centro de Custo;Valor;Situação;Observação\n";
    const linhas = transacoesOrdenadas.map((t: any) => {
      const dataFmt = new Date(t.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
      const desc = t.descricao?.replace(/;/g, ',') || '';
      const cat = renderNomeCategoria(t.categoria_id, t.subcategoria_id).replace(/;/g, ',');
      const cc = t.centro_custo_projeto?.nome?.replace(/;/g, ',') || '';
      const multiplicador = t.tipo === 'ESTORNO' ? -1 : 1;
      const val = (Number(t.valor) * multiplicador).toFixed(2).replace('.', ',');
      const sit = t.situacao || '';
      const obs = t.observacao?.replace(/;/g, ',') || '';
      return `${dataFmt};${desc};${cat};${cc};${val};${sit};${obs}`;
    }).join('\n');

    const blob = new Blob(["﻿" + cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Fatura_${cartaoAtivo?.nome}_${faturaAtual.replace('/', '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportarCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cartaoAtivo) return;

    // Busca em páginas de 1000 (limite do Supabase) e traz CC/categoria para a checagem de duplicado
    const transacoesBanco: any[] = [];
    for (let de = 0; ; de += 1000) {
      const { data: pagina, error: errBanco } = await supabase
        .from('transacao_pessoal' as any)
        .select('descricao, valor, data, tipo, centro_custo_id, categoria_id, subcategoria_id')
        .eq('cartao_id', cartaoAtivo.id)
        .order('id')
        .range(de, de + 999);
      if (errBanco) {
        alert('Erro ao ler lançamentos existentes: ' + errBanco.message);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      transacoesBanco.push(...(pagina || []));
      if (!pagina || pagina.length < 1000) break;
    }

    const reader = new FileReader();
    reader.onload = async ({ target }) => {
      try {
        const text = target?.result as string;
        const rows = text.split('\n').map(r => r.trim()).filter(r => r);

        const transacoesImportadas: any[] = [];
        const linhasComErro = [];

        linhasComErro.push("Data;Descricao;Valor Total;Fatura Alvo;Categoria;Centro Custo;Parcelas;Observacao;MOTIVO DO ERRO");

        for(let i = 1; i < rows.length; i++) {
          const linhaOriginal = rows[i];
          const colunas = linhaOriginal.split(';');
          let motivosErro = [];

          if (colunas.length < 3) {
            linhasComErro.push(`${linhaOriginal};Faltam colunas obrigatórias`);
            continue;
          }

          const [dataRaw, desc, valorRaw, faturaRaw, catRaw, ccRaw, parcelasRaw, obsRaw] = colunas;

          if (!desc || desc.trim() === '') motivosErro.push("A descrição é obrigatória");

          let dataCompraObj: any = null;
          let dataISO = "";
          const partesData = dataRaw.split('/');
          if (partesData.length !== 3) {
            motivosErro.push("Data fora do padrão DD/MM/AAAA");
          } else {
            let anoForm = partesData[2].trim();
            if (anoForm.length === 2) anoForm = "20" + anoForm;
            dataCompraObj = new Date(`${anoForm}-${partesData[1]}-${partesData[0]}T12:00:00Z`);
            if (isNaN(dataCompraObj.getTime())) {
              motivosErro.push("Data inexistente ou inválida");
            } else {
              dataISO = dataCompraObj.toISOString().split('T')[0];
            }
          }

          let cleanVal = valorRaw?.replace('R$', '').trim() || '';
          if (cleanVal.includes('.') && cleanVal.includes(',')) cleanVal = cleanVal.replace(/\./g, '').replace(',', '.');
          else if (cleanVal.includes(',')) cleanVal = cleanVal.replace(',', '.');

          const valorOriginalParsed = parseFloat(cleanVal);
          if (isNaN(valorOriginalParsed) || valorOriginalParsed === 0) motivosErro.push("Valor numérico inválido ou nulo");

          const tipoTransacao = valorOriginalParsed < 0 ? 'ESTORNO' : 'DESPESA';
          const valorFinal = Math.abs(valorOriginalParsed);

          let parcelas = 1;
          if (parcelasRaw && parcelasRaw.trim() !== '') {
              parcelas = parseInt(parcelasRaw, 10);
              if (isNaN(parcelas) || parcelas < 1) motivosErro.push("Parcelas inválidas");
              if (tipoTransacao === 'ESTORNO' && parcelas > 1) motivosErro.push("Estornos não podem ser parcelados");
          }

          const valorDaParcelaStr = (valorFinal / parcelas).toFixed(2);
          const descNormalizada = desc ? desc.replace(/\s+/g, ' ').trim().toLowerCase() : '';

          let ccMatchId = null;
          let ccEncontradoObj: any = null;
          if (ccRaw && ccRaw.trim() !== '') {
            const ccDigitado = ccRaw.trim().toLowerCase();
            ccEncontradoObj = centrosCusto.find((c: any) => c.nome.toLowerCase() === ccDigitado);
            if (ccEncontradoObj) ccMatchId = ccEncontradoObj.id;
            else motivosErro.push(`Centro de Custo '${ccRaw.trim()}' não cadastrado`);
          } else motivosErro.push("Centro de Custo é obrigatório");

          let categoriaMatchId = null;
          let subcategoriaMatchId = null;
          if (catRaw && catRaw.trim() !== '') {
            const termo = catRaw.trim().toLowerCase();
            const catEncontrada = categorias.find((c: any) => c.nome.toLowerCase() === termo);

            if (catEncontrada) {
              if (ccMatchId && catEncontrada.centro_custo_id && catEncontrada.centro_custo_id !== ccMatchId) {
                motivosErro.push(`Categoria '${catEncontrada.nome}' não pertence ao CC '${ccEncontradoObj?.nome}'`);
              } else {
                categoriaMatchId = catEncontrada.id;
              }
            } else {
              const subEncontrada = subcategorias.find((s: any) => s.nome.toLowerCase() === termo);
              if (subEncontrada) {
                const catPai = categorias.find((c: any) => c.id === subEncontrada.categoria_id);
                if (ccMatchId && catPai?.centro_custo_id && catPai.centro_custo_id !== ccMatchId) {
                  motivosErro.push(`Subcategoria '${subEncontrada.nome}' não pertence ao CC '${ccEncontradoObj?.nome}'`);
                } else {
                  categoriaMatchId = subEncontrada.categoria_id;
                  subcategoriaMatchId = subEncontrada.id;
                }
              } else motivosErro.push(`Categoria/Subcategoria '${catRaw.trim()}' não encontrada`);
            }
          }

          // DUPLICADO = mesma descrição + valor + data + tipo + CENTRO DE CUSTO + CATEGORIA + SUBCATEGORIA
          // (feito depois de identificar CC e categoria da linha)
          const normDesc = (s: any) => (s ? String(s).replace(/\s+/g, ' ').trim().toLowerCase() : '');
          const ehMesmaCompra = (t: any) => {
            const tDesc = normDesc(t.descricao);
            const descMatch = tDesc === descNormalizada || tDesc.startsWith(`${descNormalizada} (`);
            return descMatch
              && Math.abs(Number(t.valor)).toFixed(2) === valorDaParcelaStr
              && (t.data ? String(t.data).split('T')[0] : '') === dataISO
              && (t.tipo || 'DESPESA') === tipoTransacao
              && (t.centro_custo_id || null) === (ccMatchId || null)
              && (t.categoria_id || null) === (categoriaMatchId || null)
              && (t.subcategoria_id || null) === (subcategoriaMatchId || null);
          };

          if (transacoesBanco.some(ehMesmaCompra)) motivosErro.push("Transação já existe no banco (mesmo CC e categoria)");
          if (transacoesImportadas.some(ehMesmaCompra) && (parcelasRaw === '1' || !parcelasRaw)) motivosErro.push("Transação duplicada dentro da própria planilha (mesmo CC e categoria)");

          let faturaBaseImportacao = "";
          if (faturaRaw && faturaRaw.trim() !== '') {
            const faturaNormalizada = faturaRaw.trim().replace(/\s+/g, '');
            if (faturaNormalizada.includes('/')) {
              const [mRaw, aRaw] = faturaNormalizada.split('/');
              const strMes = mRaw.toLowerCase().substring(0, 3);
              const mesEncontrado = mesesNomes.find(m => m.toLowerCase().startsWith(strMes));
              let anoFormFatura = aRaw;
              if (anoFormFatura.length === 2) anoFormFatura = "20" + anoFormFatura;

              if (mesEncontrado) faturaBaseImportacao = `${mesEncontrado}/${anoFormFatura}`;
              else motivosErro.push("Mês da fatura não reconhecido");
            } else motivosErro.push("Fatura Alvo fora do padrão Mês/Ano");
          } else if (dataCompraObj && !isNaN(dataCompraObj.getTime())) {
            let mesIdx = dataCompraObj.getUTCMonth();
            let anoObj = dataCompraObj.getUTCFullYear();
            const diaFechamento = cartaoAtivo?.dia_fechamento || 31;

            if (dataCompraObj.getUTCDate() > diaFechamento) {
              mesIdx++;
              if (mesIdx > 11) { mesIdx = 0; anoObj++; }
            }
            faturaBaseImportacao = `${mesesNomes[mesIdx]}/${anoObj}`;
          }

          if (motivosErro.length > 0) {
            linhasComErro.push(`${linhaOriginal};${motivosErro.join(' | ')}`);
          } else {
            const valorParcela = valorFinal / parcelas;
            for (let p = 0; p < parcelas; p++) {
              transacoesImportadas.push({
                cartao_id: cartaoAtivo.id,
                data: dataISO,
                mes_fatura: avancarMesFatura(faturaBaseImportacao, p),
                descricao: parcelas > 1 ? `${desc.trim()} (${p + 1}/${parcelas})` : desc.trim(),
                valor: valorParcela,
                categoria_id: categoriaMatchId,
                subcategoria_id: subcategoriaMatchId,
                centro_custo_id: ccMatchId,
                tipo: tipoTransacao,
                situacao: 'PENDENTE',
                observacao: obsRaw ? obsRaw.trim() : 'Importado via CSV',
              });
            }
          }
        }

        if (transacoesImportadas.length > 0) {
          const { error } = await supabase.from('transacao_pessoal' as any).insert(transacoesImportadas as any);
          if (error) { alert('Erro ao gravar no banco: ' + error.message); return; }
        }

        if (linhasComErro.length > 1) {
          const conteudoCsv = linhasComErro.join('\n');
          const blob = new Blob(["﻿" + conteudoCsv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", "erros_importacao_corrigir.csv");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          alert(`⚠️ Processamento concluído com ressalvas:\n\n✅ Sucesso: ${transacoesImportadas.length} parcelas registradas.\n❌ Rejeitadas: ${linhasComErro.length - 1} linhas inconsistentes.\n\nO arquivo 'erros_importacao_corrigir.csv' com as justificativas foi baixado automaticamente.`);
        } else if (transacoesImportadas.length > 0) {
           alert(`✅ Importação concluída! ${transacoesImportadas.length} lançamentos salvos com sucesso.`);
        } else {
           alert("Nenhuma transação identificada na planilha.");
        }

        refetch();
        queryClient.invalidateQueries({ queryKey: ['transacoes_gerais'] });

      } catch (err) { alert("Erro no processamento do arquivo CSV."); }
    };
    reader.readAsText(file, 'ISO-8859-1');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (carregandoCartoes) return <div className="p-6 text-zinc-400">Carregando dados...</div>;

  if (cartoes.length === 0) return (
    <div className="p-6 text-center mt-20">
      <h2 className="text-xl text-white font-bold mb-2">Nenhum Cartão Cadastrado</h2>
      <p className="text-zinc-400">Volte para a tela anterior e cadastre um cartão primeiro.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-zinc-100 p-4 md:p-6 pb-24 relative">
      <ContestarModal transacao={contestando} onFechar={() => setContestando(null)} />

      <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportarCSV} className="hidden" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Link to="/financas/cartoes">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white bg-white/5"><ChevronLeft className="w-5 h-5" /></Button>
          </Link>
          <div className="bg-[#10b981] text-black px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2">
            Cartão: {cartaoAtivo?.nome}
          </div>

          {cartoes.length > 1 && (
            <div className="flex gap-2 bg-[#1e1e24] border border-white/5 p-1 rounded-full">
              {cartoes.map((c: any) => (
                <button key={c.id} onClick={() => setCartaoAtivo(c)} className={cn("px-3 py-1 rounded-full text-xs font-bold transition-all", cartaoAtivo?.id === c.id ? "bg-white/20 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                  {c.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {podeEditar && <Button
            onClick={() => setModalPagarFaturaAberto(true)}
            disabled={faturaEstaPaga || transacoesFiltradas.length === 0}
            className={cn("font-bold flex items-center gap-2 h-9 shadow-sm transition-all", faturaEstaPaga ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default" : "bg-[#10b981] hover:bg-[#059669] text-black")}
          >
            <CheckCircle2 className="w-4 h-4" /> {faturaEstaPaga ? 'Fatura Paga' : 'Pagar Fatura'}
          </Button>}

          <Button onClick={exportarFaturaCSV} variant="outline" className="border-[#3b82f6]/50 text-[#3b82f6] hover:bg-[#3b82f6]/10 bg-transparent text-xs font-bold h-9">
            <DownloadCloud className="w-4 h-4 mr-2" /> Exportar Fatura
          </Button>
          {podeEditar && <>
          <Button onClick={baixarModeloCSV} variant="outline" className="border-white/10 bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white text-xs font-bold h-9">
            <Download className="w-4 h-4 mr-2" /> Modelo CSV
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="border-[#10b981]/50 text-[#10b981] hover:bg-[#10b981]/10 bg-transparent text-xs font-bold h-9">
            <Upload className="w-4 h-4 mr-2" /> Importar Planilha
          </Button>
          <Button onClick={abrirModalNovaDespesa} className="bg-[#10b981] hover:bg-[#059669] text-black font-bold flex items-center gap-2 h-9">
            <Plus className="w-4 h-4" /> Nova Despesa
          </Button>
          </>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="lg:col-span-2 bg-[#1e1e24] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => setAnoSelecionado(a => a - 1)} className="text-[#10b981] hover:bg-[#10b981]/10"><ChevronLeft className="w-5 h-5" /></Button>
            <span className="text-[#10b981] font-bold text-sm">{anoSelecionado}</span>
            <Button variant="ghost" size="icon" onClick={() => setAnoSelecionado(a => a + 1)} className="text-[#10b981] hover:bg-[#10b981]/10"><ChevronRight className="w-5 h-5" /></Button>
          </div>
          <div className="flex justify-between overflow-x-auto pb-4 scrollbar-hide gap-2 mb-6">
            {mesesNomes.map(m => (
              <button key={m} onClick={() => setMesSelecionado(m)} className={cn("px-4 py-1.5 rounded-full text-xs font-bold border transition-colors", mesSelecionado === m ? "border-[#10b981] text-[#10b981] bg-[#10b981]/10" : "border-white/10 text-zinc-500 hover:border-[#10b981]/50")}>
                {m}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-zinc-400 font-bold uppercase border-b border-white/5 select-none">
                <tr>
                  <th className="pb-3 cursor-pointer group" onClick={() => requestSort('data')}>
                    <div className="flex items-center">Data {renderSortIcon('data')}</div>
                  </th>
                  <th className="pb-3 cursor-pointer group" onClick={() => requestSort('descricao')}>
                    <div className="flex items-center">Descrição {renderSortIcon('descricao')}</div>
                  </th>
                  <th className="pb-3 cursor-pointer group" onClick={() => requestSort('categoria')}>
                    <div className="flex items-center">Categoria & C. Custo {renderSortIcon('categoria')}</div>
                  </th>
                  <th className="pb-3 cursor-pointer group text-right" onClick={() => requestSort('valor')}>
                    <div className="flex items-center justify-end">Valor {renderSortIcon('valor')}</div>
                  </th>
                  <th className="pb-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transacoesOrdenadas.length === 0 ? (
                   <tr><td colSpan={5} className="py-8 text-center text-zinc-500">Nenhuma compra listada na fatura de {faturaAtual}.</td></tr>
                ) : (
                  transacoesOrdenadas.map((t: any) => (
                    <tr key={t.id} className="hover:bg-white/[0.02]">
                      <td className="py-4 text-zinc-300 whitespace-nowrap">{new Date(t.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                      <td className="py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-white">{t.descricao}</span>
                          {t.cartao_vinculado_id && (
                            <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-zinc-400 w-fit flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              {cartoesVinculados.find((cv: any) => cv.id === t.cartao_vinculado_id)?.nome_impresso || 'Cartão Adicional'}
                            </span>
                          )}
                          {t.observacao && <span className="text-xs text-zinc-400 flex items-center gap-1 mt-1 truncate max-w-[350px]"><FileText className="w-3.5 h-3.5 flex-shrink-0" /> {t.observacao}</span>}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col gap-1">
                          <span className={cn("border px-2.5 py-1 rounded-full text-[10px] inline-block max-w-fit truncate", !t.categoria_id ? "bg-amber-500/10 border-amber-500/20 text-amber-500 font-bold" : "bg-[#1a1a20] border-white/5 text-zinc-300")}>
                            {renderNomeCategoria(t.categoria_id, t.subcategoria_id)}
                          </span>
                          <span className={cn("border px-2.5 py-1 rounded-full text-[10px] font-bold inline-block max-w-fit truncate flex items-center gap-1", !t.centro_custo_id ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-purple-500/10 border-purple-500/20 text-purple-400")}>
                            <Briefcase className="w-3 h-3" />
                            {t.centro_custo_projeto?.nome || 'CC Pendente'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 text-right font-bold whitespace-nowrap">
                        <span className={t.tipo === 'ESTORNO' ? 'text-[#10b981]' : 'text-[#e74c3c]'}>
                          {t.tipo === 'ESTORNO' ? '+' : '-'} R$ {Number(t.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </span>
                      </td>
                      <td className="py-4 text-center">
                      {!podeEditar && podeContestar(renderNomeCategoria(t.categoria_id)) && <button onClick={() => setContestando(t)} className="text-[11px] font-bold text-amber-400 hover:text-amber-300 px-2 py-1 rounded-md hover:bg-amber-500/10" title="Contestar classificação">Contestar</button>}
                        {podeEditar && <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => abrirModalEdicao(t)} className="h-8 w-8 text-zinc-500 hover:text-white"><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => iniciarExclusao(t)} className="h-8 w-8 text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                        </div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">

          {/* FILTRO DE CARTÕES ADICIONAIS */}
          {cartoesVinculados.length > 0 && (
            <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden">
              <div className="flex justify-between items-center">
                <p className="text-zinc-400 text-xs">Filtrar Lançamentos</p>
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Filter className="w-4 h-4 text-purple-500" />
                </div>
              </div>
              <div className="relative z-10">
                <select
                  value={filtroVinculado}
                  onChange={(e) => setFiltroVinculado(e.target.value)}
                  className="w-full bg-[#141417] text-white border border-white/10 rounded-lg p-2.5 pr-8 focus:border-[#10b981] focus:outline-none transition-all text-sm appearance-none cursor-pointer font-bold shadow-sm"
                >
                  <option value="ALL">💳 Todos os Cartões</option>
                  <option value="MAIN">⭐ Cartão Principal</option>
                  {cartoesVinculados.map((cv: any) => (
                    <option key={cv.id} value={cv.id}>🔹 {cv.nome_impresso}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Valor da fatura</p><p className="text-2xl font-bold text-white">R$ {totalFatura.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div>
            <div className="w-10 h-10 rounded-full bg-[#10b981]/20 flex items-center justify-center"><DollarSign className="w-5 h-5 text-[#10b981]" /></div>
          </div>

          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div>
              <p className="text-zinc-400 text-xs mb-1">Status</p>
              <p className={cn("text-xl font-bold", faturaEstaPaga ? "text-[#10b981]" : "text-white")}>
                {faturaEstaPaga ? "Fatura Paga" : "Fatura Aberta"}
              </p>
            </div>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", faturaEstaPaga ? "bg-[#10b981]/20" : "bg-[#3498db]/20")}>
              {faturaEstaPaga ? <CheckCircle2 className="w-5 h-5 text-[#10b981]" /> : <Receipt className="w-5 h-5 text-[#3498db]" />}
            </div>
          </div>

          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Dia de fechamento</p><p className="text-xl font-bold text-white">{cartaoAtivo?.dia_fechamento || '--'} de {mesSelecionado}</p></div>
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center"><Calendar className="w-5 h-5 text-amber-500" /></div>
          </div>

          <div className="bg-[#1e1e24] border border-white/5 rounded-2xl p-5 flex justify-between items-center">
            <div><p className="text-zinc-400 text-xs mb-1">Data vencimento</p><p className="text-xl font-bold text-white">{cartaoAtivo?.dia_vencimento || '--'} de {mesSelecionado}</p></div>
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center"><Calendar className="w-5 h-5 text-red-500" /></div>
          </div>
        </div>
      </div>

      {/* MODAL DE PAGAMENTO DE FATURA */}
      {modalPagarFaturaAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a20] rounded-2xl w-full max-w-md border border-white/10 shadow-2xl p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
                Liquidar Fatura
              </h3>
              <button onClick={() => setModalPagarFaturaAberto(false)} className="text-zinc-500 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-zinc-400 mb-5">
              Confirmar o pagamento da fatura de <b className="text-white">{faturaAtual}</b> do cartão <b className="text-white">{cartaoAtivo?.nome}</b> no valor total de{' '}
              <span className="text-[#10b981] font-bold">
                R$ {totalFaturaCompleta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>.
            </p>
            {filtroVinculado !== 'ALL' && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 -mt-2 mb-5">
                Atenção: há um filtro de cartão ativo na tela, mas o pagamento quita a fatura INTEIRA
                (todos os cartões vinculados), no valor total acima.
              </p>
            )}

            <form onSubmit={handleConfirmarPagamentoFatura} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Conta de Débito (Saída do Dinheiro)
                </label>
                <div className="flex items-center bg-[#1e1e24] border border-white/10 rounded-xl px-3">
                  <Wallet className="w-4 h-4 text-zinc-400 mr-2" />
                  <select
                    required
                    value={contaPagamentoId}
                    onChange={(e) => setContaPagamentoId(e.target.value)}
                    className="w-full bg-transparent text-sm text-white py-3 focus:outline-none cursor-pointer"
                  >
                    {contas.map((c: any) => (
                      <option key={c.id} value={c.id} className="bg-[#1a1a20] text-white">
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Data do Pagamento
                </label>
                <div className="flex items-center bg-[#1e1e24] border border-white/10 rounded-xl px-3">
                  <Calendar className="w-4 h-4 text-zinc-400 mr-2" />
                  <input
                    type="date"
                    required
                    value={dataPagamentoFatura}
                    onChange={(e) => setDataPagamentoFatura(e.target.value)}
                    className="w-full bg-transparent text-sm text-white py-3 focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setModalPagarFaturaAberto(false)}
                  className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processandoPagamento}
                  className="bg-[#10b981] hover:bg-[#059669] disabled:opacity-50 text-black px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-[#10b981]/20"
                >
                  {processandoPagamento ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Exclusão de Parcelas */}
      {modalExclusaoAberto && transacaoParaExcluir && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a20] rounded-2xl w-full max-w-md border border-white/10 shadow-2xl p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">Excluir Compra Parcelada</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-6">A transação <span className="text-white font-semibold">"{transacaoParaExcluir.descricao}"</span> faz parte de uma compra parcelada. Como deseja proceder?</p>
            <div className="space-y-3">
              <button onClick={() => executarExclusaoParcelada('APENAS_ESTA')} className="w-full bg-[#22222a] hover:bg-[#2c2c36] border border-white/5 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all text-left flex justify-between items-center">
                <span>Apenas esta parcela</span><span className="text-xs text-zinc-500">Exclui só este mês</span>
              </button>
              <button onClick={() => executarExclusaoParcelada('DESTA_EM_DIANTE')} className="w-full bg-[#22222a] hover:bg-[#2c2c36] border border-white/5 text-amber-400 font-semibold py-3 px-4 rounded-xl text-sm transition-all text-left flex justify-between items-center">
                <span>Desta em diante</span><span className="text-xs text-zinc-500">Mantém as faturas passadas</span>
              </button>
              <button onClick={() => executarExclusaoParcelada('TODAS')} className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold py-3 px-4 rounded-xl text-sm transition-all text-left flex justify-between items-center">
                <span>Todas as parcelas</span><span className="text-xs text-red-500/70">Apaga o histórico completo</span>
              </button>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 flex justify-end">
              <button onClick={() => { setModalExclusaoAberto(false); setTransacaoParaExcluir(null); }} className="px-4 py-2 text-sm text-zinc-400 font-medium hover:text-white transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Lançamento / Edição */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a20] rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center shrink-0">
              <h2 className="text-xl text-white font-bold flex items-center gap-2">
                <CreditCard className="text-[#10b981]" size={20} />
                {transacaoEditandoId ? 'Editar Lançamento' : 'Novo Lançamento'}
              </h2>
              <button onClick={() => setModalAberto(false)} className="text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* COLUNA ESQUERDA */}
                <div className="space-y-5">
                  <div className="flex bg-[#22222a] p-1 rounded-lg border border-white/5">
                    <button type="button" onClick={() => setFormTipo('DESPESA')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formTipo === 'DESPESA' ? 'bg-[#e74c3c]/20 text-[#e74c3c] shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Despesa</button>
                    <button type="button" onClick={() => setFormTipo('ESTORNO')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${formTipo === 'ESTORNO' ? 'bg-[#10b981]/20 text-[#10b981] shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Estorno na Fatura</button>
                  </div>

                  {/* Se for edição de parcela, mostra o Total de Parcelas Editável */}
                  {formParcelaAtual !== null ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1.5">Parcela Atual</label>
                        <input type="text" disabled value={formParcelaAtual} className="w-full bg-[#1e1e24]/50 text-zinc-500 border border-white/5 rounded-xl p-3 cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="text-[#10b981] text-[10px] font-bold uppercase block mb-1.5">Total de Parcelas</label>
                        <input type="number" min={formParcelaAtual} value={formParcelas} onChange={(e) => setFormParcelas(Number(e.target.value))} disabled={formEdicaoLoteModo === 'APENAS_ESTA'} className="w-full bg-[#1e1e24] text-white border border-[#10b981]/50 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all disabled:opacity-50" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1.5">Data da Compra (Fato Real)</label>
                        <input type="date" required value={formData} onChange={(e) => setFormData(e.target.value)} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all [color-scheme:dark] text-sm" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Valor Total</label>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R$</span>
                        <input type="number" step="0.01" required value={formValor} onChange={(e) => setFormValor(e.target.value)} className="w-full bg-[#1e1e24] text-white text-xl font-bold border border-white/10 rounded-xl py-3 pl-12 pr-4 focus:border-[#10b981] focus:outline-none transition-all" placeholder="0,00" />
                      </div>
                      <Button type="button" onClick={() => setCalcAberto(!calcAberto)} variant="outline" size="icon" className="h-[52px] w-[52px] shrink-0 border-white/10 bg-[#1e1e24] hover:bg-[#10b981]/10 text-zinc-400 hover:text-[#10b981]">
                        <Calculator className="w-5 h-5" />
                      </Button>
                      {calcAberto && (
                        <div className="absolute top-[110%] right-0 z-50 bg-[#22222a] border border-white/10 p-3 rounded-xl shadow-2xl w-64 animate-fade-in">
                          <input type="text" autoFocus value={calcVisor} onChange={(e) => setCalcVisor(e.target.value)} placeholder="Ex: 50.40 + 20 * 2" className="w-full bg-[#141417] text-white text-right p-2 rounded-lg mb-2 focus:outline-none border border-white/5" onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); lidarComCalculadora(calcVisor); } }} />
                          <div className="grid grid-cols-4 gap-1.5">
                            {['7','8','9','/','4','5','6','*','1','2','3','-','C','0',',','+'].map(btn => (
                              <button type="button" key={btn} onClick={() => { if(btn === 'C') setCalcVisor(''); else setCalcVisor(prev => prev + btn); }} className="bg-[#1a1a20] hover:bg-white/10 text-white font-bold py-2 rounded-lg transition-colors">{btn}</button>
                            ))}
                            <button type="button" onClick={() => lidarComCalculadora(calcVisor)} className="col-span-4 bg-[#10b981] hover:bg-[#059669] text-black font-bold py-2 rounded-lg transition-colors mt-1">=</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Descrição do Lançamento</label>
                    <input type="text" required value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all" placeholder="Ex: Mercado Livre" />
                  </div>
                </div>

                {/* COLUNA DIREITA */}
                <div className="space-y-5">
                  {!transacaoEditandoId && (
                    <div className="flex items-center justify-between bg-[#1e1e24] p-3 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2">
                        <SplitSquareHorizontal className="w-4 h-4 text-[#3b82f6]" />
                        <span className="text-sm font-semibold text-white">Ratear Lançamento?</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={isRateio} onChange={(e) => setIsRateio(e.target.checked)}/>
                        <div className="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3b82f6]"></div>
                      </label>
                    </div>
                  )}
                  {!isRateio ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1.5">Centro de Custo</label>
                        <select required value={formCentroCusto} onChange={(e) => { setFormCentroCusto(e.target.value); setCategoriaSelecionada(null); }} className={cn("w-full bg-[#1e1e24] text-white border rounded-xl p-3 focus:outline-none transition-all text-sm h-[46px] cursor-pointer", formCentroCusto ? "border-white/10" : "border-red-500/50")}>
                          <option value="" disabled>⚠️ Selecione</option>
                          {centrosCusto.map((cc: any) => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
                        </select>
                      </div>
                      <div className="relative">
                        <label className="text-zinc-400 text-[10px] font-bold uppercase block mb-1.5">Categoria</label>
                        <button type="button" onClick={() => setDropdownCatAberto(0)} className={cn("w-full bg-[#1e1e24] text-left border rounded-xl p-3 flex justify-between items-center transition-all h-[46px]", dropdownCatAberto === 0 ? "border-[#10b981]" : "border-white/10 hover:border-white/20")}>
                          <span className={cn("truncate text-sm", categoriaSelecionada ? "text-white font-medium" : "text-zinc-500")}>
                            {categoriaSelecionada ? categoriaSelecionada.nomeDisplay : 'Sem Categoria (Opcional)'}
                          </span>
                          <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0 ml-2" />
                        </button>
                        {dropdownCatAberto === 0 && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setDropdownCatAberto(null)}></div>
                            <div className="absolute top-[calc(100%+8px)] right-0 w-[300px] bg-[#1e1e24] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-64">
                              <div className="p-2 border-b border-white/5 flex items-center gap-2 bg-[#1a1a20]">
                                <Search className="w-4 h-4 text-zinc-500 ml-2" />
                                <input type="text" autoFocus placeholder="Buscar categoria..." value={buscaCat} onChange={(e) => setBuscaCat(e.target.value)} className="w-full bg-transparent text-sm text-white placeholder-zinc-500 p-1 focus:outline-none" />
                              </div>
                              <div className="overflow-y-auto p-1 custom-scrollbar flex-1">
                                {categoriasFiltradas(formCentroCusto).length === 0 ? <p className="p-3 text-xs text-center text-zinc-500">Nenhuma categoria encontrada.</p> : categoriasFiltradas(formCentroCusto).map((cat: any) => {
                                    const subsDaCategoria = subcategorias.filter((sub: any) => sub.categoria_id === cat.id);
                                    return (
                                      <div key={cat.id} className="mb-1">
                                        <button type="button" onClick={() => { setCategoriaSelecionada({catId: cat.id, nomeDisplay: cat.nome}); setDropdownCatAberto(null); }} className="w-full text-left px-3 py-2 text-sm font-semibold text-white hover:bg-white/5 rounded-lg transition-colors flex items-center justify-between">{cat.nome}</button>
                                        {subsDaCategoria.map((sub: any) => (
                                          <button key={sub.id} type="button" onClick={() => { setCategoriaSelecionada({catId: cat.id, subId: sub.id, nomeDisplay: `${cat.nome} • ${sub.nome}`}); setDropdownCatAberto(null); }} className="w-full text-left pl-8 pr-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2 mt-0.5">
                                            <CornerDownRight className="w-3 h-3 text-zinc-600" />{sub.nome}
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 bg-[#141417] p-4 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex bg-[#22222a] p-1 rounded-md border border-white/5">
                          <button type="button" onClick={() => setTipoRateio('VALOR')} className={`px-3 py-1 text-xs font-bold rounded transition-all ${tipoRateio === 'VALOR' ? 'bg-[#3b82f6] text-white' : 'text-zinc-500 hover:text-white'}`}>R$</button>
                          <button type="button" onClick={() => setTipoRateio('PERCENTUAL')} className={`px-3 py-1 text-xs font-bold rounded transition-all ${tipoRateio === 'PERCENTUAL' ? 'bg-[#3b82f6] text-white' : 'text-zinc-500 hover:text-white'}`}>%</button>
                        </div>
                        <span className="text-xs font-bold text-zinc-400">Restante: <span className={Math.abs((tipoRateio === 'PERCENTUAL' ? 100 : Number(formValor)) - rateios.reduce((a,c) => a + Number(c.valorStr), 0)) < 0.05 ? 'text-[#10b981]' : 'text-amber-500'}>
                          {tipoRateio === 'VALOR' ? 'R$ ' : ''}
                          {Math.max(0, (tipoRateio === 'PERCENTUAL' ? 100 : Number(formValor)) - rateios.reduce((a,c) => a + Number(c.valorStr), 0)).toFixed(2)}
                          {tipoRateio === 'PERCENTUAL' ? '%' : ''}
                        </span></span>
                      </div>
                      {rateios.map((r, idx) => (
                        <div key={r.id} className="flex gap-2 items-start relative">
                          <div className="flex-1 space-y-2">
                            <select required value={r.cc} onChange={(e) => { const nr = [...rateios]; nr[idx].cc = e.target.value; nr[idx].cat = null as any; setRateios(nr); }} className={cn("w-full bg-[#1e1e24] text-white border rounded-lg p-2 focus:outline-none transition-all text-xs h-[36px]", r.cc ? "border-white/10" : "border-red-500/50")}>
                              <option value="" disabled>CC...</option>
                              {centrosCusto.map((cc: any) => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
                            </select>
                            <div className="relative">
                              <button type="button" onClick={() => setDropdownCatAberto(r.id)} className="w-full bg-[#1e1e24] text-left border border-white/10 rounded-lg p-2 flex justify-between items-center text-xs h-[36px]">
                                <span className={cn("truncate", r.cat ? "text-white font-medium" : "text-zinc-500")}>{r.cat ? r.cat.nomeDisplay : 'Cat... (Opcional)'}</span>
                                <ChevronDown className="w-3 h-3 text-zinc-500 flex-shrink-0 ml-1" />
                              </button>
                              {dropdownCatAberto === r.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setDropdownCatAberto(null)}></div>
                                  <div className="absolute bottom-[calc(100%+8px)] left-0 w-full min-w-[250px] bg-[#1e1e24] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-48">
                                    <div className="p-2 border-b border-white/5 flex items-center gap-2 bg-[#1a1a20]">
                                      <Search className="w-3 h-3 text-zinc-500 ml-1" />
                                      <input type="text" autoFocus placeholder="Buscar..." value={buscaCat} onChange={(e) => setBuscaCat(e.target.value)} className="w-full bg-transparent text-xs text-white placeholder-zinc-500 p-1 focus:outline-none" />
                                    </div>
                                    <div className="overflow-y-auto p-1 custom-scrollbar flex-1">
                                      {categoriasFiltradas(r.cc).length === 0 ? <p className="p-2 text-[10px] text-center text-zinc-500">Nenhuma encontrada.</p> : categoriasFiltradas(r.cc).map((cat: any) => {
                                          const subs = subcategorias.filter((sub: any) => sub.categoria_id === cat.id);
                                          return (
                                            <div key={cat.id} className="mb-0.5">
                                              <button type="button" onClick={() => { const nr=[...rateios]; nr[idx].cat={catId:cat.id, nomeDisplay:cat.nome}; setRateios(nr); setDropdownCatAberto(null); }} className="w-full text-left px-2 py-1.5 text-xs font-semibold text-white hover:bg-white/5 rounded-md transition-colors">{cat.nome}</button>
                                              {subs.map((sub: any) => (
                                                <button key={sub.id} type="button" onClick={() => { const nr=[...rateios]; nr[idx].cat={catId:cat.id, subId:sub.id, nomeDisplay:`${cat.nome} • ${sub.nome}`}; setRateios(nr); setDropdownCatAberto(null); }} className="w-full text-left pl-5 pr-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-colors flex items-center gap-1.5">
                                                  <CornerDownRight className="w-2.5 h-2.5" />{sub.nome}
                                                </button>
                                              ))}
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="w-24 shrink-0 flex items-center relative h-[36px]">
                            {tipoRateio === 'PERCENTUAL' ? <Percent className="w-3 h-3 absolute left-2 text-zinc-500" /> : <span className="absolute left-2 text-zinc-500 font-bold text-[10px]">R$</span>}
                            <input type="number" step="0.01" value={r.valorStr} onChange={(e) => { const nr = [...rateios]; nr[idx].valorStr = e.target.value; setRateios(nr); }} className={cn("w-full bg-[#1e1e24] text-white text-xs font-bold border border-white/10 rounded-lg h-full focus:border-[#3b82f6] focus:outline-none transition-all pr-2", tipoRateio === 'PERCENTUAL' ? "pl-6" : "pl-6")} placeholder="0,00" />
                          </div>
                          {rateios.length > 2 && <button type="button" onClick={() => setRateios(rateios.filter(rat => rat.id !== r.id))} className="h-[36px] px-2 text-zinc-600 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                        </div>
                      ))}
                      {rateios.length < 5 && (
                        <button type="button" onClick={() => setRateios([...rateios, { id: Date.now(), cc: '', cat: null as any, valorStr: '' }])} className="w-full mt-2 border border-dashed border-white/10 text-zinc-400 text-xs py-2 rounded-lg hover:bg-white/5 hover:text-white transition-colors">
                          + Adicionar Divisão
                        </button>
                      )}
                    </div>
                  )}

                  {/* Seção Integrada de Lote para Edição de Parcelas */}
                  {formParcelaAtual !== null ? (
                    <div className="bg-[#141417] p-4 rounded-xl border border-white/5 space-y-4 mt-2">
                      <div className="flex items-center gap-2 text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-bold">Atenção! Esta é uma despesa parcelada ({formParcelaAtual}/{transacaoEditandoOriginal?.descricao.match(/(?:\(|\[Parc\s*)(\d+)\/(\d+)(?:\)|\])/i)?.[2]}).</span>
                      </div>
                      <span className="text-xs text-zinc-400 block mb-2">Como deseja aplicar as edições (valor, categoria, parcelas)?</span>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center transition-colors", formEdicaoLoteModo === 'APENAS_ESTA' ? "border-[#10b981]" : "border-zinc-500 group-hover:border-zinc-400")}>
                          {formEdicaoLoteModo === 'APENAS_ESTA' && <div className="w-2 h-2 rounded-full bg-[#10b981]" />}
                        </div>
                        <input type="radio" name="loteMode" className="hidden" checked={formEdicaoLoteModo === 'APENAS_ESTA'} onChange={() => setFormEdicaoLoteModo('APENAS_ESTA')} />
                        <span className={cn("text-sm transition-colors font-medium", formEdicaoLoteModo === 'APENAS_ESTA' ? "text-white" : "text-zinc-400 group-hover:text-zinc-300")}>Editar somente esta</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center transition-colors", formEdicaoLoteModo === 'DESTA_EM_DIANTE' ? "border-[#10b981]" : "border-zinc-500 group-hover:border-zinc-400")}>
                          {formEdicaoLoteModo === 'DESTA_EM_DIANTE' && <div className="w-2 h-2 rounded-full bg-[#10b981]" />}
                        </div>
                        <input type="radio" name="loteMode" className="hidden" checked={formEdicaoLoteModo === 'DESTA_EM_DIANTE'} onChange={() => setFormEdicaoLoteModo('DESTA_EM_DIANTE')} />
                        <span className={cn("text-sm transition-colors font-medium", formEdicaoLoteModo === 'DESTA_EM_DIANTE' ? "text-white" : "text-zinc-400 group-hover:text-zinc-300")}>Editar esta, e as futuras</span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center transition-colors", formEdicaoLoteModo === 'TODAS' ? "border-[#10b981]" : "border-zinc-500 group-hover:border-zinc-400")}>
                          {formEdicaoLoteModo === 'TODAS' && <div className="w-2 h-2 rounded-full bg-[#10b981]" />}
                        </div>
                        <input type="radio" name="loteMode" className="hidden" checked={formEdicaoLoteModo === 'TODAS'} onChange={() => setFormEdicaoLoteModo('TODAS')} />
                        <span className={cn("text-sm transition-colors font-medium", formEdicaoLoteModo === 'TODAS' ? "text-white" : "text-zinc-400 group-hover:text-zinc-300")}>Editar todas (incluindo efetivadas)</span>
                      </label>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-[#10b981] text-[10px] font-bold uppercase block mb-1.5">Lançar/Alterar Para a Fatura de:</label>
                        <select value={formFaturaDestino} onChange={(e) => setFormFaturaDestino(e.target.value)} className="w-full bg-[#10b981]/10 text-[#10b981] font-bold border border-[#10b981]/30 rounded-xl p-3 focus:outline-none transition-all text-sm appearance-none cursor-pointer">
                          {opcoesFatura.map(f => <option key={f} value={f} className="bg-[#1e1e24] text-white">{f}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {!transacaoEditandoId && formTipo === 'DESPESA' && (
                    <div className="p-4 bg-[#1e1e24] border border-white/10 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-sm font-bold text-white block">Parcelar Compra?</span>
                          <span className="text-xs text-zinc-500">Dividir nas próximas faturas</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={formParcelado} onChange={(e) => setFormParcelado(e.target.checked)}/>
                          <div className="w-11 h-6 bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10b981]"></div>
                        </label>
                      </div>
                      {formParcelado && (
                        <div className="border-t border-white/10 pt-4">
                          <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Qtd Parcelas</label>
                          <input type="number" min="2" max="48" value={formParcelas} onChange={(e) => setFormParcelas(Number(e.target.value))} className="w-full bg-[#1a1a20] text-white border border-white/10 rounded-lg p-2.5 focus:border-[#10b981] focus:outline-none" />
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-zinc-400 text-xs font-bold uppercase block mb-1.5">Observações (Opcional)</label>
                    <textarea value={formObservacao} onChange={(e) => setFormObservacao(e.target.value)} rows={3} className="w-full bg-[#1e1e24] text-white border border-white/10 rounded-xl p-3 focus:border-[#10b981] focus:outline-none transition-all resize-none" placeholder="Detalhes adicionais..." />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 flex justify-end gap-3 shrink-0 bg-[#1a1a20]">
              <button type="button" onClick={() => setModalAberto(false)} className="px-6 py-2.5 text-sm text-zinc-400 font-bold hover:text-white transition-colors">CANCELAR</button>
              <button onClick={handleSalvarDespesa} className="bg-[#10b981] text-black hover:bg-[#059669] px-8 py-2.5 rounded-lg text-sm font-bold transition-all">
                {transacaoEditandoId ? 'SALVAR ALTERAÇÕES' : 'SALVAR LANÇAMENTO'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
