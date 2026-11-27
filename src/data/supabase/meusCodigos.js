const chave = 'marca-ai:meus-codigos'
const chaveDaLimpeza = 'marca-ai:dados-de-exemplo-limpos'
const chaveDoAviso = 'marca-ai:aviso-horarios-de-teste'
const chavesDeExemplo = ['marca-ai:meus-agendamentos', 'marca-ai:ultimo-agendamento', 'marca-ai:banco-local']
const limite = 50
const formatoDoCodigo = /^[0-9a-f]{64}$/
const trintaDiasEmMs = 30 * 24 * 60 * 60 * 1000

function valido(item) {
  return item && Number.isInteger(item.id) && item.id > 0 && formatoDoCodigo.test(String(item.codigo))
}

function gravar(lista) {
  try {
    localStorage.setItem(chave, JSON.stringify(lista.map((item) => ({ id: item.id, codigo: item.codigo }))))
    return true
  } catch {
    return false
  }
}

export function lerMeusCodigos() {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave))
    return Array.isArray(salvo) ? salvo.filter(valido) : []
  } catch {
    return []
  }
}

export function guardarMeuCodigo(id, codigo) {
  const novo = { id, codigo }
  if (!valido(novo)) return false
  const lista = lerMeusCodigos().filter((item) => item.id !== id)
  lista.push(novo)
  return gravar(lista.slice(-limite))
}

export function esquecerCodigosAntigos(agendamentosDoBanco, agora = Date.now()) {
  const encontrados = new Map(agendamentosDoBanco.map((agendamento) => [agendamento.id, agendamento]))
  const lista = lerMeusCodigos().filter((item) => {
    const agendamento = encontrados.get(item.id)
    return agendamento && new Date(agendamento.inicio).getTime() >= agora - trintaDiasEmMs
  })
  gravar(lista)
  return lista
}

function tinhaHorariosDeTeste() {
  try {
    const ids = JSON.parse(localStorage.getItem('marca-ai:meus-agendamentos'))
    return Array.isArray(ids) && ids.length > 0
  } catch {
    return false
  }
}

export function limparDadosDeExemplo() {
  try {
    if (localStorage.getItem(chaveDaLimpeza)) return false
    if (tinhaHorariosDeTeste()) localStorage.setItem(chaveDoAviso, '1')
    for (const antiga of chavesDeExemplo) localStorage.removeItem(antiga)
    localStorage.setItem(chaveDaLimpeza, '1')
    return true
  } catch {
    return false
  }
}

export function temAvisoDosHorariosDeTeste() {
  try {
    return localStorage.getItem(chaveDoAviso) === '1'
  } catch {
    return false
  }
}

export function dispensarAvisoDosHorariosDeTeste() {
  try {
    localStorage.removeItem(chaveDoAviso)
  } catch {
    return
  }
}
