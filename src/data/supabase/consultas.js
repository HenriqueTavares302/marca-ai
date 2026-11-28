import { slugDoSalao } from '../../lib/salao.js'
import { ErroDosDados } from './erros.js'
import { executar } from './executar.js'
import { esquecerCodigosAntigos, guardarMeuCodigo, lerMeusCodigos } from './meusCodigos.js'
import { traduzirAgendamento, traduzirDias, traduzirHorariosLivres } from './traducoes.js'
import { buscarVitrine } from './vitrine.js'
import { criarAgendamentoNoSalao, listarDatasAbertasDoSalao, listarHorariosLivresDoSalao } from './salao.js'
import { hojeEmSaoPaulo } from '../../utils/fuso.js'
import {
  categoriasComServicos,
  duracaoDosItens,
  hojeJaEncerrou,
  horarioDoSalao,
  quemPodeAtender,
  profissionaisComServicos,
  servicosComVariacoes,
  servicosPopulares,
} from './catalogo.js'

async function lerVitrine() {
  const resultado = await buscarVitrine()
  if (resultado.erro) throw new ErroDosDados(resultado.erro)
  return resultado.dados
}

export async function buscarSalao() {
  return (await lerVitrine()).salao
}

export async function listarServicosComVariacoes() {
  return servicosComVariacoes(await lerVitrine())
}

export async function listarCategorias() {
  return categoriasComServicos(await lerVitrine())
}

export async function listarServicosPopulares(quantidade) {
  return servicosPopulares(await lerVitrine(), quantidade)
}

export async function listarHorarioDoSalao() {
  return horarioDoSalao(await lerVitrine())
}

export async function listarProfissionaisComServicos() {
  return profissionaisComServicos(await lerVitrine())
}

export async function buscarProfissional(id) {
  return (await lerVitrine()).profissionais.find((profissional) => profissional.id === id) || null
}

async function vitrineSeDer() {
  const resultado = await buscarVitrine()
  return resultado.dados || null
}

function codigoDoAgendamento(id) {
  const guardado = lerMeusCodigos().find((item) => item.id === id)
  return guardado ? guardado.codigo : null
}

function comRemarcacao(parametros, remarcarId) {
  if (!remarcarId) return parametros
  const codigo = codigoDoAgendamento(remarcarId)
  if (!codigo) throw new ErroDosDados('nao_encontrado')
  return { ...parametros, p_remarcar_id: remarcarId, p_codigo: codigo }
}

async function lerDoBanco(funcao, parametros) {
  const resultado = await executar((cliente) => cliente.rpc(funcao, parametros))
  if (resultado.erro) throw new ErroDosDados(resultado.erro)
  return resultado.dados
}

const validadeDosDiasEmMs = 10000
let diasGuardados = null

async function pedirDias(profissionalId, itens, datas, remarcarId) {
  const ordenadas = [...datas].sort()
  const parametros = comRemarcacao(
    {
      p_slug: slugDoSalao(),
      p_itens: itens,
      p_profissional_id: profissionalId,
      p_de: ordenadas[0],
      p_ate: ordenadas[ordenadas.length - 1],
    },
    remarcarId,
  )
  return traduzirDias(await lerDoBanco('dias_abertos', parametros))
}

function buscarDias(profissionalId, itens, datas, remarcarId) {
  const chave = JSON.stringify([profissionalId, itens, datas, remarcarId || null])
  if (diasGuardados && diasGuardados.chave === chave && Date.now() - diasGuardados.em < validadeDosDiasEmMs) {
    return diasGuardados.promessa
  }
  const promessa = pedirDias(profissionalId, itens, datas, remarcarId)
  const guardado = { chave, promessa, em: Date.now() }
  diasGuardados = guardado
  promessa.catch(() => {
    if (diasGuardados === guardado) diasGuardados = null
  })
  return promessa
}

export async function listarDatasAbertas(profissionalId, servicoIds, datas, itens = null, remarcarId = null) {
  if (!itens) return listarDatasAbertasDoSalao(profissionalId, datas)
  if (datas.length === 0) return []
  const dias = await buscarDias(profissionalId, itens, datas, remarcarId)
  return datas.filter((data) => dias.some((dia) => dia.data === data && dia.aberto))
}

async function diasSemVaga(profissionalId, itens, datas, remarcarId) {
  if (!itens || datas.length === 0) return { lotados: [], encerrados: [] }
  const dias = await buscarDias(profissionalId, itens, datas, remarcarId)
  const semVaga = datas.filter((data) => dias.some((dia) => dia.data === data && dia.aberto && !dia.temHorarioLivre))
  const hoje = hojeEmSaoPaulo()
  if (!semVaga.includes(hoje)) return { lotados: semVaga, encerrados: [] }
  const vitrine = await lerVitrine()
  const encerrou = hojeJaEncerrou(
    vitrine,
    quemPodeAtender(vitrine, profissionalId, itens),
    duracaoDosItens(vitrine, itens),
    Date.now(),
  )
  if (!encerrou) return { lotados: semVaga, encerrados: [] }
  return { lotados: semVaga.filter((data) => data !== hoje), encerrados: [hoje] }
}

