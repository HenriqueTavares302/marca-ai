import { agendamento_servicos } from './agendamento_servicos.js'
import { agendamentos } from './agendamentos.js'
import { bloqueios } from './bloqueios.js'
import { clientes } from './clientes.js'
import { mesmoDia } from './datas.js'
import { horarios_trabalho } from './horarios_trabalho.js'
import { profissional_servicos } from './profissional_servicos.js'
import { profissionais } from './profissionais.js'
import { salao } from './salao.js'
import { servico_variacoes } from './servico_variacoes.js'
import { categorias, servicos } from './servicos.js'
import { calcularHorariosLivres } from '../utils/horariosLivres.js'

export async function buscarSalao() {
  return salao
}

export async function listarProfissionais() {
  return profissionais.filter((profissional) => profissional.ativo)
}

export async function listarProfissionaisComServicos() {
  return profissionais
    .filter((profissional) => profissional.ativo)
    .map((profissional) => ({
      ...profissional,
      servico_ids: profissional_servicos
        .filter((ligacao) => ligacao.profissional_id === profissional.id)
        .map((ligacao) => ligacao.servico_id),
    }))
}

function candidatosDoHorario(profissionalId, servicoIds) {
  if (profissionalId) {
    return profissionais.filter((profissional) => profissional.ativo && profissional.id === profissionalId)
  }
  return profissionais.filter((profissional) => {
    if (!profissional.ativo) return false
    const faz = profissional_servicos
      .filter((ligacao) => ligacao.profissional_id === profissional.id)
      .map((ligacao) => ligacao.servico_id)
    return servicoIds.every((id) => faz.includes(id))
  })
}

export async function listarHorariosLivres(data, profissionalId, duracaoMinutos, servicoIds = []) {
  const candidatos = candidatosDoHorario(profissionalId, servicoIds)
  return calcularHorariosLivres({
    data,
    duracao: duracaoMinutos,
    profissionalIds: candidatos.map((profissional) => profissional.id),
    horariosTrabalho: horarios_trabalho,
    bloqueios,
    agendamentos,
    agora: Date.now(),
    intervalo: salao.intervalo_minutos,
    antecedencia: salao.antecedencia_minima_minutos,
  })
}

export async function listarDiasDeAtendimento(profissionalId, servicoIds = []) {
  const ids = candidatosDoHorario(profissionalId, servicoIds).map((profissional) => profissional.id)
  const dias = horarios_trabalho
    .filter((horario) => ids.includes(horario.profissional_id))
    .map((horario) => horario.dia_semana)
  return [...new Set(dias)]
}

export async function buscarProfissional(id) {
  return profissionais.find((profissional) => profissional.id === id) || null
}

export async function listarServicos() {
  return servicos.filter((servico) => servico.ativo).sort((a, b) => a.ordem - b.ordem)
}

export async function buscarServico(id) {
  return servicos.find((servico) => servico.id === id) || null
}

export async function listarServicosPorCategoria() {
  const ativos = await listarServicos()
  return categorias
    .map((categoria) => ({
      categoria,
      servicos: ativos.filter((servico) => servico.categoria === categoria),
    }))
    .filter((grupo) => grupo.servicos.length > 0)
}

export async function listarServicosComVariacoes() {
  const ativos = await listarServicos()
  return ativos.map((servico) => ({
    ...servico,
    variacoes: servico_variacoes
      .filter((variacao) => variacao.servico_id === servico.id)
      .sort((a, b) => a.ordem - b.ordem),
  }))
}

export async function listarCategorias() {
  return categorias
}

export async function listarServicosPopulares(quantidade) {
  const idsValidos = agendamentos
    .filter((agendamento) => agendamento.status !== 'cancelado')
    .map((agendamento) => agendamento.id)
  const contagem = {}
  for (const item of agendamento_servicos) {
    if (!idsValidos.includes(item.agendamento_id)) continue
    contagem[item.servico_id] = (contagem[item.servico_id] || 0) + 1
  }
  const ativos = await listarServicos()
  return ativos
    .map((servico) => ({ ...servico, vezes: contagem[servico.id] || 0 }))
    .sort((a, b) => b.vezes - a.vezes || a.ordem - b.ordem)
    .slice(0, quantidade)
}

export async function listarHorarioDoSalao() {
  const idsAtivos = profissionais.filter((profissional) => profissional.ativo).map((profissional) => profissional.id)
  const semana = [null, null, null, null, null, null, null]

  for (const horario of horarios_trabalho) {
    if (!idsAtivos.includes(horario.profissional_id)) continue
    const atual = semana[horario.dia_semana]
    if (!atual) {
      semana[horario.dia_semana] = { inicio: horario.inicio, fim: horario.fim }
    } else {
      if (horario.inicio < atual.inicio) atual.inicio = horario.inicio
      if (horario.fim > atual.fim) atual.fim = horario.fim
    }
  }

  return semana
}

export async function listarVariacoes(servicoId) {
  return servico_variacoes
    .filter((variacao) => variacao.servico_id === servicoId)
    .sort((a, b) => a.ordem - b.ordem)
}

export async function listarProfissionaisDoServico(servicoId) {
  const ids = profissional_servicos
    .filter((ligacao) => ligacao.servico_id === servicoId)
    .map((ligacao) => ligacao.profissional_id)
  return profissionais.filter((profissional) => profissional.ativo && ids.includes(profissional.id))
}

export async function listarServicosDoProfissional(profissionalId) {
  const ids = profissional_servicos
    .filter((ligacao) => ligacao.profissional_id === profissionalId)
    .map((ligacao) => ligacao.servico_id)
  return servicos.filter((servico) => servico.ativo && ids.includes(servico.id))
}

export async function listarHorariosDoProfissional(profissionalId) {
  return horarios_trabalho.filter((horario) => horario.profissional_id === profissionalId)
}

export async function listarBloqueiosDoDia(profissionalId, data) {
  return bloqueios.filter(
    (bloqueio) => bloqueio.profissional_id === profissionalId && mesmoDia(bloqueio.inicio, data),
  )
}

export async function listarClientes() {
  return [...clientes].sort((a, b) => a.nome.localeCompare(b.nome))
}

export async function buscarCliente(id) {
  return clientes.find((cliente) => cliente.id === id) || null
}

function completarAgendamento(agendamento) {
  const itens = agendamento_servicos
    .filter((item) => item.agendamento_id === agendamento.id)
    .map((item) => ({
      ...item,
      servico: servicos.find((servico) => servico.id === item.servico_id),
      variacao: servico_variacoes.find((variacao) => variacao.id === item.variacao_id) || null,
    }))

  return {
    ...agendamento,
    cliente: clientes.find((cliente) => cliente.id === agendamento.cliente_id),
    profissional: profissionais.find((profissional) => profissional.id === agendamento.profissional_id),
    servicos: itens,
  }
}

function ordenarPorInicio(a, b) {
  return new Date(a.inicio) - new Date(b.inicio)
}

export async function agendamentosDoDia(data, profissionalId) {
  return agendamentos
    .filter((agendamento) => mesmoDia(agendamento.inicio, data))
    .filter((agendamento) => !profissionalId || agendamento.profissional_id === profissionalId)
    .sort(ordenarPorInicio)
    .map(completarAgendamento)
}

export async function agendamentosDoCliente(clienteId) {
  return agendamentos
    .filter((agendamento) => agendamento.cliente_id === clienteId)
    .sort(ordenarPorInicio)
    .map(completarAgendamento)
}
