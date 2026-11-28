import { supabase } from '../../lib/supabase.js'
import { apenasDigitosDoCelular, errosDoCliente } from '../../utils/cliente.js'
import { agendamentosForaDoHorario, errosDosHorarios, horariosDosDias } from '../../utils/expediente.js'
import { diaDaSemana, instanteEmSaoPaulo, somarDias } from '../../utils/fuso.js'
import { montarResumo, periodoDoResumo } from '../../utils/resumo.js'
import { errosDoServico, temErros } from '../../utils/servico.js'
import { ErroDosDados } from './erros.js'
import { executar } from './executar.js'
import { traduzirHorariosLivres } from './traducoes.js'
import { buscarVitrine, limparCacheDaVitrine } from './vitrine.js'

export const colunasDoAgendamento =
  'id, cliente_id, profissional_id, inicio, fim, status, valor_total, forma_pagamento, pago, forma_recebida, observacoes, criado_em, ' +
  'cliente:clientes(id, nome, telefone), itens:agendamento_servicos(servico_id, variacao_id, preco, duracao_min)'

const colunasDoCliente = 'id, nome, telefone, email, observacoes, criado_em'

function numeroOuNulo(valor) {
  if (valor === null || valor === undefined) return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

async function ler(pedido) {
  const resultado = await executar(pedido)
  if (resultado.erro) throw new ErroDosDados(resultado.erro)
  return resultado.dados
}

let perfilGuardado = null

export async function quemSouEu() {
  if (!supabase) throw new ErroDosDados('sem_configuracao')
  const { data } = await supabase.auth.getSession()
  const usuario = data && data.session ? data.session.user : null
  if (!usuario) throw new ErroDosDados('sessao_vencida')
  if (perfilGuardado && perfilGuardado.usuario === usuario.id) return perfilGuardado.perfil
  const perfil = await ler((cliente) =>
    cliente.from('profissionais').select('id, nome, papel, ativo, salao_id').eq('user_id', usuario.id).maybeSingle(),
  )
  if (!perfil || !perfil.ativo) throw new ErroDosDados('sem_permissao')
  perfilGuardado = { usuario: usuario.id, perfil }
  return perfil
}

export async function filtroDoProfissional(profissionalId) {
  const eu = await quemSouEu()
  return eu.papel === 'dono' ? profissionalId || null : eu.id
}

async function lerCatalogoDoSalao() {
  const [servicos, variacoes, ligacoes, precosDeVariacao, categorias, profissionais] = await Promise.all([
    ler((c) => c.from('servicos').select('id, categoria_id, nome, descricao, foto_url, duracao_min, preco, tipo_preco, ativo, ordem, criado_em').order('ordem').order('id')),
    ler((c) => c.from('servico_variacoes').select('id, servico_id, nome, preco, duracao_min, ordem, ativa').order('ordem').order('id')),
    ler((c) => c.from('profissional_servicos').select('profissional_id, servico_id, preco')),
    ler((c) => c.from('profissional_variacoes').select('profissional_id, variacao_id, preco')),
    ler((c) => c.from('categorias').select('id, nome, ordem').order('ordem').order('id')),
    ler((c) => c.from('profissionais').select('id, nome, foto_url, papel, ativo').order('id')),
  ])
  const nomeDaCategoria = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]))
  return {
    servicos: servicos.map((servico) => ({
      id: servico.id,
      nome: servico.nome,
      categoria: nomeDaCategoria.get(servico.categoria_id) || '',
      descricao: servico.descricao,
      foto_url: servico.foto_url,
      duracao_min: servico.duracao_min,
      preco: numeroOuNulo(servico.preco),
      tipo_preco: servico.tipo_preco,
      ativo: servico.ativo,
      ordem: servico.ordem,
      criado_em: servico.criado_em,
    })),
    variacoes: variacoes.map((variacao) => ({ ...variacao, preco: numeroOuNulo(variacao.preco) })),
    ligacoes: ligacoes.map((ligacao) => ({ ...ligacao, preco: numeroOuNulo(ligacao.preco) })),
    precosDeVariacao: precosDeVariacao.map((linha) => ({ ...linha, preco: numeroOuNulo(linha.preco) })),
    categorias: categorias.map((categoria) => categoria.nome),
    profissionais,
  }
}

