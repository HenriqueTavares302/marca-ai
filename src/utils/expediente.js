import { formatarDataCurta } from './formatos.js'
import { instanteEmSaoPaulo, partesEmSaoPaulo, somarDias } from './fuso.js'
import { minutosDaHora } from './horariosLivres.js'

export const nomesDosDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const ordemDaSemana = [1, 2, 3, 4, 5, 6, 0]
export const limiteDeIntervalos = 4

const formatoDaHora = /^\d{2}:\d{2}$/

export function diasDoProfissional(horarios, profissionalId) {
  return [0, 1, 2, 3, 4, 5, 6].map((dia) => {
    const intervalos = horarios
      .filter((horario) => horario.profissional_id === profissionalId && horario.dia_semana === dia)
      .map((horario) => ({ inicio: horario.inicio.slice(0, 5), fim: horario.fim.slice(0, 5) }))
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
    return { atende: intervalos.length > 0, intervalos }
  })
}

export function horariosDosDias(dias, profissionalId) {
  const linhas = []
  dias.forEach((dia, diaSemana) => {
    if (!dia.atende) return
    const ordenados = [...dia.intervalos].sort((a, b) => a.inicio.localeCompare(b.inicio))
    for (const intervalo of ordenados) {
      linhas.push({
        profissional_id: profissionalId,
        dia_semana: diaSemana,
        inicio: intervalo.inicio + ':00',
        fim: intervalo.fim + ':00',
      })
    }
  })
  return linhas
}

export function errosDosHorarios(dias) {
  let temErro = false
  const erros = dias.map((dia) => {
    const erroDoDia = { geral: '', intervalos: dia.intervalos.map(() => ({})) }
    if (!dia.atende) return erroDoDia

    if (dia.intervalos.length === 0) {
      erroDoDia.geral = 'Adicione um intervalo ou marque Não atende.'
      temErro = true
    }
    if (dia.intervalos.length > limiteDeIntervalos) {
      erroDoDia.geral = 'Use no máximo ' + limiteDeIntervalos + ' intervalos por dia.'
      temErro = true
    }

    dia.intervalos.forEach((intervalo, indice) => {
      const erro = erroDoDia.intervalos[indice]
      if (!formatoDaHora.test(intervalo.inicio)) erro.inicio = 'Escolha o início.'
      if (!formatoDaHora.test(intervalo.fim)) erro.fim = 'Escolha o fim.'
      if (!erro.inicio && !erro.fim && intervalo.fim <= intervalo.inicio) erro.fim = 'O fim precisa ser depois do início.'
      if (!erro.inicio && !erro.fim) {
        const bateCom = dia.intervalos.findIndex(
          (outro, outroIndice) =>
            outroIndice !== indice &&
            formatoDaHora.test(outro.inicio) &&
            formatoDaHora.test(outro.fim) &&
            outro.fim > outro.inicio &&
            (outro.inicio < intervalo.inicio || (outro.inicio === intervalo.inicio && outroIndice < indice)) &&
            intervalo.inicio < outro.fim,
        )
        if (bateCom >= 0) erro.inicio = 'Bate com o intervalo ' + (bateCom + 1) + ' do mesmo dia.'
      }
      if (Object.keys(erro).length > 0) temErro = true
    })

    return erroDoDia
  })

  return { erros, temErro }
}

export function juntarIntervalos(intervalos) {
  const ordenados = [...intervalos].sort((a, b) => a.inicio.localeCompare(b.inicio))
  const juntos = []
  for (const intervalo of ordenados) {
    const ultimo = juntos[juntos.length - 1]
    if (ultimo && intervalo.inicio <= ultimo.fim) {
      if (intervalo.fim > ultimo.fim) ultimo.fim = intervalo.fim
    } else {
      juntos.push({ inicio: intervalo.inicio, fim: intervalo.fim })
    }
  }
  return juntos
}

export function cabeNoExpediente(turnosDoDia, minutos, duracao) {
  return turnosDoDia.some(
    (turno) => minutosDaHora(turno.inicio) <= minutos && minutos + duracao <= minutosDaHora(turno.fim),
  )
}

