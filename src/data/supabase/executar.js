import { supabase } from '../../lib/supabase.js'
import { sair } from '../../utils/sessao.js'
import { traduzirErro } from './erros.js'

export async function executar(pedido) {
  if (!supabase) return { erro: 'sem_configuracao' }
  try {
    const resposta = await pedido(supabase)
    if (resposta.error) {
      const erro = traduzirErro(resposta)
      if (erro === 'sessao_vencida') await sair()
      return { erro }
    }
    return { dados: resposta.data }
  } catch (problema) {
    return { erro: traduzirErro(problema) }
  }
}
