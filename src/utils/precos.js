import { formatarPreco } from './formatos.js'

function tabela(fonte) {
  return fonte && fonte.precos_por_profissional ? fonte.precos_por_profissional : {}
}

export function precoComProfissional(servico, variacao, profissionalId) {
  if (servico.tipo_preco === 'consulta') return null
  const fonte = variacao || servico
  const proprios = tabela(fonte)
  if (profissionalId && proprios[profissionalId] !== undefined && proprios[profissionalId] !== null) {
    return proprios[profissionalId]
  }
  return fonte.preco
}

export function faixaDoPreco(servico, variacao) {
  const fontes = variacao ? [variacao] : servico.variacoes && servico.variacoes.length > 0 ? servico.variacoes : [null]
  const ids = servico.profissional_ids && servico.profissional_ids.length > 0 ? servico.profissional_ids : [null]
  const precos = []
  for (const fonte of fontes) {
    for (const id of ids) {
      const preco = precoComProfissional(servico, fonte, id)
      if (preco !== null && preco !== undefined) precos.push(preco)
    }
  }
  if (precos.length === 0) return { menor: null, maior: null }
  return { menor: Math.min(...precos), maior: Math.max(...precos) }
}

export function precoParaMostrar(servico, variacao = null, profissionalId = null) {
  if (servico.tipo_preco === 'consulta') return { tipoPreco: 'consulta', preco: null }
  if (profissionalId) {
    return { tipoPreco: servico.tipo_preco, preco: precoComProfissional(servico, variacao, profissionalId) }
  }
  const faixa = faixaDoPreco(servico, variacao)
  const variaPorProfissional = faixa.menor !== faixa.maior
  return {
    tipoPreco: variaPorProfissional ? 'a_partir' : servico.tipo_preco,
    preco: faixa.menor,
  }
}

export function textoDoPrecoParaMostrar(servico, variacao = null, profissionalId = null) {
  const mostrar = precoParaMostrar(servico, variacao, profissionalId)
  if (mostrar.tipoPreco === 'consulta' || mostrar.preco === null) return 'Sob consulta'
  return (mostrar.tipoPreco === 'a_partir' ? 'a partir de ' : '') + formatarPreco(mostrar.preco)
}
