import { agendamento_servicos as itensDeExemplo } from './agendamento_servicos.js'
import { agendamentos as agendamentosDeExemplo } from './agendamentos.js'
import { gravarBancoLocal, lerBancoLocal } from './armazenamentoLocal.js'
import { bloqueios as bloqueiosDeExemplo } from './bloqueios.js'
import { clientes as clientesDeExemplo } from './clientes.js'
import { mesmoDia } from './datas.js'
import { horarios_trabalho as horariosDeExemplo } from './horarios_trabalho.js'
import { profissional_servicos as ligacoesDeExemplo } from './profissional_servicos.js'
import { profissionais } from './profissionais.js'
import { salao } from './salao.js'
import { servico_variacoes as variacoesDeExemplo } from './servico_variacoes.js'
import { categorias as categoriasDeExemplo, servicos as servicosDeExemplo } from './servicos.js'
import { diaDaSemana, instanteEmSaoPaulo, partesEmSaoPaulo, somarDias } from '../utils/fuso.js'
import { calcularHorariosLivres } from '../utils/horariosLivres.js'
import {
  agendamentosForaDoHorario,
  cabeNoExpediente,
  errosDosHorarios,
  horariosDosDias,
  juntarIntervalos,
} from '../utils/expediente.js'
import { errosDoServico, resumoDasVariacoes, temErros } from '../utils/servico.js'

const statusValidos = ['agendado', 'concluido', 'cancelado', 'faltou']

const mudancasPermitidas = {
  agendado: ['concluido', 'faltou', 'cancelado'],
  concluido: ['agendado'],
  faltou: ['agendado'],
  cancelado: [],
}

function todosOsAgendamentos() {
  const banco = lerBancoLocal()
  const exemplosComAlteracoes = agendamentosDeExemplo.map((agendamento) => {
    const alteracao = banco.alteracoes_de_status.find((item) => item.agendamento_id === agendamento.id)
    return alteracao && statusValidos.includes(alteracao.status) ? { ...agendamento, status: alteracao.status } : agendamento
  })
  return [...exemplosComAlteracoes, ...banco.agendamentos]
}

function todosOsItensDeAgendamento() {
  return [...itensDeExemplo, ...lerBancoLocal().agendamento_servicos]
}

function lerHorarios() {
  return lerBancoLocal().horarios_trabalho || horariosDeExemplo
}

function lerBloqueios() {
  return lerBancoLocal().bloqueios || bloqueiosDeExemplo
}

function bloqueiosQuePassamPeloDia(data) {
  const comecoDoDia = instanteEmSaoPaulo(data, 0)
  const fimDoDia = instanteEmSaoPaulo(somarDias(data, 1), 0)
  return lerBloqueios().filter((bloqueio) =>
    seSobrepoe(comecoDoDia, fimDoDia, new Date(bloqueio.inicio).getTime(), new Date(bloqueio.fim).getTime()),
  )
}

function lerCatalogo() {
  const salvo = lerBancoLocal().catalogo
  if (salvo) return salvo
  return {
    servicos: servicosDeExemplo.map((servico) => ({ ...servico })),
    servico_variacoes: variacoesDeExemplo.map((variacao) => ({ ...variacao })),
    profissional_servicos: ligacoesDeExemplo.map((ligacao) => ({ ...ligacao })),
    categorias: [...categoriasDeExemplo],
    variacoes_removidas: [],
  }
}

function servicoIdsDoProfissional(catalogo, profissionalId) {
  return catalogo.profissional_servicos
    .filter((ligacao) => ligacao.profissional_id === profissionalId)
    .map((ligacao) => ligacao.servico_id)
}

function todosOsClientes() {
  return [...clientesDeExemplo, ...lerBancoLocal().clientes]
}

export async function buscarSalao() {
  return salao
}

export async function listarProfissionais() {
  return profissionais.filter((profissional) => profissional.ativo)
}

