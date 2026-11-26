const formatoDeMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarPreco(valor) {
  return formatoDeMoeda.format(valor)
}

export function formatarPrecoDoServico(servico) {
  if (servico.tipo_preco === 'consulta' || servico.preco === null) return 'Sob consulta'
  if (servico.tipo_preco === 'a_partir') return 'a partir de ' + formatarPreco(servico.preco)
  return formatarPreco(servico.preco)
}

export function formatarDuracao(minutos) {
  if (minutos < 60) return minutos + ' min'
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? horas + 'h' : horas + 'h' + String(resto).padStart(2, '0')
}

const diasCurtos = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const diasLongos = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const mesesCurtos = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const mesesLongos = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

function partesDaData(data) {
  const [ano, mes, dia] = data.split('-').map(Number)
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
  return { mes, dia, diaDaSemana }
}

export function nomeCurtoDoDia(data) {
  return diasCurtos[partesDaData(data).diaDaSemana]
}

export function numeroDoDia(data) {
  return partesDaData(data).dia
}

export function formatarDataCurta(data) {
  const { mes, dia, diaDaSemana } = partesDaData(data)
  return diasCurtos[diaDaSemana] + ', ' + dia + ' de ' + mesesCurtos[mes - 1]
}

export function formatarDataLonga(data) {
  const { mes, dia, diaDaSemana } = partesDaData(data)
  return diasLongos[diaDaSemana] + ', ' + dia + ' de ' + mesesLongos[mes - 1]
}

export function linkDoMapa(endereco) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(endereco)
}

export function linkDoWhatsapp(numero, mensagem) {
  return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem)
}
