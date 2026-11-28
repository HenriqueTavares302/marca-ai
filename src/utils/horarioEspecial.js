import { errosDosHorarios, juntarIntervalos } from './expediente.js'
import { diaDaSemana, somarDias } from './fuso.js'

export function intervalosDoProfissionalNaData(horariosDaSemana, especiais, profissionalId, data) {
  const doDia = especiais.filter((especial) => especial.profissional_id === profissionalId && especial.data === data)
  if (doDia.length > 0) return doDia
  const dia = diaDaSemana(data)
  return horariosDaSemana.filter((horario) => horario.profissional_id === profissionalId && horario.dia_semana === dia)
}

export function intervalosDoSalaoNaData(horariosDaSemana, especiais, profissionalIds, data) {
  return juntarIntervalos(
    profissionalIds.flatMap((id) => intervalosDoProfissionalNaData(horariosDaSemana, especiais, id, data)),
  )
}

export function diasEspeciaisDoSalao(horariosDaSemana, especiais, profissionalIds, de, quantidadeDeDias) {
  const ate = somarDias(de, quantidadeDeDias - 1)
  const datas = [...new Set(especiais.map((especial) => especial.data))]
    .filter((data) => data >= de && data <= ate)
    .sort()
  return datas.map((data) => ({ data, intervalos: intervalosDoSalaoNaData(horariosDaSemana, especiais, profissionalIds, data) }))
}

export const limiteDeDiasDoHorarioEspecial = 365

export function errosDoHorarioEspecial(formulario, hoje) {
  const doDia = errosDosHorarios([{ atende: true, intervalos: formulario.intervalos }])
  const erros = { data: '', geral: doDia.erros[0].geral, intervalos: doDia.erros[0].intervalos }
  if (formulario.intervalos.length === 0) erros.geral = 'Adicione pelo menos um intervalo.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formulario.data || '')) erros.data = 'Escolha o dia.'
  else if (formulario.data < hoje) erros.data = 'Escolha hoje ou um dia depois.'
  else if (formulario.data > somarDias(hoje, limiteDeDiasDoHorarioEspecial)) erros.data = 'Escolha um dia até 1 ano à frente.'
  return { erros, temErro: Boolean(erros.data) || doDia.temErro }
}

export function juntarLinhasPorData(linhas) {
  const porData = new Map()
  for (const linha of linhas) {
    if (!porData.has(linha.data)) porData.set(linha.data, [])
    porData.get(linha.data).push({ inicio: linha.inicio, fim: linha.fim })
  }
  return [...porData.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, intervalos]) => ({ data, intervalos: [...intervalos].sort((a, b) => a.inicio.localeCompare(b.inicio)) }))
}
