import { juntarIntervalos } from '../../utils/expediente.js'
import { partesEmSaoPaulo } from '../../utils/fuso.js'

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
  const servicos = servicosComVariacoes(vitrine)
  const pedidos = vitrine.mais_pedidos
    .map((id) => servicos.find((servico) => servico.id === id))
    .filter((servico) => servico)
  const resto = servicos.filter((servico) => !pedidos.includes(servico))
  return [...pedidos, ...resto].slice(0, quantidade)
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

function minutosDaHora(hora) {
  const [horas, minutos] = String(hora).split(':').map(Number)
  return horas * 60 + minutos
}

export function duracaoDosItens(vitrine, itens) {
  return itens.reduce((total, item) => {
    const variacao = item.variacao_id ? vitrine.servico_variacoes.find((v) => v.id === item.variacao_id) : null
    const servico = vitrine.servicos.find((s) => s.id === item.servico_id)
    const duracao = variacao ? variacao.duracao_min : servico ? servico.duracao_min : 0
    return total + (duracao || 0)
  }, 0)
}

export function quemPodeAtender(vitrine, profissionalId, itens) {
  if (profissionalId) return [profissionalId]
  return vitrine.profissionais
    .map((profissional) => profissional.id)
    .filter((id) =>
      itens.every((item) =>
        vitrine.profissional_servicos.some((ligacao) => ligacao.profissional_id === id && ligacao.servico_id === item.servico_id),
      ),
    )
}

export function hojeJaEncerrou(vitrine, profissionalIds, duracao, agora) {
  const { diaSemana, minutosDoDia } = partesEmSaoPaulo(agora)
  const primeiroInicioPossivel = minutosDoDia + (vitrine.salao.antecedencia_minima_minutos || 0)
  return profissionalIds.every((id) =>
    vitrine.horarios_trabalho
      .filter((horario) => horario.profissional_id === id && horario.dia_semana === diaSemana)
      .every((horario) => minutosDaHora(horario.fim) - duracao < primeiroInicioPossivel),
  )
}
