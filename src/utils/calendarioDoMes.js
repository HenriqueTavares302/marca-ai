import { formatarDataLonga, nomeDoMes } from './formatos.js'
import { diaDaSemana, somarDias } from './fuso.js'

export const quantidadeDeDiasDaFaixa = 21
export const prazoDoClienteEmDias = 90

export function limiteDoCliente(hoje) {
  return somarDias(hoje, prazoDoClienteEmDias)
}

export function limiteDoBalcao(hoje) {
  const [ano, mes, dia] = hoje.split('-')
  const diaDoLimite = mes === '02' && dia === '29' ? '28' : dia
  return Number(ano) + 1 + '-' + mes + '-' + diaDoLimite
}

export function mesDaData(data) {
  return data.slice(0, 7)
}

export function somarMeses(mes, quantidade) {
  const [ano, numero] = mes.split('-').map(Number)
  const total = ano * 12 + (numero - 1) + quantidade
  return Math.floor(total / 12) + '-' + String((total % 12) + 1).padStart(2, '0')
}

export function tituloDoMes(mes) {
  const [ano, numero] = mes.split('-').map(Number)
  return nomeDoMes(numero) + ' de ' + ano
}

export function diasDoMes(mes) {
  const dias = []
  let data = mes + '-01'
  while (mesDaData(data) === mes) {
    dias.push(data)
    data = somarDias(data, 1)
  }
  return dias
}

export function semanasDoMes(mes) {
  const dias = diasDoMes(mes)
  const casas = [...Array(diaDaSemana(dias[0])).fill(null), ...dias]
  while (casas.length % 7 !== 0) casas.push(null)
  const semanas = []
  for (let inicio = 0; inicio < casas.length; inicio += 7) {
    semanas.push(casas.slice(inicio, inicio + 7))
  }
  return semanas
}

export function datasParaBuscar(mes, hoje, limite) {
  return diasDoMes(mes).filter((data) => data >= hoje && data <= limite)
}

export function podeVoltarMes(mes, hoje) {
  return mes > mesDaData(hoje)
}

export function podeAvancarMes(mes, limite) {
  return mes < mesDaData(limite)
}

export function situacaoDoDia(data, hoje, limite, dias) {
  if (data < hoje) return 'passou'
  if (data > limite) return 'fora_do_prazo'
  const dia = dias.find((item) => item.data === data)
  if (!dia || !dia.aberto) return 'fechado'
  if (dia.encerrado) return 'encerrado'
  if (dia.lotado) return 'lotado'
  return 'livre'
}

const palavras = {
  fechado: 'fechado',
  lotado: 'lotado',
  encerrado: 'encerrou',
}

export function palavraDaSituacao(situacao) {
  return palavras[situacao] || ''
}

const explicacoes = {
  livre: '',
  fechado: 'fechado',
  lotado: 'lotado',
  encerrado: 'encerrado por hoje',
  passou: 'já passou',
  fora_do_prazo: 'fora do prazo',
}

export function rotuloDoDia(data, hoje, situacao) {
  const partes = [formatarDataLonga(data).toLowerCase()]
  if (data === hoje) partes.push('hoje')
  if (explicacoes[situacao]) partes.push(explicacoes[situacao])
  return partes.join(', ')
}

export function diaTocavel(situacao, balcao) {
  if (situacao === 'livre') return true
  return balcao && (situacao === 'fechado' || situacao === 'lotado' || situacao === 'encerrado')
}

export function diasDaFaixa(inicio, limite) {
  return Array.from({ length: quantidadeDeDiasDaFaixa }, (_, indice) => somarDias(inicio, indice)).filter(
    (data) => data <= limite,
  )
}
