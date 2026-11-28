import { supabase } from '../lib/supabase.js'

const chave = 'marca-ai:sessao'
const papeis = ['dono', 'profissional']

export function erroDoEmail(texto) {
  const email = String(texto).trim()
  if (email.length === 0) return 'Digite seu e-mail.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Confira o e-mail: ele precisa ter @ e um domínio, como nome@exemplo.com.'
  return ''
}

export function erroDaSenha(texto) {
  if (String(texto).length === 0) return 'Digite sua senha.'
  if (String(texto).length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  return ''
}

export function erroDaConfirmacao(senha, confirmacao) {
  if (String(confirmacao).length === 0) return 'Digite a senha de novo.'
  if (senha !== confirmacao) return 'As duas senhas não são iguais.'
  return ''
}

function lerCopia() {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave))
    if (!salvo || !Number.isInteger(salvo.profissionalId) || !papeis.includes(salvo.papel)) return null
    return salvo
  } catch {
    return null
  }
}

function guardarCopia(perfil) {
  try {
    localStorage.setItem(chave, JSON.stringify(perfil))
  } catch {
    return
  }
}

function apagarCopia() {
  try {
    localStorage.removeItem(chave)
  } catch {
    return
  }
}

export function profissionalLogado() {
  const copia = lerCopia()
  return copia ? copia.profissionalId : null
}

export function papelLogado() {
  const copia = lerCopia()
  return copia ? copia.papel : null
}

async function buscarPerfil(userId) {
  try {
    const { data, error, status } = await supabase
      .from('profissionais')
      .select('id, nome, papel, ativo')
      .eq('user_id', userId)
      .maybeSingle()
    if (status === 401 || status === 403) return { erro: 'sem_acesso' }
    if (error) return { erro: 'sem_conexao' }
    if (!data || !data.ativo || !papeis.includes(data.papel)) return { erro: 'sem_acesso' }
    return { perfil: { profissionalId: data.id, nome: data.nome, papel: data.papel } }
  } catch {
    return { erro: 'sem_conexao' }
  }
}

async function encerrarNoSupabase() {
  try {
    await supabase.auth.signOut()
  } catch {
    return
  }
}

function erroDoLogin(error) {
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'muitas_tentativas'
  if (error.code === 'invalid_credentials' || error.code === 'email_not_confirmed' || error.status === 400) return 'credenciais'
  return 'sem_conexao'
}

export async function entrar(email, senha) {
  if (erroDoEmail(email) || erroDaSenha(senha)) return { erro: 'dados_invalidos' }
  if (!supabase) return { erro: 'sem_configuracao' }

  let resposta
  try {
    resposta = await supabase.auth.signInWithPassword({ email: String(email).trim(), password: senha })
  } catch {
    return { erro: 'sem_conexao' }
  }
  if (resposta.error || !resposta.data.user) return { erro: resposta.error ? erroDoLogin(resposta.error) : 'sem_conexao' }

  const resultado = await buscarPerfil(resposta.data.user.id)
  if (resultado.erro) {
    await encerrarNoSupabase()
    apagarCopia()
    return { erro: resultado.erro }
  }
  guardarCopia(resultado.perfil)
  return { profissionalId: resultado.perfil.profissionalId }
}

export async function conferirSessao() {
  if (!supabase) {
    apagarCopia()
    return null
  }

  let sessao = null
  try {
    const { data } = await supabase.auth.getSession()
    sessao = data.session
  } catch {
    return lerCopia()
  }
  if (!sessao) {
    apagarCopia()
    return null
  }

  const resultado = await buscarPerfil(sessao.user.id)
  if (resultado.erro === 'sem_conexao') return lerCopia()
  if (resultado.erro) {
    await encerrarNoSupabase()
    apagarCopia()
    return null
  }
  guardarCopia(resultado.perfil)
  return resultado.perfil
}

export function aoSairDaConta(funcao) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') {
      apagarCopia()
      funcao()
    }
  })
  return () => data.subscription.unsubscribe()
}

export async function sair() {
  apagarCopia()
  if (supabase) await encerrarNoSupabase()
}

export async function pedirLinkDeSenha(email) {
  if (erroDoEmail(email)) return { erro: 'dados_invalidos' }
  if (!supabase) return { erro: 'sem_configuracao' }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
      redirectTo: window.location.origin + '/salao/nova-senha',
    })
    if (error && (error.status === 429 || error.code === 'over_email_send_rate_limit')) return { erro: 'muitas_tentativas' }
    if (error && error.status !== 400 && error.status !== 404) return { erro: 'sem_conexao' }
  } catch {
    return { erro: 'sem_conexao' }
  }
  return {}
}

const verificacoes = new Map()

function verificarCodigoDoLink(tokenHash, tipo) {
  if (!verificacoes.has(tokenHash)) {
    verificacoes.set(tokenHash, supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo }))
  }
  return verificacoes.get(tokenHash)
}

export async function temSessaoParaNovaSenha() {
  if (!supabase) return false
  if (/error/.test(window.location.hash) || /error/.test(window.location.search)) return false
  const busca = new URLSearchParams(window.location.search)
  const tokenHash = busca.get('token_hash')
  const tipo = busca.get('type')
  if (tokenHash) {
    if (tipo !== 'invite' && tipo !== 'recovery') return false
    try {
      const { error } = await verificarCodigoDoLink(tokenHash, tipo)
      window.history.replaceState(window.history.state, '', window.location.pathname)
      if (error) return false
    } catch {
      return false
    }
  }
  try {
    const { data } = await supabase.auth.getSession()
    return Boolean(data.session)
  } catch {
    return false
  }
}

export async function definirNovaSenha(senha) {
  if (erroDaSenha(senha)) return { erro: 'dados_invalidos' }
  if (!supabase) return { erro: 'sem_configuracao' }

  let resposta
  try {
    resposta = await supabase.auth.updateUser({ password: senha })
  } catch {
    return { erro: 'sem_conexao' }
  }
  if (resposta.error) {
    if (resposta.error.code === 'same_password') return { erro: 'senha_igual' }
    if (resposta.error.code === 'weak_password') return { erro: 'senha_fraca' }
    if (resposta.error.status === 401 || resposta.error.code === 'session_not_found') return { erro: 'link_vencido' }
    return { erro: 'sem_conexao' }
  }

  const resultado = await buscarPerfil(resposta.data.user.id)
  if (resultado.erro) {
    await encerrarNoSupabase()
    apagarCopia()
    return { erro: resultado.erro }
  }
  guardarCopia(resultado.perfil)
  return { profissionalId: resultado.perfil.profissionalId }
}

export function caminhoDeVoltaSeguro(caminho) {
  const valido =
    typeof caminho === 'string' &&
    (caminho === '/salao' || caminho.startsWith('/salao/')) &&
    !caminho.startsWith('/salao/entrar') &&
    !caminho.startsWith('/salao/esqueci-senha') &&
    !caminho.startsWith('/salao/nova-senha') &&
    !caminho.includes('//')
  return valido ? caminho : '/salao'
}

export function mostrarEscolhaDeProfissional(papel, quantidadeDeAtivos) {
  return papel === 'dono' && quantidadeDeAtivos > 1
}
