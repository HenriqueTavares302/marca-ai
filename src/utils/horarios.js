const nomesDosDias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const ordemDaSemana = [1, 2, 3, 4, 5, 6, 0]

function comMaiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function formatarHora(hora) {
  const [horas, minutos] = hora.split(':')
  return Number(horas) + 'h' + (minutos === '00' ? '' : minutos)
}

export function situacaoDoSalao(semana, agora) {
  const hoje = agora.getDay()
  const horaAgora = agora.toTimeString().slice(0, 8)
  const horarioDeHoje = semana[hoje]

  if (horarioDeHoje && horaAgora >= horarioDeHoje.inicio && horaAgora < horarioDeHoje.fim) {
    return { aberto: true, texto: 'Aberto agora', detalhe: 'fecha às ' + formatarHora(horarioDeHoje.fim) }
  }

  if (horarioDeHoje && horaAgora < horarioDeHoje.inicio) {
    return { aberto: false, texto: 'Fechado agora', detalhe: 'abre hoje às ' + formatarHora(horarioDeHoje.inicio) }
  }

  for (let dias = 1; dias <= 7; dias++) {
    const dia = (hoje + dias) % 7
    const horario = semana[dia]
    if (horario) {
      const quando = dias === 1 ? 'amanhã' : nomesDosDias[dia]
      return { aberto: false, texto: 'Fechado agora', detalhe: 'abre ' + quando + ' às ' + formatarHora(horario.inicio) }
    }
  }

  return { aberto: false, texto: 'Fechado', detalhe: 'sem horários cadastrados' }
}

function textoDoHorario(horario) {
  if (!horario) return 'Fechado'
  return formatarHora(horario.inicio) + ' às ' + formatarHora(horario.fim)
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
