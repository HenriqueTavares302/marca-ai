import { slugDoSalao } from '../../lib/salao.js'
import { executar } from './executar.js'
import { traduzirVitrine } from './traducoes.js'

const validadeEmMs = 60000
let guardada = null

export async function buscarVitrine() {
  if (guardada && Date.now() - guardada.em < validadeEmMs) return { dados: guardada.vitrine }

  const slug = slugDoSalao()
  if (!slug) return { erro: 'sem_configuracao' }

  const resultado = await executar((cliente) => cliente.rpc('vitrine', { p_slug: slug }))
  if (resultado.erro) return resultado

  const vitrine = traduzirVitrine(resultado.dados)
  if (!vitrine) return { erro: 'erro_inesperado' }
  guardada = { vitrine, em: Date.now() }
  return { dados: vitrine }
}

export function limparCacheDaVitrine() {
  guardada = null
}