function completarAgendamento(agendamento, catalogo) {
  return {
    id: agendamento.id,
    cliente_id: agendamento.cliente_id,
    profissional_id: agendamento.profissional_id,
    inicio: agendamento.inicio,
    fim: agendamento.fim,
    status: agendamento.status,
    valor_total: numeroOuNulo(agendamento.valor_total),
    forma_pagamento: agendamento.forma_pagamento,
    pago: agendamento.pago,
    forma_recebida: agendamento.forma_recebida,
    observacoes: agendamento.observacoes,
    criado_em: agendamento.criado_em,
    cliente: agendamento.cliente || { id: agendamento.cliente_id, nome: 'Cliente', telefone: null },
    profissional: catalogo.profissionais.find((profissional) => profissional.id === agendamento.profissional_id) || null,
    servicos: (agendamento.itens || []).map((item) => ({
      agendamento_id: agendamento.id,
      servico_id: item.servico_id,
      variacao_id: item.variacao_id,
      preco: numeroOuNulo(item.preco),
      duracao_min: item.duracao_min,
      servico: catalogo.servicos.find((servico) => servico.id === item.servico_id),
      variacao: catalogo.variacoes.find((variacao) => variacao.id === item.variacao_id) || null,
    })),
  }
}

function inicioDoDia(data) {
  return new Date(instanteEmSaoPaulo(data, 0)).toISOString()
}

function inicioDoDiaSeguinte(data) {
  return new Date(instanteEmSaoPaulo(somarDias(data, 1), 0)).toISOString()
}

async function lerAgendamentos(filtrar) {
  return ler((c) => filtrar(c.from('agendamentos').select(colunasDoAgendamento)).order('inicio'))
}

export async function listarProfissionaisAtivos() {
  return ler((c) => c.from('profissionais').select('id, nome, foto_url, papel, ativo').eq('ativo', true).order('id'))
}

export async function listarAgendaDoDia(data, profissionalId) {
  const filtro = await filtroDoProfissional(profissionalId)
  const [catalogo, vitrine] = await Promise.all([lerCatalogoDoSalao(), buscarVitrine()])
  const doDia = catalogo.profissionais.filter((profissional) => profissional.ativo && (!filtro || profissional.id === filtro))
  const ids = doDia.map((profissional) => profissional.id)
  const de = inicioDoDia(data)
  const ate = inicioDoDiaSeguinte(data)
  const [agendamentos, bloqueios, turnos] = await Promise.all([
    lerAgendamentos((q) => q.in('profissional_id', ids).gte('inicio', de).lt('inicio', ate)),
    ler((c) => c.from('bloqueios').select('id, profissional_id, inicio, fim, motivo').in('profissional_id', ids).lt('inicio', ate).gt('fim', de).order('inicio')),
    ler((c) => c.from('horarios_trabalho').select('id, profissional_id, dia_semana, inicio, fim').in('profissional_id', ids).eq('dia_semana', diaDaSemana(data)).order('inicio')),
  ])
  const horariosDoSalao = vitrine.dados ? vitrine.dados.horarios_trabalho : turnos
  return {
    profissionais: doDia,
    agendamentos: agendamentos.map((agendamento) => completarAgendamento(agendamento, catalogo)),
    bloqueios,
    turnos,
    salaoAberto: horariosDoSalao.some((horario) => horario.dia_semana === diaDaSemana(data)),
  }
}

export async function atualizarStatusAgendamento(id, novoStatus, recebimento = null) {
  const resultado = await executar((c) =>
    c.rpc('mudar_status_agendamento', {
      p_agendamento_id: id,
      p_status: novoStatus,
      p_valor: recebimento ? Number(recebimento.valor) : null,
      p_forma_recebida: recebimento ? recebimento.forma : null,
    }),
  )
  if (resultado.erro) return { erro: resultado.erro }
  const catalogo = await lerCatalogoDoSalao()
  const [agendamento] = await lerAgendamentos((q) => q.eq('id', id))
  return { agendamento: agendamento ? completarAgendamento(agendamento, catalogo) : null }
}

export async function listarClientes() {
  const lista = await ler((c) => c.from('clientes').select(colunasDoCliente).not('telefone', 'is', null))
  return lista.sort((a, b) => a.nome.localeCompare(b.nome))
}

