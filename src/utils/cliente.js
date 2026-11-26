export function apenasDigitosDoCelular(texto) {
  let digitos = String(texto).replace(/\D/g, '')
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2)
  if (digitos.length > 11 && digitos.startsWith('0')) digitos = digitos.slice(1)
  return digitos.slice(0, 11)
}

export function formatarCelular(texto) {
  const digitos = apenasDigitosDoCelular(texto)
  if (digitos.length === 0) return ''
  if (digitos.length <= 2) return '(' + digitos
  if (digitos.length <= 7) return '(' + digitos.slice(0, 2) + ') ' + digitos.slice(2)
  return '(' + digitos.slice(0, 2) + ') ' + digitos.slice(2, 7) + '-' + digitos.slice(7)
}

export function erroDoCelular(texto) {
  const digitos = apenasDigitosDoCelular(texto)
  if (digitos.length === 0) return 'Digite seu celular com DDD.'
  if (digitos.length < 11) return 'O celular precisa ter DDD e mais 9 números.'
  const ddd = Number(digitos.slice(0, 2))
  if (ddd < 11 || ddd > 99) return 'Confira o DDD: ele vai de 11 a 99.'
  if (digitos[2] !== '9') return 'O número de celular começa com 9 depois do DDD.'
  return ''
}

export function erroDoNome(texto) {
  const letras = String(texto).match(/\p{L}/gu) || []
  if (letras.length === 0) return 'Digite seu nome.'
  if (letras.length < 2) return 'O nome precisa ter pelo menos 2 letras.'
  return ''
}
