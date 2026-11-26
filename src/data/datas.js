import { diaDaSemana, hojeEmSaoPaulo, instanteEmSaoPaulo, partesEmSaoPaulo, somarDias } from '../utils/fuso.js'

export function dataRelativa(dias, hora, minuto = 0) {
  const data = somarDias(hojeEmSaoPaulo(), dias)
  return new Date(instanteEmSaoPaulo(data, hora * 60 + minuto)).toISOString()
}

export function diaDaSemanaRelativo(dias) {
  return diaDaSemana(somarDias(hojeEmSaoPaulo(), dias))
}

export function diasDeTrabalhoAtras(quantidade) {
  let dias = 0
  let encontrados = 0
  while (encontrados < quantidade) {
    dias--
    const dia = diaDaSemanaRelativo(dias)
    if (dia >= 2 && dia <= 6) encontrados++
  }
  return dias
}

export function mesmoDia(dataIso, outraData) {
  return partesEmSaoPaulo(dataIso).data === partesEmSaoPaulo(outraData).data
}
