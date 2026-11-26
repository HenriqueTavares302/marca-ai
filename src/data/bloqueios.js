import { dataRelativa, diaDaSemanaRelativo } from './datas.js'

function trabalhaODiaTodo(dias) {
  const dia = diaDaSemanaRelativo(dias)
  return dia >= 2 && dia <= 6
}

function criarBloqueios() {
  const lista = []

  for (let dias = -7; dias <= 21; dias++) {
    if (!trabalhaODiaTodo(dias)) continue

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

  let diaDaFolga = 2
  while (!trabalhaODiaTodo(diaDaFolga)) diaDaFolga++

  lista.push({
    id: lista.length + 1,
    profissional_id: 2,
    inicio: dataRelativa(diaDaFolga, 9),
    fim: dataRelativa(diaDaFolga, 19),
    motivo: 'Folga',
  })

  return lista
}

export const bloqueios = criarBloqueios()
