import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscarPassageirosCad, soDigitos, dataBR, docFmt } from '@/lib/milhas';
import { Campo, BotaoRoxo, Janela, Pilulas, inputCls } from '@/components/milhas/ui';
import { TelaCadastro, LinhaCadastro, apagarCadastro, alternarAtivo, salvarCadastro } from '@/components/milhas/cadastro';
import { normalizarBusca } from './util';

export default function Passageiros() {
  const pax = useQuery({ queryKey: ['milhas_passageiros_cad'], queryFn: buscarPassageirosCad });
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<any>(null);
  const recarregar = () => pax.refetch();
  const lista = (pax.data || []).filter(p => !busca || normalizarBusca(`${p.nome} ${p.documento}`).includes(normalizarBusca(busca)));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const doc = form.documento_tipo === 'CPF' ? soDigitos(form.documento) : form.documento.trim().toUpperCase();
    const ok = await salvarCadastro('milhas_passageiro', form.id, {
      nome: form.nome.trim(), documento_tipo: form.documento_tipo, documento: doc, nascimento: form.nascimento || null,
      telefone: form.telefone.trim() || null, email: form.email.trim() || null, observacao: form.observacao.trim() || null,
    }, recarregar);
    if (ok) setForm(null);
  };

  return (
    <>
    <TelaCadastro descricao="Quem viaja com as passagens que você emite ou vende. CPF ou passaporte." busca={busca} onBusca={setBusca}
      onNovo={() => setForm({ id: '', nome: '', documento_tipo: 'CPF', documento: '', nascimento: '', telefone: '', email: '', observacao: '' })}
      vazio="Nenhum passageiro. Eles também são criados sozinhos quando você lança uma venda ou emissão." quantidade={lista.length}>
      {lista.map(p => <LinhaCadastro key={p.id} titulo={p.nome} ativo={p.ativo}
        sub={[docFmt(p.documento_tipo, p.documento), p.nascimento && `nasc. ${dataBR(p.nascimento)}`, p.telefone].filter(Boolean).join(' · ')}
        onEditar={() => setForm({ ...p, nascimento: p.nascimento ?? '', telefone: p.telefone ?? '', email: p.email ?? '', observacao: p.observacao ?? '' })}
        onApagar={() => apagarCadastro('milhas_passageiro', p.id, p.nome, recarregar)}
        onAtivo={() => alternarAtivo('milhas_passageiro', p, recarregar)} />)}
    </TelaCadastro>
      <Janela titulo={form?.id ? 'Editar passageiro' : 'Novo passageiro'} aberta={!!form} onFechar={() => setForm(null)}>
        {form && <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Nome completo"><input required className={inputCls} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></Campo>
          <Pilulas valor={form.documento_tipo} onChange={(v: string) => setForm({ ...form, documento_tipo: v })} opcoes={[['CPF', 'CPF'], ['PASSAPORTE', 'Passaporte']]} />
          <Campo rotulo={form.documento_tipo === 'CPF' ? 'CPF' : 'Nº do passaporte'}><input required className={inputCls} inputMode={form.documento_tipo === 'CPF' ? 'numeric' : 'text'} value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Nascimento"><input type="date" className={inputCls} value={form.nascimento} onChange={e => setForm({ ...form, nascimento: e.target.value })} /></Campo>
            <Campo rotulo="Telefone"><input inputMode="tel" className={inputCls} value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></Campo>
          </div>
          <Campo rotulo="E-mail"><input type="email" className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Campo>
          <Campo rotulo="Observação"><input className={inputCls} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></Campo>
          <BotaoRoxo type="submit" className="w-full">Salvar</BotaoRoxo>
        </form>}
      </Janela>
    </>
  );
}
