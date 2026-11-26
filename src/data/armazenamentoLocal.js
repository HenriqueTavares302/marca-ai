const chave = 'marca-ai:banco-local'

function listaOuVazia(valor) {
  return Array.isArray(valor) ? valor.filter((item) => item && typeof item === 'object') : []
}

export function lerBancoLocal() {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave))
    return {
      clientes: listaOuVazia(salvo && salvo.clientes),
      agendamentos: listaOuVazia(salvo && salvo.agendamentos),
      agendamento_servicos: listaOuVazia(salvo && salvo.agendamento_servicos),
      alteracoes_de_status: listaOuVazia(salvo && salvo.alteracoes_de_status),
    }
  } catch {
    return { clientes: [], agendamentos: [], agendamento_servicos: [], alteracoes_de_status: [] }
  }
}

export function gravarBancoLocal(banco) {
  localStorage.setItem(chave, JSON.stringify(banco))
}
