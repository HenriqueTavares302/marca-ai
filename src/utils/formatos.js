const formatoDeMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarPreco(valor) {
  return formatoDeMoeda.format(valor)
}

export function formatarPrecoDoServico(servico) {
  if (servico.tipo_preco === 'consulta' || servico.preco === null) return 'Sob consulta'
  if (servico.tipo_preco === 'a_partir') return 'a partir de ' + formatarPreco(servico.preco)
  return formatarPreco(servico.preco)
}

export function formatarDuracao(minutos) {
  if (minutos < 60) return minutos + ' min'
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? horas + 'h' : horas + 'h' + String(resto).padStart(2, '0')
}

export function linkDoMapa(endereco) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(endereco)
}

export function linkDoWhatsapp(numero, mensagem) {
  return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem)
}
