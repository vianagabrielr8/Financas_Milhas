import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buscarProgramas, NOME_MODO, ModoLimite } from '@/lib/milhas';
import { Campo, BotaoRoxo, Janela, inputCls } from '@/components/milhas/ui';
import { TelaCadastro, LinhaCadastro, apagarCadastro, alternarAtivo, salvarCadastro } from '@/components/milhas/cadastro';

const resumoLimite = (p: any) => p.tipo === 'BANCO' ? 'Banco de pontos · sem limite de emissão'
  : p.modo_limite === 'SEM_LIMITE' || !p.limite_cpf ? 'Aérea · sem limite cadastrado'
  : p.modo_limite === 'PASSAGENS_12M' ? `Aérea · ${p.limite_cpf} passagens para terceiros em 12 meses`
  : p.modo_limite === 'PESSOAS_ANO' ? `Aérea · ${p.limite_cpf} pessoas por ano (zera em 1º/jan)`
  : `Aérea · lista fixa de ${p.limite_cpf} beneficiários${p.nivel ? ` (${p.nivel})` : ''}${p.espera_troca_dias ? ` · troca após ${p.espera_troca_dias} dias` : ''}`;

export default function Programas() {
  const programas = useQuery({ queryKey: ['milhas_programas'], queryFn: buscarProgramas });
  const [form, setForm] = useState<any>(null);
  const recarregar = () => programas.refetch();
  const lista = programas.data || [];

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const aerea = form.tipo === 'AEREA';
    const modo: ModoLimite = aerea ? form.modo_limite : 'SEM_LIMITE';
    const ok = await salvarCadastro('milhas_programa', form.id, {
      nome: form.nome.trim(), tipo: form.tipo, modo_limite: modo,
      limite_cpf: modo !== 'SEM_LIMITE' && form.limite_cpf ? Number(form.limite_cpf) : null,
      renovacao_cpf: modo === 'PESSOAS_ANO' ? 'ANO_CIVIL' : modo === 'PASSAGENS_12M' ? '12_MESES' : null,
      espera_troca_dias: modo === 'LISTA_FIXA' && form.espera_troca_dias ? Number(form.espera_troca_dias) : null,
      nivel: form.nivel?.trim() || null,
    }, recarregar);
    if (ok) setForm(null);
  };

  return (
    <>
    <TelaCadastro descricao="Companhias aéreas e bancos de pontos, com a regra de limite de emissão para terceiros."
      onNovo={() => setForm({ id: '', nome: '', tipo: 'AEREA', modo_limite: 'PESSOAS_ANO', limite_cpf: '', espera_troca_dias: '', nivel: '' })}
      vazio="Nenhum programa." quantidade={lista.length}>
      {lista.map(p => <LinhaCadastro key={p.id} titulo={p.nome} ativo={p.ativo} sub={resumoLimite(p)}
        onEditar={() => setForm({ ...p, limite_cpf: p.limite_cpf ?? '', espera_troca_dias: p.espera_troca_dias ?? '', nivel: p.nivel ?? '' })}
        onApagar={() => apagarCadastro('milhas_programa', p.id, p.nome, recarregar)}
        onAtivo={() => alternarAtivo('milhas_programa', p, recarregar)} />)}
      <p className="text-[11px] text-zinc-500 px-1 pt-2">Regras revisadas em 25/09/2026: LATAM conta passagens em 12 meses; Smiles e TAP contam pessoas no ano; Azul usa lista fixa conforme o nível (Básico 5, Topázio 6, Safira 7, Diamante 8, Diamante Unique 15, Azul One 20), com espera de 30 dias para trocar. Os programas mudam essas regras: confira e ajuste aqui.</p>
    </TelaCadastro>
      <Janela titulo={form?.id ? 'Editar programa' : 'Novo programa'} aberta={!!form} onFechar={() => setForm(null)}>
        {form && <form onSubmit={salvar} className="space-y-4">
          <Campo rotulo="Nome"><input required className={inputCls} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: LATAM Pass" /></Campo>
          <Campo rotulo="Tipo">
            <select className={inputCls} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              <option value="AEREA">Companhia aérea (emite passagem)</option>
              <option value="BANCO">Banco de pontos (Livelo, Esfera...)</option>
            </select>
          </Campo>
          {form.tipo === 'AEREA' && <>
            <Campo rotulo="Como conta o limite para terceiros">
              <select className={inputCls} value={form.modo_limite} onChange={e => setForm({ ...form, modo_limite: e.target.value })}>
                {(Object.keys(NOME_MODO) as ModoLimite[]).map(m => <option key={m} value={m}>{NOME_MODO[m]}</option>)}
              </select>
            </Campo>
            {form.modo_limite !== 'SEM_LIMITE' && <div className="grid grid-cols-2 gap-3">
              <Campo rotulo={form.modo_limite === 'PASSAGENS_12M' ? 'Limite de passagens' : form.modo_limite === 'LISTA_FIXA' ? 'Tamanho da lista' : 'Limite de pessoas'}>
                <input type="number" min="1" className={inputCls} value={form.limite_cpf} onChange={e => setForm({ ...form, limite_cpf: e.target.value })} />
              </Campo>
              {form.modo_limite === 'LISTA_FIXA' && <Campo rotulo="Espera p/ trocar (dias)"><input type="number" min="0" className={inputCls} value={form.espera_troca_dias} onChange={e => setForm({ ...form, espera_troca_dias: e.target.value })} /></Campo>}
            </div>}
            <Campo rotulo="Seu nível no programa (opcional)"><input className={inputCls} value={form.nivel} onChange={e => setForm({ ...form, nivel: e.target.value })} placeholder="Ex.: Diamante" /></Campo>
          </>}
          <BotaoRoxo type="submit" className="w-full">Salvar</BotaoRoxo>
        </form>}
      </Janela>
    </>
  );
}
