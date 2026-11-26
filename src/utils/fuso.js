const fuso = 'America/Sao_Paulo'

const formatador = new Intl.DateTimeFormat('en-CA', {
  timeZone: fuso,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export function diaDaSemana(data) {
  const [ano, mes, dia] = data.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
}

export function partesEmSaoPaulo(instante) {
  const partes = {}
  for (const parte of formatador.formatToParts(new Date(instante))) {
    partes[parte.type] = parte.value
  }
  const data = partes.year + '-' + partes.month + '-' + partes.day
  const horas = Number(partes.hour)
  const minutos = Number(partes.minute)

  return {
    data,
    hora: partes.hour + ':' + partes.minute,
    minutosDoDia: horas * 60 + minutos,
    diaSemana: diaDaSemana(data),
    relogio: Date.UTC(Number(partes.year), Number(partes.month) - 1, Number(partes.day), horas, minutos, Number(partes.second)),
  }
}

export function instanteEmSaoPaulo(data, minutosDoDia) {
  const [ano, mes, dia] = data.split('-').map(Number)
  const palpite = Date.UTC(ano, mes - 1, dia, 0, minutosDoDia)
  const diferenca = partesEmSaoPaulo(palpite).relogio - palpite
  const instante = palpite - diferenca
  const ajuste = partesEmSaoPaulo(instante).relogio - instante
  return ajuste === diferenca ? instante : palpite - ajuste
}

export function hojeEmSaoPaulo() {
  return partesEmSaoPaulo(Date.now()).data
}

export function somarDias(data, dias) {
  const [ano, mes, dia] = data.split('-').map(Number)
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + dias))
  return resultado.toISOString().slice(0, 10)
}
