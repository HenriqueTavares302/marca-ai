export function dataRelativa(dias, hora, minuto = 0) {
  const data = new Date()
  data.setDate(data.getDate() + dias)
  data.setHours(hora, minuto, 0, 0)
  return data.toISOString()
}

export function diasDeTrabalhoAtras(quantidade) {
  let dias = 0
  let encontrados = 0
  while (encontrados < quantidade) {
    dias--
    const diaDaSemana = new Date(dataRelativa(dias, 12)).getDay()
    if (diaDaSemana >= 2 && diaDaSemana <= 6) encontrados++
  }
  return dias
}

export function mesmoDia(dataIso, outraData) {
  const data = new Date(dataIso)
  return (
    data.getFullYear() === outraData.getFullYear() &&
    data.getMonth() === outraData.getMonth() &&
    data.getDate() === outraData.getDate()
  )
}