export async function verificarEncaixe(profissionalId, data, minutos, duracaoMinutos) {
  const resultado = await executar((c) =>
    c.rpc('conferir_encaixe', {
      p_profissional_id: profissionalId,
      p_inicio: new Date(instanteEmSaoPaulo(data, minutos)).toISOString(),
      p_duracao_min: duracaoMinutos,
    }),
  )
  if (resultado.erro) return { erro: resultado.erro }
  const dados = resultado.dados || {}
  if (dados.erro) return { erro: dados.erro, conflito: dados.conflito }
  return { livre: dados.livre === true, foraDoExpediente: dados.fora_do_expediente === true }
}

export async function listarHorariosLivresDoSalao(data, profissionalId, itens) {
  if (!itens || itens.length === 0) return []
  const filtro = await filtroDoProfissional(profissionalId)
  return traduzirHorariosLivres(
    await ler((c) => c.rpc('salao_horarios_livres', { p_itens: itens, p_profissional_id: filtro, p_data: data })),
  )
}

export async function listarDatasAbertasDoSalao(profissionalId, datas) {
  const filtro = await filtroDoProfissional(profissionalId)
  const vitrine = await buscarVitrine()
  if (vitrine.erro) throw new ErroDosDados(vitrine.erro)
  const ids = filtro ? [filtro] : vitrine.dados.profissionais.map((profissional) => profissional.id)
  const ordenadas = [...datas].sort()
  const bloqueios = ordenadas.length
    ? await ler((c) =>
        c.from('bloqueios').select('profissional_id, inicio, fim').in('profissional_id', ids)
          .lt('inicio', inicioDoDiaSeguinte(ordenadas[ordenadas.length - 1])).gt('fim', inicioDoDia(ordenadas[0])),
      )
    : []
  return datas.filter((data) =>
    ids.some((id) => {
      const atende = vitrine.dados.horarios_trabalho.some((h) => h.profissional_id === id && h.dia_semana === diaDaSemana(data))
      const bloqueadoODia = bloqueios.some(
        (b) =>
          b.profissional_id === id &&
          new Date(b.inicio).getTime() <= instanteEmSaoPaulo(data, 0) &&
          new Date(b.fim).getTime() >= instanteEmSaoPaulo(somarDias(data, 1), 0),
      )
      return atende && !bloqueadoODia
    }),
  )
}

export async function criarAgendamentoNoSalao({ nome, telefone, profissionalId, inicio, itens, observacoes, formaPagamento }) {
  const eu = await quemSouEu()
  const resultado = await executar((c) =>
    c.rpc('salao_criar_agendamento', {
      p_itens: itens.map((item) => ({ servico_id: item.servico_id, variacao_id: item.variacao_id })),
      p_profissional_id: eu.papel === 'dono' ? profissionalId : eu.id,
      p_inicio: inicio,
      p_nome: nome,
      p_telefone: apenasDigitosDoCelular(telefone),
      p_observacoes: observacoes || null,
      p_forma_pagamento: formaPagamento === 'pix' ? 'pix' : 'salao',
    }),
  )
  if (resultado.erro) return { erro: resultado.erro }
  const catalogo = await lerCatalogoDoSalao()
  const [agendamento] = await lerAgendamentos((q) => q.eq('id', resultado.dados))
  return { agendamento: agendamento ? completarAgendamento(agendamento, catalogo) : { id: resultado.dados } }
}

function servicoDoSalao(catalogo, servico, usados) {
  const ligacoes = catalogo.ligacoes.filter((ligacao) => ligacao.servico_id === servico.id)
  const ativos = catalogo.profissionais.filter((profissional) => profissional.ativo).map((profissional) => profissional.id)
  const quemFaz = ligacoes.filter((ligacao) => ativos.includes(ligacao.profissional_id))
  const precosDoServico = {}
  for (const ligacao of quemFaz) {
    if (typeof ligacao.preco === 'number') precosDoServico[ligacao.profissional_id] = ligacao.preco
  }
  return {
    ...servico,
    profissional_ids: ligacoes.map((ligacao) => ligacao.profissional_id),
    precos_por_profissional: precosDoServico,
    variacoes: catalogo.variacoes
      .filter((variacao) => variacao.servico_id === servico.id && variacao.ativa)
      .map((variacao) => {
        const precosDaVariacao = {}
        for (const linha of catalogo.precosDeVariacao) {
          const faz = quemFaz.some((ligacao) => ligacao.profissional_id === linha.profissional_id)
          if (linha.variacao_id === variacao.id && faz && typeof linha.preco === 'number') {
            precosDaVariacao[linha.profissional_id] = linha.preco
          }
        }
        return {
          id: variacao.id,
          servico_id: variacao.servico_id,
          nome: variacao.nome,
          preco: variacao.preco,
          duracao_min: variacao.duracao_min,
          ordem: variacao.ordem,
          precos_por_profissional: precosDaVariacao,
        }
      }),
    usado: usados.includes(servico.id),
  }
}

