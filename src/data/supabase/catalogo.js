import { juntarIntervalos } from '../../utils/expediente.js'

function ligacoesDoServico(vitrine, servicoId) {
  return vitrine.profissional_servicos.filter((ligacao) => ligacao.servico_id === servicoId)
}

export function servicoComPrecos(vitrine, servico) {
  const ligacoes = ligacoesDoServico(vitrine, servico.id)
  const quemFaz = ligacoes.map((ligacao) => ligacao.profissional_id)
  const precosDoServico = {}
  for (const ligacao of ligacoes) {
    if (typeof ligacao.preco === 'number') precosDoServico[ligacao.profissional_id] = ligacao.preco
  }
  return {
    ...servico,
    profissional_ids: quemFaz,
    precos_por_profissional: precosDoServico,
    variacoes: vitrine.servico_variacoes
      .filter((variacao) => variacao.servico_id === servico.id)
      .map((variacao) => {
        const precosDaVariacao = {}
        for (const linha of vitrine.profissional_variacoes) {
          if (linha.variacao_id === variacao.id && quemFaz.includes(linha.profissional_id) && typeof linha.preco === 'number') {
            precosDaVariacao[linha.profissional_id] = linha.preco
          }
        }
        return { ...variacao, precos_por_profissional: precosDaVariacao }
      }),
  }
}

export function servicosComVariacoes(vitrine) {
  return vitrine.servicos.map((servico) => servicoComPrecos(vitrine, servico))
}

export function servicosPopulares(vitrine, quantidade) {
  return servicosComVariacoes(vitrine)
    .map((servico) => ({ ...servico, vezes: 0 }))
    .slice(0, quantidade)
}

export function categoriasComServicos(vitrine) {
  return vitrine.categorias.filter((categoria) => vitrine.servicos.some((servico) => servico.categoria === categoria))
}

export function profissionaisComServicos(vitrine) {
  return vitrine.profissionais.map((profissional) => ({
    ...profissional,
    servico_ids: vitrine.profissional_servicos
      .filter((ligacao) => ligacao.profissional_id === profissional.id)
      .map((ligacao) => ligacao.servico_id),
  }))
}

export function horarioDoSalao(vitrine) {
  return [0, 1, 2, 3, 4, 5, 6].map((dia) => {
    const doDia = vitrine.horarios_trabalho.filter((horario) => horario.dia_semana === dia)
    return doDia.length > 0 ? juntarIntervalos(doDia) : null
  })
}
