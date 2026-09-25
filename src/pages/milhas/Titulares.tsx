import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscarTitulares, buscarContas, buscarProgramas, buscarMovimentos, situacaoDaConta, milhasFmt } from '@/lib/milhas';
import { Campo, BotaoRoxo, Janela, inputCls } from '@/components/milhas/ui';
import { TelaCadastro, LinhaCadastro, apagarCadastro, alternarAtivo, salvarCadastro } from '@/components/milhas/cadastro';
import { normalizarBusca } from './util';

// Titular = a PESSOA dona das milhas (nome e CPF). Não pede programa:
// a carteira pessoa x programa é criada sozinha no primeiro lançamento.
export default function Titulares() {
  const titulares = useQuery({ queryKey: ['milhas_titulares'], queryFn: buscarTitulares });
  const contas = useQuery({ queryKey: ['milhas_contas'], queryFn: buscarContas });
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const movs = useQuery({ queryKey: ['milhas_movimentos'], queryFn: () => buscarMovimentos() });
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<any>(null);

  const saldos = useMemo(() => {
    const porConta = new Map<string, any[]>();
    for (const m of movs.data || []) { if (!porConta.has(m.conta_id)) porConta.set(m.conta_id, []); porConta.get(m.conta_id)!.push(m); }
    return (titularId: string) => (contas.data || []).filter(c => c.titular_id === titularId)
      .map(c => ({ programa: programas.data?.find(p => p.id === c.programa_id)?.nome || '?', saldo: situacaoDaConta(porConta.get(c.id) || []).saldo }))
      .filter(x => x.saldo !== 0);
  }, [movs.data, contas.data, programas.data]);

  const lista = (titulares.data || []).filter(t => !busca || normalizarBusca(`${t.nome} ${t.cpf || ''}`).includes(normalizarBusca(busca)));
  const recarregar = () => titulares.refetch();
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await salvarCadastro('milhas_titular', form.id, { nome: form.nome.trim(), cpf: form.cpf.trim() || null, observacao: form.observacao.trim() || null }, recarregar);
    if (ok) { setForm(null); contas.refetch(); }
  };

  return (
    <>
    <TelaCadastro descricao="As pessoas donas das milhas. O programa você escolhe na hora de lançar." busca={busca} onBusca={setBusca}
      onNovo={() => setForm({ id: '', nome: '', cpf: '', observacao: '' })} vazio="Nenhum titular. Cadastre você, sua esposa, quem tiver conta em programa." quantidade={lista.length}>
      {lista.map(t => {
        const s = saldos(t.id);
        return <LinhaCadastro key={t.id} titulo={t.nome} ativo={t.ativo}
          sub={[t.cpf && `CPF ${t.cpf}`, s.length ? s.map(x => `${x.programa}: ${milhasFmt(x.saldo)}`).join(' · ') : 'sem saldo'].filter(Boolean).join(' · ')}
          onEditar={() => setForm({ ...t, cpf: t.cpf ?? '', observacao: t.observacao ?? '' })}
          onApagar={() => apagarCadastro('milhas_titular', t.id, t.nome, recarregar)}
          onAtivo={() => alternarAtivo('milhas_titular', t, recarregar)} />;
      })}
    </TelaCadastro>
      <Janela titulo={form?.id ? 'Editar titular' : 'Novo titular'} aberta={!!form} onFechar={() => setForm(null)}>
        {form && <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Nome"><input required className={inputCls} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Gabriel" /></Campo>
          <Campo rotulo="CPF"><input inputMode="numeric" className={inputCls} value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} /></Campo>
          <Campo rotulo="Observação"><input className={inputCls} value={form.observacao} onChange={e => setForm({ ...form, observacao: e.target.value })} /></Campo>
          <BotaoRoxo type="submit" className="w-full">Salvar</BotaoRoxo>
        </form>}
      </Janela>
    </>
  );
}