export async function listarProfissionaisComServicos() {
  const catalogo = lerCatalogo()
  const ativos = catalogo.servicos.filter((servico) => servico.ativo).map((servico) => servico.id)
  return profissionais
    .filter((profissional) => profissional.ativo)
    .map((profissional) => ({
      ...profissional,
      servico_ids: servicoIdsDoProfissional(catalogo, profissional.id).filter((id) => ativos.includes(id)),
    }))
}

function candidatosDoHorario(profissionalId, servicoIds) {
  if (profissionalId) {
    return profissionais.filter((profissional) => profissional.ativo && profissional.id === profissionalId)
  }
  const catalogo = lerCatalogo()
  return profissionais.filter((profissional) => {
    if (!profissional.ativo) return false
    const faz = servicoIdsDoProfissional(catalogo, profissional.id)
    return servicoIds.every((id) => faz.includes(id))
  })
}

export async function listarHorariosLivres(
  data,
  profissionalId,
  duracaoMinutos,
  servicoIds = [],
  ignorarAgendamentoId = null,
  semAntecedencia = false,
) {
  const candidatos = candidatosDoHorario(profissionalId, servicoIds)
  return calcularHorariosLivres({
    data,
    duracao: duracaoMinutos,
    profissionalIds: candidatos.map((profissional) => profissional.id),
    horariosTrabalho: lerHorarios(),
    bloqueios: lerBloqueios(),
    agendamentos: todosOsAgendamentos().filter((agendamento) => agendamento.id !== ignorarAgendamentoId),
    agora: Date.now(),
    intervalo: salao.intervalo_minutos,
    antecedencia: semAntecedencia ? 0 : salao.antecedencia_minima_minutos,
  })
}

function bloqueadoODiaInteiro(profissionalId, data, bloqueios) {
  const comecoDoDia = instanteEmSaoPaulo(data, 0)
  const fimDoDia = instanteEmSaoPaulo(somarDias(data, 1), 0)
  return bloqueios.some(
    (bloqueio) =>
      bloqueio.profissional_id === profissionalId &&
      new Date(bloqueio.inicio).getTime() <= comecoDoDia &&
      new Date(bloqueio.fim).getTime() >= fimDoDia,
  )
}

export async function listarDatasAbertas(profissionalId, servicoIds, datas) {
  const candidatos = candidatosDoHorario(profissionalId, servicoIds || [])
  const horarios = lerHorarios()
  const bloqueios = lerBloqueios()
  return datas.filter((data) =>
    candidatos.some(
      (profissional) =>
        horarios.some(
          (horario) => horario.profissional_id === profissional.id && horario.dia_semana === diaDaSemana(data),
        ) && !bloqueadoODiaInteiro(profissional.id, data, bloqueios),
    ),
  )
}

export async function buscarProfissional(id) {
  return profissionais.find((profissional) => profissional.id === id) || null
}

export async function listarServicos() {
  return lerCatalogo()
    .servicos.filter((servico) => servico.ativo)
    .sort((a, b) => a.ordem - b.ordem)
}

export async function buscarServico(id) {
  return lerCatalogo().servicos.find((servico) => servico.id === id) || null
}

export async function listarServicosPorCategoria() {
  const ativos = await listarServicos()
  return lerCatalogo()
    .categorias.map((categoria) => ({
      categoria,
      servicos: ativos.filter((servico) => servico.categoria === categoria),
    }))
    .filter((grupo) => grupo.servicos.length > 0)
}

export async function listarServicosComVariacoes() {
  const ativos = await listarServicos()
  const variacoes = lerCatalogo().servico_variacoes
  return ativos.map((servico) => ({
    ...servico,
    variacoes: variacoes
      .filter((variacao) => variacao.servico_id === servico.id)
      .sort((a, b) => a.ordem - b.ordem),
  }))
}

export async function listarCategorias() {
  const ativos = await listarServicos()
  return lerCatalogo().categorias.filter((categoria) => ativos.some((servico) => servico.categoria === categoria))
}