async function servicosUsados() {
  const eu = await quemSouEu()
  if (eu.papel !== 'dono') return []
  const itens = await ler((c) => c.from('agendamento_servicos').select('servico_id'))
  return [...new Set(itens.map((item) => item.servico_id))]
}

export async function listarServicosDoSalao() {
  const [catalogo, usados] = await Promise.all([lerCatalogoDoSalao(), servicosUsados()])
  return {
    categorias: catalogo.categorias.filter((categoria) => catalogo.servicos.some((servico) => servico.categoria === categoria)),
    servicos: catalogo.servicos.map((servico) => servicoDoSalao(catalogo, servico, usados)),
  }
}

export async function buscarServicoDoSalao(id) {
  const [catalogo, usados] = await Promise.all([lerCatalogoDoSalao(), servicosUsados()])
  const servico = catalogo.servicos.find((item) => item.id === id)
  return servico ? servicoDoSalao(catalogo, servico, usados) : null
}

export async function salvarServico(dados) {
  const erros = errosDoServico(dados)
  if (temErros(erros)) return { erro: 'invalido', erros }
  const resultado = await executar((c) =>
    c.rpc('salvar_servico', {
      p_dados: {
        id: dados.id || null,
        nome: dados.nome,
        categoria: dados.categoria,
        descricao: dados.descricao,
        tipo_preco: dados.tipo_preco,
        preco: dados.preco,
        duracao_min: dados.duracao_min,
        ativo: dados.ativo !== false,
        variacoes: dados.variacoes.map((variacao) => ({
          id: variacao.id || null,
          nome: variacao.nome,
          preco: variacao.preco,
          duracao_min: variacao.duracao_min,
        })),
        profissional_ids: dados.profissional_ids,
        precos_profissionais: Array.isArray(dados.precos_profissionais) ? dados.precos_profissionais : [],
      },
    }),
  )
  if (resultado.erro === 'sem_profissional') {
    return { erro: 'invalido', erros: { profissionais: 'Marque pelo menos um profissional.' } }
  }
  if (resultado.erro) return { erro: resultado.erro === 'servico_invalido' ? 'invalido' : resultado.erro, erros: {} }
  limparCacheDaVitrine()
  return { servico: await buscarServicoDoSalao(resultado.dados) }
}

export async function alterarOrdemServico(id, direcao) {
  const resultado = await executar((c) => c.rpc('trocar_ordem_servico', { p_servico_id: id, p_direcao: direcao }))
  if (resultado.erro) return { erro: resultado.erro }
  limparCacheDaVitrine()
  return { posicao: resultado.dados.posicao, total: resultado.dados.total }
}

export async function apagarServico(id) {
  const antes = await buscarServicoDoSalao(id)
  if (!antes) return { erro: 'nao_encontrado' }
  const resultado = await executar((c) => c.rpc('apagar_servico', { p_servico_id: id }))
  if (resultado.erro) return { erro: resultado.erro === 'servico_usado' ? 'usado' : resultado.erro }
  limparCacheDaVitrine()
  return { apagado: antes }
}

export async function listarHorariosDoProfissional(profissionalId) {
  return ler((c) =>
    c.from('horarios_trabalho').select('id, profissional_id, dia_semana, inicio, fim').eq('profissional_id', profissionalId).order('dia_semana').order('inicio'),
  )
}

