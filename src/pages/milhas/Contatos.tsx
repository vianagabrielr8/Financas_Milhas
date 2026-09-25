import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscarContatos } from '@/lib/milhas';
import { Campo, BotaoRoxo, Janela, inputCls } from '@/components/milhas/ui';
import { TelaCadastro, LinhaCadastro, apagarCadastro, alternarAtivo, salvarCadastro } from '@/components/milhas/cadastro';
import { normalizarBusca } from './util';

const NOME_CONTATO: Record<string, string> = { CLIENTE: 'Cliente', FORNECEDOR: 'Fornecedor', AMBOS: 'Cliente e fornecedor' };

export default function Contatos() {
  const contatos = useQuery({ queryKey: ['milhas_contatos'], queryFn: buscarContatos });
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<any>(null);
  const recarregar = () => contatos.refetch();
  const lista = (contatos.data || []).filter(c => !busca || normalizarBusca(`${c.nome} ${c.telefone || ''}`).includes(normalizarBusca(busca)));
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await salvarCadastro('milhas_contato', form.id, { nome: form.nome.trim(), tipo: form.tipo, telefone: form.telefone.trim() || null, documento: form.documento.trim() || null, observacao: form.observacao.trim() || null }, recarregar);
    if (ok) setForm(null);
  };
  return (
    <>
    <TelaCadastro descricao="Para quem você vende e de quem compra milhas." busca={busca} onBusca={setBusca}
      onNovo={() => setForm({ id: '', nome: '', tipo: 'CLIENTE', telefone: '', documento: '', observacao: '' })} vazio="Nenhum cliente ou fornecedor." quantidade={lista.length}>
      {lista.map(c => <LinhaCadastro key={c.id} titulo={c.nome} ativo={c.ativo} sub={[NOME_CONTATO[c.tipo], c.telefone].filter(Boolean).join(' · ')}
        onEditar={() => setForm({ ...c, telefone: c.telefone ?? '', documento: c.documento ?? '', observacao: c.observacao ?? '' })}
        onApagar={() => apagarCadastro('milhas_contato', c.id, c.nome, recarregar)}
        onAtivo={() => alternarAtivo('milhas_contato', c, recarregar)} />)}
    </TelaCadastro>
      <Janela titulo={form?.id ? 'Editar' : 'Novo cliente ou fornecedor'} aberta={!!form} onFechar={() => setForm(null)}>
        {form && <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Nome"><input required className={inputCls} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></Campo>
          <Campo rotulo="Tipo">
            <select className={inputCls} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option value="CLIENTE">Cliente</option><option value="FORNECEDOR">Fornecedor</option><option value="AMBOS">Os dois</option>
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Telefone"><input inputMode="tel" className={inputCls} value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></Campo>
            <Campo rotulo="CPF/CNPJ"><input className={inputCls} value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} /></Campo>
          </div>
          <Campo rotulo="Observação"><textarea rows={2} className={inputCls} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></Campo>
          <BotaoRoxo type="submit" className="w-full">Salvar</BotaoRoxo>
        </form>}
      </Janela>
    </>
  );
}