export async function listarServicosPopulares(quantidade) {
  const idsValidos = todosOsAgendamentos()
    .filter((agendamento) => agendamento.status !== 'cancelado')
    .map((agendamento) => agendamento.id)
  const contagem = {}
  for (const item of todosOsItensDeAgendamento()) {
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
  const horarios = lerHorarios().filter((horario) => idsAtivos.includes(horario.profissional_id))
  return [0, 1, 2, 3, 4, 5, 6].map((dia) => {
    const doDia = horarios.filter((horario) => horario.dia_semana === dia)
    return doDia.length > 0 ? juntarIntervalos(doDia) : null
  })
}

export async function listarVariacoes(servicoId) {
  return lerCatalogo()
    .servico_variacoes.filter((variacao) => variacao.servico_id === servicoId)
    .sort((a, b) => a.ordem - b.ordem)
}

export async function listarProfissionaisDoServico(servicoId) {
  const ids = lerCatalogo()
    .profissional_servicos.filter((ligacao) => ligacao.servico_id === servicoId)
    .map((ligacao) => ligacao.profissional_id)
  return profissionais.filter((profissional) => profissional.ativo && ids.includes(profissional.id))
}

export async function listarServicosDoProfissional(profissionalId) {
  const catalogo = lerCatalogo()
  const ids = servicoIdsDoProfissional(catalogo, profissionalId)
  return catalogo.servicos.filter((servico) => servico.ativo && ids.includes(servico.id))
}

export async function listarHorariosDoProfissional(profissionalId) {
  return lerHorarios().filter((horario) => horario.profissional_id === profissionalId)
}

export async function listarBloqueiosDoDia(profissionalId, data) {
  return bloqueiosQuePassamPeloDia(data).filter(
    (bloqueio) => bloqueio.profissional_id === profissionalId,
  )
}

export async function listarClientes() {
  return todosOsClientes().sort((a, b) => a.nome.localeCompare(b.nome))
}

export async function buscarCliente(id) {
  return todosOsClientes().find((cliente) => cliente.id === id) || null
}

function completarAgendamento(agendamento) {
  const catalogo = lerCatalogo()
  const variacoes = [...catalogo.servico_variacoes, ...catalogo.variacoes_removidas]
  const itens = todosOsItensDeAgendamento()
    .filter((item) => item.agendamento_id === agendamento.id)
    .map((item) => ({
      ...item,
      servico: catalogo.servicos.find((servico) => servico.id === item.servico_id),
      variacao: variacoes.find((variacao) => variacao.id === item.variacao_id) || null,
    }))

  return {
    ...agendamento,
    cliente: todosOsClientes().find((cliente) => cliente.id === agendamento.cliente_id),
    profissional: profissionais.find((profissional) => profissional.id === agendamento.profissional_id),
    servicos: itens,
  }
}

function ordenarPorInicio(a, b) {
  return new Date(a.inicio) - new Date(b.inicio)
}

export async function agendamentosDoDia(data, profissionalId) {
  return todosOsAgendamentos()
    .filter((agendamento) => mesmoDia(agendamento.inicio, data))
    .filter((agendamento) => !profissionalId || agendamento.profissional_id === profissionalId)
    .sort(ordenarPorInicio)
    .map(completarAgendamento)
}

export async function agendamentosDoCliente(clienteId) {
  return todosOsAgendamentos()
    .filter((agendamento) => agendamento.cliente_id === clienteId)
    .sort(ordenarPorInicio)
    .map(completarAgendamento)
}

function proximoId(lista) {
  return lista.reduce((maior, item) => Math.max(maior, Number(item.id) || 0), 0) + 1
}

function seSobrepoe(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && inicioB < fimA
}

export async function criarAgendamento({ nome, telefone, profissionalId, inicio, itens, observacoes, formaPagamento }) {
  const banco = lerBancoLocal()
  const duracao = itens.reduce((total, item) => total + item.duracao_min, 0)
  const inicioMs = new Date(inicio).getTime()
  const fimMs = inicioMs + duracao * 60000

  const ocupado = todosOsAgendamentos().some(
    (agendamento) =>
      agendamento.profissional_id === profissionalId &&
      agendamento.status !== 'cancelado' &&
      seSobrepoe(inicioMs, fimMs, new Date(agendamento.inicio).getTime(), new Date(agendamento.fim).getTime()),
  )
  if (ocupado) {
    return { erro: 'horario_ocupado' }
  }

  const agora = new Date().toISOString()
  let cliente = todosOsClientes().find((item) => item.telefone === telefone)
  if (!cliente) {
    cliente = {
      id: proximoId(todosOsClientes()),
      user_id: null,
      nome,
      telefone,
      email: null,
      observacoes: null,
      criado_em: agora,
    }
    banco.clientes.push(cliente)
  }

  const precosConhecidos = itens.filter((item) => item.preco !== null).map((item) => item.preco)
  const agendamento = {
    id: proximoId(todosOsAgendamentos()),
    cliente_id: cliente.id,
    profissional_id: profissionalId,
    inicio: new Date(inicioMs).toISOString(),
    fim: new Date(fimMs).toISOString(),
    status: 'agendado',
    valor_total: precosConhecidos.length > 0 ? precosConhecidos.reduce((total, preco) => total + preco, 0) : null,
    forma_pagamento: formaPagamento === 'pix' ? 'pix' : 'salao',
    pago: false,
    observacoes: observacoes || null,
    criado_em: agora,
  }
  banco.agendamentos.push(agendamento)

  let idDoItem = proximoId(todosOsItensDeAgendamento())
  for (const item of itens) {
    banco.agendamento_servicos.push({
      id: idDoItem,
      agendamento_id: agendamento.id,
      servico_id: item.servico_id,
      variacao_id: item.variacao_id,
      preco: item.preco,
      duracao_min: item.duracao_min,
    })
    idDoItem++
  }

  try {
    gravarBancoLocal(banco)
  } catch {
    return { erro: 'nao_salvou' }
  }

  return { agendamento: completarAgendamento(agendamento) }
}

function dentroDoPrazo(agendamento) {
  const faltaEmMinutos = (new Date(agendamento.inicio).getTime() - Date.now()) / 60000
  return agendamento.status === 'agendado' && faltaEmMinutos >= salao.cancelamento_minimo_minutos
}

export async function listarMeusAgendamentos(ids) {
  return lerBancoLocal()
    .agendamentos.filter((agendamento) => ids.includes(agendamento.id))
    .sort(ordenarPorInicio)
    .map(completarAgendamento)
}

export async function cancelarAgendamento(id) {
  const banco = lerBancoLocal()
  const agendamento = banco.agendamentos.find((item) => item.id === id)
  if (!agendamento) return { erro: 'nao_encontrado' }
  if (!dentroDoPrazo(agendamento)) return { erro: 'fora_do_prazo' }

  agendamento.status = 'cancelado'
  try {
    gravarBancoLocal(banco)
  } catch {
    return { erro: 'nao_salvou' }
  }
  return { agendamento: completarAgendamento(agendamento) }
}

export async function remarcarAgendamento(id, profissionalId, novoInicio) {
  const banco = lerBancoLocal()
  const agendamento = banco.agendamentos.find((item) => item.id === id)
  if (!agendamento) return { erro: 'nao_encontrado' }
  if (!dentroDoPrazo(agendamento)) return { erro: 'fora_do_prazo' }

  const duracao = new Date(agendamento.fim).getTime() - new Date(agendamento.inicio).getTime()
  const inicioMs = new Date(novoInicio).getTime()
  const fimMs = inicioMs + duracao
  const ocupado = todosOsAgendamentos().some(
    (outro) =>
      outro.id !== id &&
      outro.profissional_id === profissionalId &&
      outro.status !== 'cancelado' &&
      seSobrepoe(inicioMs, fimMs, new Date(outro.inicio).getTime(), new Date(outro.fim).getTime()),
  )
  if (ocupado) return { erro: 'horario_ocupado' }

  agendamento.profissional_id = profissionalId
  agendamento.inicio = new Date(inicioMs).toISOString()
  agendamento.fim = new Date(fimMs).toISOString()
  try {
    gravarBancoLocal(banco)
  } catch {
    return { erro: 'nao_salvou' }
  }
  return { agendamento: completarAgendamento(agendamento) }
}

export async function listarAgendaDoDia(data, profissionalId) {
  const doDia = profissionais.filter(
    (profissional) => profissional.ativo && (!profissionalId || profissional.id === profissionalId),
  )
  const ids = doDia.map((profissional) => profissional.id)

  return {
    profissionais: doDia,
    agendamentos: todosOsAgendamentos()
      .filter((agendamento) => ids.includes(agendamento.profissional_id))
      .filter((agendamento) => partesEmSaoPaulo(agendamento.inicio).data === data)
      .sort(ordenarPorInicio)
      .map(completarAgendamento),
    bloqueios: bloqueiosQuePassamPeloDia(data).filter((bloqueio) => ids.includes(bloqueio.profissional_id)),
    turnos: lerHorarios().filter(
      (horario) => ids.includes(horario.profissional_id) && horario.dia_semana === diaDaSemana(data),
    ),
    salaoAberto: lerHorarios().some(
      (horario) =>
        horario.dia_semana === diaDaSemana(data) &&
        profissionais.some((profissional) => profissional.ativo && profissional.id === horario.profissional_id),
    ),
  }
}

export async function atualizarStatusAgendamento(id, novoStatus) {
  const atual = todosOsAgendamentos().find((agendamento) => agendamento.id === id)
  if (!atual) return { erro: 'nao_encontrado' }
  if (!(mudancasPermitidas[atual.status] || []).includes(novoStatus)) return { erro: 'mudanca_invalida' }

  const banco = lerBancoLocal()
  const criadoNoAparelho = banco.agendamentos.find((agendamento) => agendamento.id === id)
  if (criadoNoAparelho) {
    criadoNoAparelho.status = novoStatus
  } else {
    banco.alteracoes_de_status = banco.alteracoes_de_status.filter((item) => item.agendamento_id !== id)
    banco.alteracoes_de_status.push({ agendamento_id: id, status: novoStatus })
  }

  try {
    gravarBancoLocal(banco)
  } catch {
    return { erro: 'nao_salvou' }
  }
  return { agendamento: completarAgendamento({ ...atual, status: novoStatus }) }
}

export async function verificarEncaixe(profissionalId, data, minutos, duracaoMinutos) {
  const inicio = instanteEmSaoPaulo(data, minutos)
  const fim = inicio + duracaoMinutos * 60000
  if (fim <= Date.now()) return { erro: 'ja_passou' }

  const atendimento = todosOsAgendamentos().find(
    (agendamento) =>
      agendamento.profissional_id === profissionalId &&
      agendamento.status !== 'cancelado' &&
      seSobrepoe(inicio, fim, new Date(agendamento.inicio).getTime(), new Date(agendamento.fim).getTime()),
  )
  if (atendimento) {
    const completo = completarAgendamento(atendimento)
    return {
      erro: 'conflito',
      conflito: { tipo: 'atendimento', nome: completo.cliente.nome, inicio: atendimento.inicio, fim: atendimento.fim },
    }
  }

  const bloqueio = lerBloqueios().find(
    (item) =>
      item.profissional_id === profissionalId &&
      seSobrepoe(inicio, fim, new Date(item.inicio).getTime(), new Date(item.fim).getTime()),
  )
  if (bloqueio) {
    return {
      erro: 'conflito',
      conflito: { tipo: 'bloqueio', nome: bloqueio.motivo || 'Bloqueio', inicio: bloqueio.inicio, fim: bloqueio.fim },
    }
  }

  const turnos = lerHorarios().filter(
    (horario) => horario.profissional_id === profissionalId && horario.dia_semana === diaDaSemana(data),
  )
  return { livre: true, foraDoExpediente: !cabeNoExpediente(turnos, minutos, duracaoMinutos) }
}

function servicosUsados() {
  const idsValidos = todosOsAgendamentos().map((agendamento) => agendamento.id)
  return todosOsItensDeAgendamento().filter((item) => idsValidos.includes(item.agendamento_id))
}

function completarServicoDoSalao(catalogo, servico, usados) {
  return {
    ...servico,
    variacoes: catalogo.servico_variacoes
      .filter((variacao) => variacao.servico_id === servico.id)
      .sort((a, b) => a.ordem - b.ordem),
    profissional_ids: catalogo.profissional_servicos
      .filter((ligacao) => ligacao.servico_id === servico.id)
      .map((ligacao) => ligacao.profissional_id),
    usado: usados.some((item) => item.servico_id === servico.id),
  }
}

function categoriasEmUso(catalogo) {
  return catalogo.categorias.filter((categoria) => catalogo.servicos.some((servico) => servico.categoria === categoria))
}

function gravarCatalogo(catalogo) {
  const banco = lerBancoLocal()
  banco.catalogo = catalogo
  try {
    gravarBancoLocal(banco)
    return true
  } catch {
    return false
  }
}

export async function listarServicosDoSalao() {
  const catalogo = lerCatalogo()
  const usados = servicosUsados()
  return {
    categorias: categoriasEmUso(catalogo),
    servicos: catalogo.servicos
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((servico) => completarServicoDoSalao(catalogo, servico, usados)),
  }
}

export async function buscarServicoDoSalao(id) {
  const catalogo = lerCatalogo()
  const servico = catalogo.servicos.find((item) => item.id === id)
  return servico ? completarServicoDoSalao(catalogo, servico, servicosUsados()) : null
}

export async function listarProfissionaisAtivos() {
  return profissionais.filter((profissional) => profissional.ativo)
}

export async function salvarServico(dados) {
  const erros = errosDoServico(dados)
  if (temErros(erros)) return { erro: 'invalido', erros }

  const catalogo = lerCatalogo()
  const existente = dados.id ? catalogo.servicos.find((servico) => servico.id === dados.id) : null
  if (dados.id && !existente) return { erro: 'nao_encontrado' }

  const idsAtivos = profissionais.filter((profissional) => profissional.ativo).map((profissional) => profissional.id)
  const profissionalIds = [...new Set(dados.profissional_ids)].filter((id) => idsAtivos.includes(id))
  if (profissionalIds.length === 0) return { erro: 'invalido', erros: { profissionais: 'Marque pelo menos um profissional.' } }

  const categoria = dados.categoria.trim().replace(/\s+/g, ' ')
  const categoriaExistente = catalogo.categorias.find(
    (item) => item.toLowerCase() === categoria.toLowerCase(),
  )
  if (!categoriaExistente) catalogo.categorias.push(categoria)

  const comVariacoes = dados.variacoes.length > 0
  const resumo = comVariacoes ? resumoDasVariacoes(dados.variacoes) : null
  const id = existente ? existente.id : proximoId(catalogo.servicos)
  const maiorOrdem = catalogo.servicos.reduce((maior, servico) => Math.max(maior, servico.ordem), 0)

  const servico = {
    id,
    nome: dados.nome.trim().replace(/\s+/g, ' '),
    categoria: categoriaExistente || categoria,
    descricao: dados.descricao.trim() || null,
    foto_url: existente ? existente.foto_url : null,
    duracao_min: comVariacoes ? resumo.duracao_min : dados.duracao_min,
    preco: comVariacoes ? resumo.preco : dados.tipo_preco === 'consulta' ? null : dados.preco,
    tipo_preco: comVariacoes ? 'a_partir' : dados.tipo_preco,
    ativo: dados.ativo !== false,
    ordem: existente ? existente.ordem : maiorOrdem + 1,
    criado_em: existente ? existente.criado_em : new Date().toISOString(),
  }

  if (existente) {
    catalogo.servicos = catalogo.servicos.map((item) => (item.id === id ? servico : item))
  } else {
    catalogo.servicos.push(servico)
  }

  const usados = servicosUsados()
  const antigas = catalogo.servico_variacoes.filter((variacao) => variacao.servico_id === id)
  const idsMantidos = dados.variacoes.map((variacao) => variacao.id).filter(Boolean)
  for (const antiga of antigas) {
    const usada = usados.some((item) => item.variacao_id === antiga.id)
    if (!idsMantidos.includes(antiga.id) && usada) catalogo.variacoes_removidas.push(antiga)
  }

  let proximoIdDaVariacao = proximoId([...catalogo.servico_variacoes, ...catalogo.variacoes_removidas])
  const novasVariacoes = dados.variacoes.map((variacao, indice) => {
    const idValido = variacao.id && antigas.some((antiga) => antiga.id === variacao.id)
    const idDaVariacao = idValido ? variacao.id : proximoIdDaVariacao++
    return {
      id: idDaVariacao,
      servico_id: id,
      nome: variacao.nome.trim().replace(/\s+/g, ' '),
      preco: variacao.preco,
      duracao_min: variacao.duracao_min,
      ordem: indice + 1,
    }
  })
  catalogo.servico_variacoes = [
    ...catalogo.servico_variacoes.filter((variacao) => variacao.servico_id !== id),
    ...novasVariacoes,
  ]

  catalogo.profissional_servicos = [
    ...catalogo.profissional_servicos.filter((ligacao) => ligacao.servico_id !== id),
    ...profissionalIds.map((profissionalId) => ({ profissional_id: profissionalId, servico_id: id })),
  ]

  if (!gravarCatalogo(catalogo)) return { erro: 'nao_salvou' }
  return { servico: completarServicoDoSalao(catalogo, servico, usados) }
}

export async function alterarOrdemServico(id, direcao) {
  const catalogo = lerCatalogo()
  const ordenados = catalogo.servicos.slice().sort((a, b) => a.ordem - b.ordem)
  ordenados.forEach((servico, indice) => {
    servico.ordem = indice + 1
  })

  const servico = ordenados.find((item) => item.id === id)
  if (!servico) return { erro: 'nao_encontrado' }
  const daCategoria = ordenados.filter((item) => item.categoria === servico.categoria)
  const posicao = daCategoria.indexOf(servico)
  const vizinho = daCategoria[direcao === 'subir' ? posicao - 1 : posicao + 1]
  if (!vizinho) return { erro: 'sem_vizinho' }

  const ordemDoServico = servico.ordem
  servico.ordem = vizinho.ordem
  vizinho.ordem = ordemDoServico
  catalogo.servicos = ordenados

  if (!gravarCatalogo(catalogo)) return { erro: 'nao_salvou' }
  return { posicao: direcao === 'subir' ? posicao : posicao + 2, total: daCategoria.length }
}

export async function apagarServico(id) {
  const catalogo = lerCatalogo()
  const servico = catalogo.servicos.find((item) => item.id === id)
  if (!servico) return { erro: 'nao_encontrado' }
  if (servicosUsados().some((item) => item.servico_id === id)) return { erro: 'usado' }

  catalogo.servicos = catalogo.servicos.filter((item) => item.id !== id)
  catalogo.servico_variacoes = catalogo.servico_variacoes.filter((variacao) => variacao.servico_id !== id)
  catalogo.profissional_servicos = catalogo.profissional_servicos.filter((ligacao) => ligacao.servico_id !== id)
  catalogo.categorias = catalogo.categorias.filter(
    (categoria) => categoria !== servico.categoria || catalogo.servicos.some((item) => item.categoria === categoria),
  )

  if (!gravarCatalogo(catalogo)) return { erro: 'nao_salvou' }
  return { apagado: servico }
}

function gravarNoBanco(campo, valor) {
  const banco = lerBancoLocal()
  banco[campo] = valor
  try {
    gravarBancoLocal(banco)
    return true
  } catch {
    return false
  }
}

function novosHorarios(profissionalId, dias) {
  const outros = lerHorarios().filter((horario) => horario.profissional_id !== profissionalId)
  let id = proximoId(lerHorarios())
  return [...outros, ...horariosDosDias(dias, profissionalId).map((linha) => ({ id: id++, ...linha }))]
}

export async function conferirHorariosDoProfissional(profissionalId, dias) {
  return agendamentosForaDoHorario(todosOsAgendamentos(), novosHorarios(profissionalId, dias), profissionalId, Date.now())
    .sort(ordenarPorInicio)
    .map(completarAgendamento)
}

export async function salvarHorariosDoProfissional(profissionalId, dias) {
  if (!profissionais.some((profissional) => profissional.ativo && profissional.id === profissionalId)) {
    return { erro: 'nao_encontrado' }
  }
  if (!Array.isArray(dias) || dias.length !== 7 || errosDosHorarios(dias).temErro) return { erro: 'invalido' }
  if (!gravarNoBanco('horarios_trabalho', novosHorarios(profissionalId, dias))) return { erro: 'nao_salvou' }
  return { foraDoHorario: await conferirHorariosDoProfissional(profissionalId, dias) }
}

export async function listarBloqueiosFuturos() {
  const agora = Date.now()
  return lerBloqueios()
    .filter((bloqueio) => new Date(bloqueio.fim).getTime() > agora)
    .sort(ordenarPorInicio)
    .map((bloqueio) => ({
      ...bloqueio,
      profissional: profissionais.find((profissional) => profissional.id === bloqueio.profissional_id) || null,
    }))
}

export async function conflitosDoBloqueio(profissionalId, inicio, fim) {
  const inicioMs = new Date(inicio).getTime()
  const fimMs = new Date(fim).getTime()
  return todosOsAgendamentos()
    .filter(
      (agendamento) =>
        agendamento.profissional_id === profissionalId &&
        agendamento.status === 'agendado' &&
        seSobrepoe(inicioMs, fimMs, new Date(agendamento.inicio).getTime(), new Date(agendamento.fim).getTime()),
    )
    .sort(ordenarPorInicio)
    .map(completarAgendamento)
}

export async function criarBloqueio({ profissionalId, inicio, fim, motivo }) {
  const inicioMs = new Date(inicio).getTime()
  const fimMs = new Date(fim).getTime()
  const motivoLimpo = typeof motivo === 'string' ? motivo.trim().slice(0, 40) : ''
  if (!profissionais.some((profissional) => profissional.ativo && profissional.id === profissionalId)) {
    return { erro: 'nao_encontrado' }
  }
  if (!Number.isFinite(inicioMs) || !Number.isFinite(fimMs) || fimMs <= inicioMs) return { erro: 'invalido' }
  if (fimMs <= Date.now()) return { erro: 'ja_passou' }
  if (!motivoLimpo) return { erro: 'invalido' }

  const lista = lerBloqueios()
  const bloqueio = {
    id: proximoId(lista),
    profissional_id: profissionalId,
    inicio: new Date(inicioMs).toISOString(),
    fim: new Date(fimMs).toISOString(),
    motivo: motivoLimpo,
  }
  if (!gravarNoBanco('bloqueios', [...lista, bloqueio])) return { erro: 'nao_salvou' }
  return { bloqueio }
}

export async function removerBloqueio(id) {
  const lista = lerBloqueios()
  if (!lista.some((bloqueio) => bloqueio.id === id)) return { erro: 'nao_encontrado' }
  if (!gravarNoBanco('bloqueios', lista.filter((bloqueio) => bloqueio.id !== id))) return { erro: 'nao_salvou' }
  return { removido: true }
}