export async function conferirHorariosDoProfissional(profissionalId, dias) {
  const agora = Date.now()
  const [catalogo, futuros] = await Promise.all([
    lerCatalogoDoSalao(),
    lerAgendamentos((q) => q.eq('profissional_id', profissionalId).eq('status', 'agendado').gt('inicio', new Date(agora).toISOString())),
  ])
  return agendamentosForaDoHorario(futuros, horariosDosDias(dias, profissionalId), profissionalId, agora).map((agendamento) =>
    completarAgendamento(agendamento, catalogo),
  )
}

export async function salvarHorariosDoProfissional(profissionalId, dias) {
  if (!Array.isArray(dias) || dias.length !== 7 || errosDosHorarios(dias).temErro) return { erro: 'invalido' }
  const linhas = horariosDosDias(dias, profissionalId).map((linha) => ({
    dia_semana: linha.dia_semana,
    inicio: linha.inicio,
    fim: linha.fim,
  }))
  const resultado = await executar((c) =>
    c.rpc('salvar_horarios_do_profissional', { p_profissional_id: profissionalId, p_linhas: linhas }),
  )
  if (resultado.erro) return { erro: resultado.erro === 'horarios_sobrepostos' ? 'invalido' : resultado.erro }
  limparCacheDaVitrine()
  return { foraDoHorario: await conferirHorariosDoProfissional(profissionalId, dias) }
}

export async function listarBloqueiosFuturos() {
  const [bloqueios, profissionais] = await Promise.all([
    ler((c) => c.from('bloqueios').select('id, profissional_id, inicio, fim, motivo').gt('fim', new Date().toISOString()).order('inicio')),
    ler((c) => c.from('profissionais').select('id, nome, foto_url, papel, ativo')),
  ])
  return bloqueios.map((bloqueio) => ({
    ...bloqueio,
    profissional: profissionais.find((profissional) => profissional.id === bloqueio.profissional_id) || null,
  }))
}

export async function conflitosDoBloqueio(profissionalId, inicio, fim) {
  const [catalogo, agendamentos] = await Promise.all([
    lerCatalogoDoSalao(),
    lerAgendamentos((q) =>
      q.eq('profissional_id', profissionalId).eq('status', 'agendado').lt('inicio', new Date(fim).toISOString()).gt('fim', new Date(inicio).toISOString()),
    ),
  ])
  return agendamentos.map((agendamento) => completarAgendamento(agendamento, catalogo))
}

export async function criarBloqueio({ profissionalId, inicio, fim, motivo }) {
  const inicioMs = new Date(inicio).getTime()
  const fimMs = new Date(fim).getTime()
  const motivoLimpo = typeof motivo === 'string' ? motivo.trim().slice(0, 40) : ''
  if (!Number.isFinite(inicioMs) || !Number.isFinite(fimMs) || fimMs <= inicioMs) return { erro: 'invalido' }
  if (fimMs <= Date.now()) return { erro: 'ja_passou' }
  if (!motivoLimpo) return { erro: 'invalido' }
  const eu = await quemSouEu()
  const resultado = await executar((c) =>
    c
      .from('bloqueios')
      .insert({
        salao_id: eu.salao_id,
        profissional_id: profissionalId,
        inicio: new Date(inicioMs).toISOString(),
        fim: new Date(fimMs).toISOString(),
        motivo: motivoLimpo,
      })
      .select('id, profissional_id, inicio, fim, motivo')
      .single(),
  )
  if (resultado.erro) return { erro: resultado.erro }
  return { bloqueio: resultado.dados }
}

export async function removerBloqueio(id) {
  const resultado = await executar((c) => c.from('bloqueios').delete().eq('id', id).select('id'))
  if (resultado.erro) return { erro: resultado.erro }
  if (!resultado.dados || resultado.dados.length === 0) return { erro: 'nao_encontrado' }
  return { removido: true }
}

function resumoDoCliente(cliente, agendamentos) {
  const concluidos = agendamentos
    .filter((agendamento) => agendamento.cliente_id === cliente.id && agendamento.status === 'concluido')
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
  const ultimo = concluidos[concluidos.length - 1]
  return { ...cliente, atendimentos: concluidos.length, ultimo_atendimento: ultimo ? ultimo.inicio : null }
}

export async function listarClientesDoSalao() {
  const [clientes, agendamentos] = await Promise.all([
    ler((c) => c.from('clientes').select(colunasDoCliente).not('telefone', 'is', null)),
    ler((c) => c.from('agendamentos').select('cliente_id, status, inicio')),
  ])
  return clientes.map((cliente) => resumoDoCliente(cliente, agendamentos))
}

