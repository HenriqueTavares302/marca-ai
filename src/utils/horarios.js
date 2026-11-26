import { partesEmSaoPaulo } from './fuso.js'

const nomesDosDias =['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const ordemDaSemana = [1, 2, 3, 4, 5, 6, 0]

function comMaiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function formatarHora(hora) {
  const [horas, minutos] = hora.split(':')
  return Number(horas) + 'h' + (minutos === '00' ? '' : minutos)
}

export function situacaoDoSalao(semana, agora) {
  const agoraEmSaoPaulo = partesEmSaoPaulo(agora)
  const hoje = agoraEmSaoPaulo.diaSemana
  const horaAgora = agoraEmSaoPaulo.hora + ':00'
  const intervalosDeHoje = semana[hoje] || []

  const atual = intervalosDeHoje.find((intervalo) => horaAgora >= intervalo.inicio && horaAgora < intervalo.fim)
  if (atual) {
    return { aberto: true, texto: 'Aberto agora', detalhe: 'fecha às ' + formatarHora(atual.fim) }
  }

  const maisTarde = intervalosDeHoje.find((intervalo) => horaAgora < intervalo.inicio)
  if (maisTarde) {
    return { aberto: false, texto: 'Fechado agora', detalhe: 'abre hoje às ' + formatarHora(maisTarde.inicio) }
  }

  for (let dias = 1; dias <= 7; dias++) {
    const dia = (hoje + dias) % 7
    const intervalos = semana[dia]
    if (intervalos && intervalos.length > 0) {
      const quando = dias === 1 ? 'amanhã' : nomesDosDias[dia]
      return { aberto: false, texto: 'Fechado agora', detalhe: 'abre ' + quando + ' às ' + formatarHora(intervalos[0].inicio) }
    }
  }

  return { aberto: false, texto: 'Fechado', detalhe: 'sem horários cadastrados' }
}

function textoDoHorario(intervalos) {
  if (!intervalos || intervalos.length === 0) return 'Fechado'
  return intervalos.map((intervalo) => formatarHora(intervalo.inicio) + ' às ' + formatarHora(intervalo.fim)).join(' e ')
}

export function agruparHorariosDaSemana(semana) {
  const grupos = []

  for (const dia of ordemDaSemana) {
    const texto = textoDoHorario(semana[dia])
    const ultimo = grupos[grupos.length - 1]

    if (ultimo && ultimo.horario === texto) {
      ultimo.dias.push(dia)
    } else {
      grupos.push({ dias: [dia], horario: texto })
    }
  }

  return grupos.map((grupo) => {
    const primeiro = comMaiuscula(nomesDosDias[grupo.dias[0]])
    const ultimo = nomesDosDias[grupo.dias[grupo.dias.length - 1]]
    return {
      dias: grupo.dias,
      nome: grupo.dias.length === 1 ? primeiro : primeiro + ' a ' + ultimo,
      horario: grupo.horario,
    }
  })
}
