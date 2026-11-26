export const duracoesRapidas = [30, 45, 60, 90, 120]
export const tamanhosPadrao = ['Curto', 'Médio', 'Longo']
export const limiteDeVariacoes = 10

const maiorPreco = 100000
const menorDuracao = 5
const maiorDuracao = 720

export function lerPreco(texto) {
  const limpo = String(texto).replace(/R\$/g, '').replace(/\s/g, '')
  if (!/^\d+([.,]\d{3})*([.,]\d{1,2})?$/.test(limpo)) return null
  let numero = limpo
  if (limpo.includes(',')) {
    numero = limpo.replace(/\./g, '').replace(',', '.')
  } else if (/\.\d{3}$/.test(limpo)) {
    numero = limpo.replace(/\./g, '')
  }
  const valor = Math.round(Number(numero) * 100) / 100
  return Number.isFinite(valor) ? valor : null
}

export function lerMinutos(texto) {
  const limpo = String(texto).trim()
  if (!/^\d{1,4}$/.test(limpo)) return null
  return Number(limpo)
}

export function textoDoPreco(valor) {
  if (valor === null || valor === undefined) return ''
  return valor.toFixed(2).replace('.', ',')
}

function erroDoPreco(preco) {
  if (preco === null) return 'Digite o preço, como 45,00.'
  if (preco <= 0) return 'O preço precisa ser maior que zero.'
  if (preco > maiorPreco) return 'Confira o preço: parece alto demais.'
  return ''
}

function erroDaDuracao(duracao) {
  if (duracao === null) return 'Digite a duração em minutos, como 45.'
  if (duracao < menorDuracao || duracao > maiorDuracao) return 'A duração vai de 5 minutos a 12 horas (720 minutos).'
  return ''
}

export function errosDoServico(dados) {
  const nome = dados.nome.trim()
  const categoria = dados.categoria.trim()
  const erros = {}

  if (nome.length < 2) erros.nome = 'Digite o nome do serviço.'
  else if (nome.length > 60) erros.nome = 'Use no máximo 60 caracteres.'

  if (categoria.length < 2) erros.categoria = 'Escolha ou crie uma categoria.'
  else if (categoria.length > 30) erros.categoria = 'Use no máximo 30 caracteres na categoria.'

  if (dados.descricao.trim().length > 160) erros.descricao = 'Use no máximo 160 caracteres.'

  if (dados.variacoes.length === 0) {
    const erroDeDuracao = erroDaDuracao(dados.duracao_min)
    if (erroDeDuracao) erros.duracao = erroDeDuracao
    if (!['fixo', 'a_partir', 'consulta'].includes(dados.tipo_preco)) {
      erros.preco = 'Escolha o tipo de preço.'
    } else if (dados.tipo_preco !== 'consulta') {
      const erroDePreco = erroDoPreco(dados.preco)
      if (erroDePreco) erros.preco = erroDePreco
    }
  }

  if (dados.variacoes.length > limiteDeVariacoes) {
    erros.quantidadeDeVariacoes = 'Use no máximo ' + limiteDeVariacoes + ' variações.'
  }

  const nomesVistos = []
  const errosDasVariacoes = dados.variacoes.map((variacao) => {
    const erro = {}
    const nomeDaVariacao = variacao.nome.trim()
    if (!nomeDaVariacao) erro.nome = 'Digite o nome da variação.'
    else if (nomeDaVariacao.length > 30) erro.nome = 'Use no máximo 30 caracteres.'
    else if (nomesVistos.includes(nomeDaVariacao.toLowerCase())) erro.nome = 'Já existe uma variação com esse nome.'
    nomesVistos.push(nomeDaVariacao.toLowerCase())
    const erroDePreco = erroDoPreco(variacao.preco)
    if (erroDePreco) erro.preco = erroDePreco
    const erroDeDuracao = erroDaDuracao(variacao.duracao_min)
    if (erroDeDuracao) erro.duracao = erroDeDuracao
    return erro
  })
  if (errosDasVariacoes.some((erro) => Object.keys(erro).length > 0)) erros.variacoes = errosDasVariacoes

  if (dados.profissional_ids.length === 0) erros.profissionais = 'Marque pelo menos um profissional.'

  return erros
}

export function temErros(erros) {
  return Object.keys(erros).length > 0
}

export function resumoDasVariacoes(variacoes) {
  const precos = variacoes.map((variacao) => variacao.preco)
  const duracoes = variacoes.map((variacao) => variacao.duracao_min)
  return { preco: Math.min(...precos), duracao_min: Math.min(...duracoes) }
}
