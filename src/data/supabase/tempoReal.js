import { supabase } from '../../lib/supabase.js'
import { assinarCanalDoSalao } from './canalDoSalao.js'
import { quemSouEu } from './salao.js'
import { limparCacheDaVitrine } from './vitrine.js'

export function ouvirAvisosDoSalao(aoAvisar) {
  let parar = null
  let parado = false

  async function comecar() {
    try {
      const eu = await quemSouEu()
      await supabase.realtime.setAuth()
      if (parado) return
      parar = assinarCanalDoSalao({
        cliente: supabase,
        salaoId: eu.salao_id,
        aoAvisar: (tipo) => {
          limparCacheDaVitrine()
          aoAvisar(tipo)
        },
        documento: document,
      })
    } catch {
      parar = null
    }
  }

  comecar()

  return () => {
    parado = true
    if (parar) parar()
  }
}