export async function listarDiasLotados(profissionalId, itens, datas, remarcarId = null) {
  return (await diasSemVaga(profissionalId, itens, datas, remarcarId)).lotados
}

export async function listarDiasEncerrados(profissionalId, itens, datas, remarcarId = null) {
  return (await diasSemVaga(profissionalId, itens, datas, remarcarId)).encerrados
}

export async function listarHorariosLivres(
  data,
  profissionalId,
  duracaoMinutos,
  servicoIds = [],
  ignorarAgendamentoId = null,
  semAntecedencia = false,
  itens = null,
) {
  if (semAntecedencia) return listarHorariosLivresDoSalao(data, profissionalId, itens)
  if (!itens) return []
  const parametros = comRemarcacao(
    { p_slug: slugDoSalao(), p_itens: itens, p_profissional_id: profissionalId, p_data: data },
    ignorarAgendamentoId,
  )
  return traduzirHorariosLivres(await lerDoBanco('horarios_livres', parametros))
}

export async function criarAgendamento(dados) {
  if (dados.origem !== 'cliente') return criarAgendamentoNoSalao(dados)
  const resultado = await executar((cliente) =>
    cliente.rpc('criar_agendamento', {
      p_slug: slugDoSalao(),
      p_itens: dados.itens.map((item) => ({ servico_id: item.servico_id, variacao_id: item.variacao_id })),
      p_profissional_id: dados.profissionalId,
      p_inicio: dados.inicio,
      p_nome: dados.nome,
      p_telefone: dados.telefone,
      p_observacoes: dados.observacoes || null,
      p_forma_pagamento: dados.formaPagamento === 'pix' ? 'pix' : 'salao',
    }),
  )
  if (resultado.erro) return { erro: resultado.erro }
  guardarMeuCodigo(resultado.dados.id, resultado.dados.codigo)
  const agendamento = traduzirAgendamento(resultado.dados, await vitrineSeDer())
  if (!agendamento) return { erro: 'erro_inesperado' }
  return { agendamento, guardadoNoAparelho: true }
}

export async function listarMeusAgendamentos() {
  const codigos = lerMeusCodigos()
  if (codigos.length === 0) return []
  const lista = await lerDoBanco('meus_agendamentos', { p_codigos: codigos.map((item) => item.codigo) })
  const doBanco = Array.isArray(lista) ? lista : []
  esquecerCodigosAntigos(doBanco)
  const vitrine = await vitrineSeDer()
  return doBanco.map((item) => traduzirAgendamento(item, vitrine)).filter((agendamento) => agendamento)
}

async function alterarComCodigo(funcao, id, parametros) {
  const codigo = codigoDoAgendamento(id)
  if (!codigo) return { erro: 'nao_encontrado' }
  const resultado = await executar((cliente) =>
    cliente.rpc(funcao, { p_agendamento_id: id, p_codigo: codigo, ...parametros }),
  )
  if (resultado.erro) return { erro: resultado.erro }
  const agendamento = traduzirAgendamento(resultado.dados, await vitrineSeDer())
  return agendamento ? { agendamento } : { erro: 'erro_inesperado' }
}

export async function cancelarAgendamento(id) {
  return alterarComCodigo('cancelar_agendamento', id, {})
}

export async function remarcarAgendamento(id, profissionalId, novoInicio) {
  return alterarComCodigo('remarcar_agendamento', id, { p_inicio: novoInicio, p_profissional_id: profissionalId })
}

export {
  alterarOrdemServico,
  apagarServico,
  atualizarStatusAgendamento,
  buscarFichaDoCliente,
  buscarResumo,
  buscarServicoDoSalao,
  conferirCliente,
  conferirHorariosDoProfissional,
  conflitosDoBloqueio,
  criarBloqueio,
  listarAgendaDoDia,
  listarBloqueiosFuturos,
  listarClientes,
  listarClientesDoSalao,
  listarHorariosDoProfissional,
  listarProfissionaisAtivos,
  listarServicosDoSalao,
  removerBloqueio,
  removerDadosDoCliente,
  salvarCliente,
  salvarHorariosDoProfissional,
  salvarServico,
  verificarEncaixe,
} from './salao.js'
export { ouvirAvisosDoSalao } from './tempoReal.js'