export function agendamentosForaDoHorario(agendamentos, horarios, profissionalId, agora) {
  return agendamentos.filter((agendamento) => {
    if (agendamento.profissional_id !== profissionalId) return false
    if (agendamento.status !== 'agendado') return false
    if (new Date(agendamento.inicio).getTime() <= agora) return false
    const partes = partesEmSaoPaulo(agendamento.inicio)
    const duracao = (new Date(agendamento.fim).getTime() - new Date(agendamento.inicio).getTime()) / 60000
    const turnos = horarios.filter(
      (horario) => horario.profissional_id === profissionalId && horario.dia_semana === partes.diaSemana,
    )
    return !cabeNoExpediente(turnos, partes.minutosDoDia, duracao)
  })
}

export const motivosDeBloqueio = ['Folga', 'Férias', 'Compromisso', 'Outro']
export const limiteDeDiasDoBloqueio = 90

const formatoDaData = /^\d{4}-\d{2}-\d{2}$/

export function diasEntre(dataInicio, dataFim) {
  let quantidade = 1
  let atual = dataInicio
  while (atual < dataFim && quantidade <= 400) {
    atual = somarDias(atual, 1)
    quantidade++
  }
  return quantidade
}

export function periodoDoBloqueio(formulario) {
  if (formulario.tipo === 'dia') {
    return {
      inicio: instanteEmSaoPaulo(formulario.dataInicio, 0),
      fim: instanteEmSaoPaulo(somarDias(formulario.dataFim, 1), 0),
    }
  }
  return {
    inicio: instanteEmSaoPaulo(formulario.dataInicio, minutosDaHora(formulario.horaInicio)),
    fim: instanteEmSaoPaulo(formulario.dataFim, minutosDaHora(formulario.horaFim)),
  }
}

export function motivoDoBloqueio(formulario) {
  return formulario.motivo === 'Outro' ? formulario.outroMotivo.trim() : formulario.motivo
}

export function errosDoBloqueio(formulario, agora) {
  const erros = {}
  if (!formatoDaData.test(formulario.dataInicio)) erros.dataInicio = 'Escolha a data de início.'
  if (!formatoDaData.test(formulario.dataFim)) erros.dataFim = 'Escolha a data de fim.'
  else if (!erros.dataInicio && formulario.dataFim < formulario.dataInicio) {
    erros.dataFim = 'A data de fim precisa ser igual ou depois do início.'
  } else if (!erros.dataInicio && diasEntre(formulario.dataInicio, formulario.dataFim) > limiteDeDiasDoBloqueio) {
    erros.dataFim = 'Use no máximo ' + limiteDeDiasDoBloqueio + ' dias por bloqueio.'
  }

  if (formulario.tipo === 'periodo') {
    if (!formatoDaHora.test(formulario.horaInicio)) erros.horaInicio = 'Escolha a hora de início.'
    if (!formatoDaHora.test(formulario.horaFim)) erros.horaFim = 'Escolha a hora de fim.'
  }

  if (formulario.motivo === 'Outro') {
    const motivo = formulario.outroMotivo.trim()
    if (motivo.length < 2) erros.motivo = 'Escreva o motivo.'
    else if (motivo.length > 40) erros.motivo = 'Use no máximo 40 caracteres.'
  }

  if (Object.keys(erros).length === 0) {
    const periodo = periodoDoBloqueio(formulario)
    if (periodo.fim <= periodo.inicio) erros.horaFim = 'O fim precisa ser depois do início.'
    else if (periodo.fim <= agora) erros.dataInicio = 'Esse período já passou.'
  }

  return erros
}

export function descreverBloqueio(bloqueio) {
  const inicio = partesEmSaoPaulo(bloqueio.inicio)
  const fim = partesEmSaoPaulo(bloqueio.fim)
  if (inicio.minutosDoDia === 0 && fim.minutosDoDia === 0) {
    const ultimoDia = somarDias(fim.data, -1)
    const quantidade = diasEntre(inicio.data, ultimoDia)
    return {
      datas: inicio.data === ultimoDia ? formatarDataCurta(inicio.data) : formatarDataCurta(inicio.data) + ' a ' + formatarDataCurta(ultimoDia),
      horario: quantidade === 1 ? 'Dia inteiro' : 'Dia inteiro · ' + quantidade + ' dias',
    }
  }
  if (inicio.data === fim.data) {
    return { datas: formatarDataCurta(inicio.data), horario: inicio.hora + ' às ' + fim.hora }
  }
  return {
    datas: formatarDataCurta(inicio.data) + ', ' + inicio.hora + ' a ' + formatarDataCurta(fim.data) + ', ' + fim.hora,
    horario: 'Período',
  }
}
