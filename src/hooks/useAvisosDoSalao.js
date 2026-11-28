import { useEffect, useRef } from 'react'
import { ouvirAvisosDoSalao } from '../data/consultas.js'
import { criarAgrupador } from '../utils/agrupador.js'

const tiposQueMudamAEquipe = ['equipe', 'reconectou', 'voltou']

export function mudouAEquipe(tipos) {
  return tipos.some((tipo) => tiposQueMudamAEquipe.includes(tipo))
}

export function useAvisosDoSalao(aoMudar) {
  const ultimo = useRef(aoMudar)

  useEffect(() => {
    ultimo.current = aoMudar
  })

  useEffect(() => {
    const agrupador = criarAgrupador((tipos) => ultimo.current(tipos))
    const parar = ouvirAvisosDoSalao((tipo) => agrupador.avisar(tipo))
    return () => {
      parar()
      agrupador.parar()
    }
  }, [])
}