export async function buscarFichaDoCliente(id) {
  const cliente = await ler((c) => c.from('clientes').select(colunasDoCliente).eq('id', id).maybeSingle())
  if (!cliente || !cliente.telefone) return null
  const [catalogo, dele] = await Promise.all([lerCatalogoDoSalao(), lerAgendamentos((q) => q.eq('cliente_id', id))])
  const agora = Date.now()
  const completos = dele.map((agendamento) => completarAgendamento(agendamento, catalogo))
  const ehProximo = (agendamento) => agendamento.status === 'agendado' && new Date(agendamento.fim).getTime() > agora
  const concluidos = completos.filter((agendamento) => agendamento.status === 'concluido')
  return {
    cliente,
    proximos: completos.filter(ehProximo),
    historico: completos.filter((agendamento) => !ehProximo(agendamento)).reverse(),
    numeros: {
      concluidos: concluidos.length,
      faltas: completos.filter((agendamento) => agendamento.status === 'faltou').length,
      totalGasto: concluidos.reduce((total, agendamento) => total + (agendamento.valor_total || 0), 0),
      temValorACombinar: concluidos.some((agendamento) => agendamento.valor_total === null),
    },
  }
}

async function clientesParaConferir(dados) {
  const telefone = apenasDigitosDoCelular(dados.celular)
  const filtro = dados.id ? 'telefone.eq.' + telefone + ',id.eq.' + Number(dados.id) : 'telefone.eq.' + telefone
  return ler((c) => c.from('clientes').select('id, nome, telefone').or(filtro))
}

export async function conferirCliente(dados) {
  return errosDoCliente(dados, await clientesParaConferir(dados))
}

const celularDeOutroCliente = 'Já existe um cliente com esse celular. Fale com o dono do salão.'

export async function salvarCliente(dados) {
  const lista = await clientesParaConferir(dados)
  const atual = dados.id ? lista.find((cliente) => cliente.id === dados.id) : null
  if (dados.id && (!atual || !atual.telefone)) return { erro: 'nao_encontrado' }
  const erros = errosDoCliente(dados, lista)
  if (Object.keys(erros).length > 0) return { erro: 'invalido', erros }

  const campos = {
    nome: dados.nome.trim().replace(/\s+/g, ' '),
    telefone: apenasDigitosDoCelular(dados.celular),
    observacoes: String(dados.observacoes || '').trim() || null,
  }
  const eu = await quemSouEu()
  const resultado = await executar((c) =>
    atual
      ? c.from('clientes').update(campos).eq('id', atual.id).select(colunasDoCliente).single()
      : c.from('clientes').insert({ ...campos, salao_id: eu.salao_id }).select(colunasDoCliente).single(),
  )
  if (resultado.erro === 'repetido') return { erro: 'invalido', erros: { celular: celularDeOutroCliente } }
  if (resultado.erro) return { erro: resultado.erro }
  return { cliente: resultado.dados }
}

export async function removerDadosDoCliente(id) {
  const resultado = await executar((c) => c.rpc('remover_dados_do_cliente', { p_cliente_id: id }))
  if (resultado.erro === 'tem_agendamento_futuro') return { erro: 'tem_futuros' }
  if (resultado.erro) return { erro: resultado.erro }
  return resultado.dados === 'anonimizado' ? { anonimizado: true } : { apagado: true }
}

export async function buscarResumo(tipo, data, profissionalId) {
  const filtro = await filtroDoProfissional(profissionalId)
  const periodo = periodoDoResumo(tipo, data)
  const catalogo = await lerCatalogoDoSalao()
  const doResumo = catalogo.profissionais.filter((profissional) => profissional.ativo && (!filtro || profissional.id === filtro))
  const ids = doResumo.map((profissional) => profissional.id)
  const agendamentos = await lerAgendamentos((q) =>
    q.in('profissional_id', ids).gte('inicio', inicioDoDia(periodo.inicio)).lt('inicio', inicioDoDiaSeguinte(periodo.fim)),
  )
  return { periodo, ...montarResumo(agendamentos.map((agendamento) => completarAgendamento(agendamento, catalogo)), doResumo) }
}
