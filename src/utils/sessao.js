const chave = 'marca-ai:sessao'
const profissionalDoModoDeTeste = 1

export function erroDoEmail(texto) {
  const email = String(texto).trim()
  if (email.length === 0) return 'Digite seu e-mail.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Confira o e-mail: ele precisa ter @ e um domínio, como nome@exemplo.com.'
  return ''
}

export function erroDaSenha(texto) {
  if (String(texto).length === 0) return 'Digite sua senha.'
  if (String(texto).length < 6) return 'A senha precisa ter pelo menos 6 caracteres.'
  return ''
}

export function profissionalLogado() {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave))
    return salvo && Number.isInteger(salvo.profissionalId) ? salvo.profissionalId : null
  } catch {
    return null
  }
}

export async function entrar(email, senha) {
  if (erroDoEmail(email) || erroDaSenha(senha)) {
    return { erro: 'dados_invalidos' }
  }
  try {
    localStorage.setItem(chave, JSON.stringify({ profissionalId: profissionalDoModoDeTeste }))
  } catch {
    return { erro: 'nao_salvou' }
  }
  return { profissionalId: profissionalDoModoDeTeste }
}

export function sair() {
  try {
    localStorage.removeItem(chave)
  } catch {
    return
  }
}

export function caminhoDeVoltaSeguro(caminho) {
  const valido =
    typeof caminho === 'string' &&
    (caminho === '/salao' || caminho.startsWith('/salao/')) &&
    !caminho.startsWith('/salao/entrar') &&
    !caminho.includes('//')
  return valido ? caminho : '/salao'
}
