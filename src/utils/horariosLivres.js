import { diaDaSemana, instanteEmSaoPaulo } from './fuso.js'

export function minutosDaHora(hora) {
  const [horas, minutos] = hora.split(':').map(Number)
  return horas * 60 + minutos
}

export function formatarMinutos(minutos) {
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return String(horas).padStart(2, '0') + ':' + String(resto).padStart(2, '0')
}

function seSobrepoe(inicioA, fimA, inicioB, fimB) {
  return inicioA < fimB && inicioB < fimA
}

export function horariosLivresDoProfissional({
  data,
  duracao,
  profissionalId,
  horariosTrabalho,
  bloqueios,
  agendamentos,
  agora,
  intervalo,
  antecedencia,
}) {
  const dia = diaDaSemana(data)
  const primeiroInicioPermitido = agora + antecedencia * 60000

  const ocupados = [
    ...bloqueios.filter((bloqueio) => bloqueio.profissional_id === profissionalId),
    ...agendamentos.filter(
      (agendamento) => agendamento.profissional_id === profissionalId && agendamento.status !== 'cancelado',
    ),
  ].map((item) => ({ inicio: new Date(item.inicio).getTime(), fim: new Date(item.fim).getTime() }))

  const turnos = horariosTrabalho.filter(
    (horario) => horario.profissional_id === profissionalId && horario.dia_semana === dia,
  )

  const livres = []
  for (const turno of turnos) {
    const abre = minutosDaHora(turno.inicio)
    const fecha = minutosDaHora(turno.fim)

    for (let comeco = abre; comeco + duracao <= fecha; comeco += intervalo) {
      const inicio = instanteEmSaoPaulo(data, comeco)
      const fim = inicio + duracao * 60000
      if (inicio < primeiroInicioPermitido) continue
      if (ocupados.some((ocupado) => seSobrepoe(inicio, fim, ocupado.inicio, ocupado.fim))) continue
      livres.push(comeco)
    }
  }

  return livres
}

export function calcularHorariosLivres({ profissionalIds, ...regras }) {
  const primeiroLivrePorHorario = new Map()

  for (const profissionalId of profissionalIds) {
    const livres = horariosLivresDoProfissional({ ...regras, profissionalId })
    for (const minutos of livres) {
      if (!primeiroLivrePorHorario.has(minutos)) {
        primeiroLivrePorHorario.set(minutos, profissionalId)
      }
    }
  }

  return [...primeiroLivrePorHorario.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([minutos, profissionalId]) => ({ minutos, hora: formatarMinutos(minutos), profissionalId }))
}
