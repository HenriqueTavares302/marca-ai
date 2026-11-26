import { formatarPreco } from './formatos.js'
import { partesEmSaoPaulo } from './fuso.js'
import { minutosDaHora } from './horariosLivres.js'

const ordemDosTipos = { bloqueio: 0, intervalo: 0, atendimento: 1, livre: 2 }

function minutosNoDia(dataIso, data) {
  const partes = partesEmSaoPaulo(dataIso)
  if (partes.data < data) return 0
  if (partes.data > data) return 24 * 60
  return partes.minutosDoDia
}

export function montarLinhaDoTempo({ data, agendamentos, bloqueios, turnos, profissionais, intervaloMinimo }) {
  const itens = []

  for (const agendamento of agendamentos) {
    itens.push({
      tipo: 'atendimento',
      chave: 'atendimento-' + agendamento.id,
      inicio: minutosNoDia(agendamento.inicio, data),
      fim: minutosNoDia(agendamento.fim, data),
      profissionalId: agendamento.profissional_id,
      agendamento,
    })
  }

  for (const bloqueio of bloqueios) {
    itens.push({
      tipo: 'bloqueio',
      chave: 'bloqueio-' + bloqueio.id,
      inicio: minutosNoDia(bloqueio.inicio, data),
      fim: minutosNoDia(bloqueio.fim, data),
      profissionalId: bloqueio.profissional_id,
      motivo: bloqueio.motivo || 'Bloqueado',
      diaInteiro: minutosNoDia(bloqueio.inicio, data) === 0 && minutosNoDia(bloqueio.fim, data) === 24 * 60,
    })
  }

  for (const profissional of profissionais) {
    const turnosDoProfissional = turnos
      .filter((turno) => turno.profissional_id === profissional.id)
      .sort((a, b) => minutosDaHora(a.inicio) - minutosDaHora(b.inicio))
    for (let indice = 1; indice < turnosDoProfissional.length; indice++) {
      const inicio = minutosDaHora(turnosDoProfissional[indice - 1].fim)
      const fim = minutosDaHora(turnosDoProfissional[indice].inicio)
      if (fim <= inicio) continue
      const coberto = bloqueios.some(
        (bloqueio) =>
          bloqueio.profissional_id === profissional.id &&
          minutosNoDia(bloqueio.inicio, data) <= inicio &&
          minutosNoDia(bloqueio.fim, data) >= fim,
      )
      if (coberto) continue
      itens.push({
        tipo: 'intervalo',
        chave: 'intervalo-' + profissional.id + '-' + inicio,
        inicio,
        fim,
        profissionalId: profissional.id,
        motivo: 'Intervalo',
      })
    }
  }

  for (const profissional of profissionais) {
    const ocupados = [
      ...agendamentos.filter(
        (agendamento) => agendamento.profissional_id === profissional.id && agendamento.status !== 'cancelado',
      ),
      ...bloqueios.filter((bloqueio) => bloqueio.profissional_id === profissional.id),
    ]
      .map((item) => ({ inicio: minutosNoDia(item.inicio, data), fim: minutosNoDia(item.fim, data) }))
      .sort((a, b) => a.inicio - b.inicio)

    for (const turno of turnos.filter((item) => item.profissional_id === profissional.id)) {
      const fimDoTurno = minutosDaHora(turno.fim)
      let cursor = minutosDaHora(turno.inicio)

      for (const ocupado of ocupados) {
        if (ocupado.fim <= cursor) continue
        if (ocupado.inicio >= fimDoTurno) break
        if (ocupado.inicio - cursor >= intervaloMinimo) {
          itens.push({
            tipo: 'livre',
            chave: 'livre-' + profissional.id + '-' + cursor,
            inicio: cursor,
            fim: ocupado.inicio,
            profissionalId: profissional.id,
          })
        }
        cursor = Math.max(cursor, ocupado.fim)
      }

      if (fimDoTurno - cursor >= intervaloMinimo) {
        itens.push({
          tipo: 'livre',
          chave: 'livre-' + profissional.id + '-' + cursor,
          inicio: cursor,
          fim: fimDoTurno,
          profissionalId: profissional.id,
        })
      }
    }
  }

  return itens.sort(
    (a, b) => a.inicio - b.inicio || ordemDosTipos[a.tipo] - ordemDosTipos[b.tipo] || a.profissionalId - b.profissionalId,
  )
}

export function tipoDoPrecoGuardado(item) {
  if (item.preco === null) return 'consulta'
  return item.servico && item.servico.tipo_preco === 'a_partir' ? 'a_partir' : 'fixo'
}

export function valorDoAgendamento(agendamento) {
  if (agendamento.status === 'concluido' && agendamento.valor_total !== null && agendamento.valor_total !== undefined) {
    return { total: agendamento.valor_total, temValor: true, aPartir: false, aCombinar: false }
  }
  let total = 0
  let temValor = false
  let aPartir = false
  let aCombinar = false

  for (const item of agendamento.servicos) {
    if (item.preco === null) {
      aCombinar = true
      continue
    }
    total += item.preco
    temValor = true
    if (item.servico && item.servico.tipo_preco === 'a_partir') aPartir = true
  }

  return { total, temValor, aPartir, aCombinar }
}

export function textoDoValor({ total, temValor, aPartir, aCombinar }) {
  if (!temValor) return aCombinar ? 'a combinar' : formatarPreco(0)
  const valor = (aPartir ? 'a partir de ' : '') + formatarPreco(total)
  return aCombinar ? valor + ' + a combinar' : valor
}

export function resumirDia(agendamentos) {
  const ativos = agendamentos.filter((agendamento) => agendamento.status !== 'cancelado')
  const soma = { total: 0, temValor: false, aPartir: false, aCombinar: false }

  for (const agendamento of ativos) {
    const valor = valorDoAgendamento(agendamento)
    soma.total += valor.total
    soma.temValor = soma.temValor || valor.temValor
    soma.aPartir = soma.aPartir || valor.aPartir
    soma.aCombinar = soma.aCombinar || valor.aCombinar
  }

  return {
    atendimentos: ativos.length,
    concluidos: ativos.filter((agendamento) => agendamento.status === 'concluido').length,
    faltas: ativos.filter((agendamento) => agendamento.status === 'faltou').length,
    valor: textoDoValor(soma),
    temAgendamento: ativos.length > 0,
  }
}
