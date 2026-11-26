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

export async function buscarSalao() {
  return salao
}

export async function listarProfissionais() {
  return profissionais.filter((profissional) => profissional.ativo)
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
