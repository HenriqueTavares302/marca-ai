import { textoDoValor, valorDoAgendamento } from './agenda.js'
import { formatarDataCurta, formatarDataLonga, nomeDoMes } from './formatos.js'
import { diaDaSemana, somarDias } from './fuso.js'

export const formasRecebidas = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'debito', rotulo: 'Cartão de débito' },
  { valor: 'credito', rotulo: 'Cartão de crédito' },
]

export const tiposDePeriodo = [
  { valor: 'dia', rotulo: 'Hoje' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
]

function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

function doisDigitos(numero) {
  return String(numero).padStart(2, '0')
}

export function periodoDoResumo(tipo, data) {
  if (tipo === 'semana') {
    const inicio = somarDias(data, -((diaDaSemana(data) + 6) % 7))
    const fim = somarDias(inicio, 6)
    const mesmoMes = inicio.slice(0, 7) === fim.slice(0, 7)
    const primeiro = formatarDataCurta(inicio).split(', ')[1]
    const ultimo = formatarDataCurta(fim).split(', ')[1]
    return {
      inicio,
      fim,
      titulo: mesmoMes ? primeiro.split(' de ')[0] + ' a ' + ultimo : primeiro + ' a ' + ultimo,
    }
  }
  if (tipo === 'mes') {
    const [ano, mes] = data.split('-').map(Number)
    return {
      inicio: ano + '-' + doisDigitos(mes) + '-01',
      fim: ano + '-' + doisDigitos(mes) + '-' + doisDigitos(ultimoDiaDoMes(ano, mes)),
      titulo: nomeDoMes(mes) + ' de ' + ano,
    }
  }
  return { inicio: data, fim: data, titulo: formatarDataLonga(data) }
}

export function andarNoPeriodo(tipo, data, passo) {
  if (tipo === 'semana') return somarDias(data, passo * 7)
  if (tipo === 'mes') {
    const [ano, mes] = data.split('-').map(Number)
    const total = ano * 12 + (mes - 1) + passo
    return Math.floor(total / 12) + '-' + doisDigitos((total % 12) + 1) + '-01'
  }
  return somarDias(data, passo)
}

function nomeDoItem(item) {
  return item.servico ? item.servico.nome : 'Serviço'
}

function valoresDosItens(agendamento) {
  const itens = agendamento.servicos
  const valorFinal = agendamento.valor_total === null || agendamento.valor_total === undefined ? 0 : agendamento.valor_total
  const somaDosItens = itens.reduce((total, item) => total + (item.preco || 0), 0)
  return itens.map((item) => ({
    nome: nomeDoItem(item),
    valor: somaDosItens > 0 ? ((item.preco || 0) / somaDosItens) * valorFinal : valorFinal / itens.length,
  }))
}

export function montarResumo(agendamentos, profissionais) {
  const concluidos = agendamentos.filter((agendamento) => agendamento.status === 'concluido')
  const faltas = agendamentos.filter((agendamento) => agendamento.status === 'faltou').length
  const cancelamentos = agendamentos.filter((agendamento) => agendamento.status === 'cancelado').length
  const previstos = agendamentos.filter((agendamento) => agendamento.status === 'agendado')
  const valorFinal = (agendamento) => agendamento.valor_total || 0
  const faturamento = concluidos.reduce((total, agendamento) => total + valorFinal(agendamento), 0)
  const deviamAcontecer = concluidos.length + faltas

  const somaPrevista = { total: 0, temValor: false, aPartir: false, aCombinar: false }
  for (const agendamento of previstos) {
    const valor = valorDoAgendamento(agendamento)
    somaPrevista.total += valor.total
    somaPrevista.temValor = somaPrevista.temValor || valor.temValor
    somaPrevista.aPartir = somaPrevista.aPartir || valor.aPartir
    somaPrevista.aCombinar = somaPrevista.aCombinar || valor.aCombinar
  }

  const porServico = {}
  for (const agendamento of concluidos) {
    for (const item of valoresDosItens(agendamento)) {
      if (!porServico[item.nome]) porServico[item.nome] = { nome: item.nome, quantidade: 0, valor: 0 }
      porServico[item.nome].quantidade += 1
      porServico[item.nome].valor += item.valor
    }
  }
  const servicos = Object.values(porServico)
    .map((servico) => ({ ...servico, valor: Math.round(servico.valor * 100) / 100 }))
    .sort((a, b) => b.quantidade - a.quantidade || b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, 5)

  const formas = formasRecebidas.map((forma) => {
    const pagos = concluidos.filter((agendamento) => agendamento.forma_recebida === forma.valor)
    return {
      forma: forma.valor,
      rotulo: forma.rotulo,
      quantidade: pagos.length,
      total: pagos.reduce((soma, agendamento) => soma + valorFinal(agendamento), 0),
    }
  })
  const semForma = concluidos.filter(
    (agendamento) => !formasRecebidas.some((forma) => forma.valor === agendamento.forma_recebida),
  )
  if (semForma.length > 0) {
    formas.push({
      forma: 'nao_informado',
      rotulo: 'Não informado',
      quantidade: semForma.length,
      total: semForma.reduce((soma, agendamento) => soma + valorFinal(agendamento), 0),
    })
  }

  return {
    vazio: agendamentos.length === 0,
    total: agendamentos.length,
    faturamento,
    concluidos: concluidos.length,
    faltas,
    percentualDeFaltas: deviamAcontecer > 0 ? Math.round((faltas / deviamAcontecer) * 100) : 0,
    cancelamentos,
    ticketMedio: concluidos.length > 0 ? faturamento / concluidos.length : 0,
    previstos: previstos.length,
    valorPrevisto: previstos.length > 0 ? textoDoValor(somaPrevista) : '',
    servicos,
    porProfissional: profissionais.map((profissional) => {
      const dele = concluidos.filter((agendamento) => agendamento.profissional_id === profissional.id)
      return {
        id: profissional.id,
        nome: profissional.nome,
        concluidos: dele.length,
        faturamento: dele.reduce((total, agendamento) => total + valorFinal(agendamento), 0),
      }
    }),
    formas,
  }
}
