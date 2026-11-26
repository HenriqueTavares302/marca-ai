import { dataRelativa, diaDaSemanaRelativo } from './datas.js'

function criarBloqueios() {
  let diaDaFolga = 2
  while (diaDaSemanaRelativo(diaDaFolga) < 2) diaDaFolga++

  return [
    {
      id: 1,
      profissional_id: 2,
      inicio: dataRelativa(diaDaFolga, 0),
      fim: dataRelativa(diaDaFolga + 1, 0),
      motivo: 'Folga',
    },
  ]
}

export const bloqueios = criarBloqueios()
