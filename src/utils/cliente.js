import { partesEmSaoPaulo } from './fuso.js'

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

export function semAcento(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function filtrarClientes(clientes, busca) {
  const texto = semAcento(busca).trim()
  if (texto.length === 0) return []
  const digitos = String(busca).replace(/\D/g, '')
  return clientes.filter((cliente) => {
    if (semAcento(cliente.nome).includes(texto)) return true
    return digitos.length >= 3 && String(cliente.telefone).includes(digitos)
  })
}

export const ordensDeClientes = [
  { valor: 'nome', rotulo: 'A–Z' },
  { valor: 'ultimo', rotulo: 'Último atendimento' },
  { valor: 'frequentes', rotulo: 'Mais frequentes' },
]

function diasDesde(data, hoje) {
  const [anoA, mesA, diaA] = data.split('-').map(Number)
  const [anoB, mesB, diaB] = hoje.split('-').map(Number)
  return Math.round((Date.UTC(anoB, mesB - 1, diaB) - Date.UTC(anoA, mesA - 1, diaA)) / 86400000)
}

export function textoDoUltimoAtendimento(inicio, hoje) {
  if (!inicio) return 'Nenhum atendimento ainda'
  const dias = diasDesde(partesEmSaoPaulo(inicio).data, hoje)
  if (dias <= 0) return 'Último atendimento hoje'
  if (dias === 1) return 'Último atendimento ontem'
  return 'Último atendimento há ' + dias + ' dias'
}

export function textoDaQuantidadeDeAtendimentos(quantidade) {
  return quantidade === 1 ? '1 atendimento' : quantidade + ' atendimentos'
}

function porNome(a, b) {
  return a.nome.localeCompare(b.nome, 'pt-BR')
}

export function ordenarClientes(clientes, ordem) {
  const copia = [...clientes]
  if (ordem === 'ultimo') {
    return copia.sort((a, b) => {
      if (a.ultimo_atendimento && b.ultimo_atendimento) {
        return new Date(b.ultimo_atendimento) - new Date(a.ultimo_atendimento) || porNome(a, b)
      }
      if (a.ultimo_atendimento) return -1
      if (b.ultimo_atendimento) return 1
      return porNome(a, b)
    })
  }
  if (ordem === 'frequentes') return copia.sort((a, b) => b.atendimentos - a.atendimentos || porNome(a, b))
  return copia.sort(porNome)
}
