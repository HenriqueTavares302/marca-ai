import { formatarPreco } from './formatos.js'

const chave = 'marca-ai:escolha'
const chaveDoProfissional = 'marca-ai:profissional'

export function carregarProfissional() {
  try {
    const salvo = sessionStorage.getItem(chaveDoProfissional)
    const id = salvo ? Number(salvo) : null
    return Number.isInteger(id) ? id : null
  } catch {
    return null
  }
}

export function salvarProfissional(id) {
  try {
    if (id === null) {
      sessionStorage.removeItem(chaveDoProfissional)
    } else {
      sessionStorage.setItem(chaveDoProfissional, String(id))
    }
  } catch {
    return
  }
}

const chaveDoHorario = 'marca-ai:horario'
const chaveDosDados = 'marca-ai:dados'
const chaveDosDadosLembrados = 'marca-ai:cliente-lembrado'

function lerJson(armazenamento, chaveDoItem) {
  try {
    const salvo = JSON.parse(armazenamento.getItem(chaveDoItem))
    return salvo && typeof salvo === 'object' ? salvo : null
  } catch {
    return null
  }
}

function textoOuVazio(valor, limite) {
  return typeof valor === 'string' ? valor.slice(0, limite) : ''
}

export function carregarDadosDoCliente() {
  const salvo = lerJson(sessionStorage, chaveDosDados)
  if (!salvo) return null
  return {
    nome: textoOuVazio(salvo.nome, 80),
    celular: textoOuVazio(salvo.celular, 20),
    observacao: textoOuVazio(salvo.observacao, 200),
    lembrar: salvo.lembrar !== false,
  }
}

export function salvarDadosDoCliente(dados) {
  try {
    sessionStorage.setItem(chaveDosDados, JSON.stringify(dados))
  } catch {
    return
  }
}

export function carregarDadosLembrados() {
  try {
    const salvo = lerJson(localStorage, chaveDosDadosLembrados)
    if (!salvo) return null
    return { nome: textoOuVazio(salvo.nome, 80), celular: textoOuVazio(salvo.celular, 20) }
  } catch {
    return null
  }
}

export function lembrarDados(nome, celular) {
  try {
    localStorage.setItem(chaveDosDadosLembrados, JSON.stringify({ nome, celular }))
  } catch {
    return
  }
}

export function esquecerDados() {
  try {
    localStorage.removeItem(chaveDosDadosLembrados)
  } catch {
    return
  }
}

export function carregarHorario() {
  try {
    const salvo = JSON.parse(sessionStorage.getItem(chaveDoHorario))
    const valido =
      salvo &&
      /^\d{4}-\d{2}-\d{2}$/.test(salvo.data) &&
      Number.isInteger(salvo.minutos) &&
      Number.isInteger(salvo.profissionalId)
    return valido ? salvo : null
  } catch {
    return null
  }
}

export function salvarHorario(horario) {
  try {
    if (horario === null) {
      sessionStorage.removeItem(chaveDoHorario)
    } else {
      sessionStorage.setItem(chaveDoHorario, JSON.stringify(horario))
    }
  } catch {
    return
  }
}

export function servicosQueFaltam(profissional, itens) {
  return itens.filter((item) => !profissional.servico_ids.includes(item.servico.id)).map((item) => item.servico)
}

export function profissionaisQueFazemTudo(profissionais, itens) {
  return profissionais.filter((profissional) => servicosQueFaltam(profissional, itens).length === 0)
}

export function juntarComE(lista) {
  if (lista.length <= 1) return lista.join('')
  return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1]
}

export function carregarEscolha() {
  try {
    const salvo = sessionStorage.getItem(chave)
    const lista = salvo ? JSON.parse(salvo) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

export function salvarEscolha(escolha) {
  try {
    sessionStorage.setItem(chave, JSON.stringify(escolha))
  } catch {
    return
  }
}

export function limparEscolha() {
  try {
    sessionStorage.removeItem(chave)
    sessionStorage.removeItem(chaveDoProfissional)
    sessionStorage.removeItem(chaveDoHorario)
    sessionStorage.removeItem(chaveDosDados)
  } catch {
    return
  }
}

export function resumirEscolha(escolha, servicos) {
  const itens = []

  for (const escolhido of escolha) {
    const servico = servicos.find((item) => item.id === escolhido.servico_id)
    if (!servico) continue
    const variacao = servico.variacoes.find((item) => item.id === escolhido.variacao_id) || null
    if (servico.variacoes.length > 0 && !variacao) continue

    itens.push({
      servico,
      variacao,
      nome: variacao ? servico.nome + ' · ' + variacao.nome : servico.nome,
      preco: variacao ? variacao.preco : servico.preco,
      duracao_min: variacao ? variacao.duracao_min : servico.duracao_min,
    })
  }

  const aCombinar = itens.some((item) => item.servico.tipo_preco === 'consulta' || item.preco === null)
  const aPartir = itens.some((item) => item.servico.tipo_preco === 'a_partir')
  const itensComPreco = itens.filter((item) => item.servico.tipo_preco !== 'consulta' && item.preco !== null)

  return {
    itens,
    quantidade: itens.length,
    duracaoTotal: itens.reduce((total, item) => total + item.duracao_min, 0),
    valorTotal: itensComPreco.reduce((total, item) => total + item.preco, 0),
    temValor: itensComPreco.length > 0,
    aPartir,
    aCombinar,
  }
}

export function textoDaQuantidade(quantidade) {
  return quantidade === 1 ? '1 serviço' : quantidade + ' serviços'
}

export function textoDoValorTotal(resumo) {
  if (!resumo.temValor) return 'valor a combinar'
  const valor = (resumo.aPartir ? 'a partir de ' : '') + formatarPreco(resumo.valorTotal)
  return resumo.aCombinar ? valor + ' + valor a combinar' : valor
}
