import { dataRelativa } from './datas.js'

function criarBloqueios() {
  const lista = []

  for (let dias = -7; dias <= 14; dias++) {
    const diaDaSemana = new Date(dataRelativa(dias, 12)).getDay()
    const trabalhaODiaTodo = diaDaSemana >= 2 && diaDaSemana <= 6
    if (!trabalhaODiaTodo) continue

    for (const profissionalId of [1, 2]) {
      lista.push({
        id: lista.length + 1,
        profissional_id: profissionalId,
        inicio: dataRelativa(dias, 12),
        fim: dataRelativa(dias, 13),
        motivo: 'Almoço',
      })
    }
  }

  lista.push({
    id: lista.length + 1,
    profissional_id: 2,
    inicio: dataRelativa(2, 9),
    fim: dataRelativa(2, 19),
    motivo: 'Folga',
  })

  return lista
}

export const bloqueios = criarBloqueios()
