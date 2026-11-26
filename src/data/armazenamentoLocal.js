const chave = 'marca-ai:banco-local'

function listaOuVazia(valor) {
  return Array.isArray(valor) ? valor.filter((item) => item && typeof item === 'object') : []
}

function listaOuNula(valor) {
  return Array.isArray(valor) ? listaOuVazia(valor) : null
}

function catalogoOuNulo(valor) {
  const valido =
    valor &&
    typeof valor === 'object' &&
    Array.isArray(valor.servicos) &&
    Array.isArray(valor.servico_variacoes) &&
    Array.isArray(valor.profissional_servicos) &&
    Array.isArray(valor.categorias)
  if (!valido) return null
  return {
    servicos: listaOuVazia(valor.servicos),
    servico_variacoes: listaOuVazia(valor.servico_variacoes),
    profissional_servicos: listaOuVazia(valor.profissional_servicos),
    profissional_variacoes: listaOuVazia(valor.profissional_variacoes),
    categorias: valor.categorias.filter((categoria) => typeof categoria === 'string'),
    variacoes_removidas: listaOuVazia(valor.variacoes_removidas),
  }
}

export function lerBancoLocal() {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave))
    return {
      clientes: listaOuVazia(salvo && salvo.clientes),
      clientes_completos: Boolean(salvo && salvo.clientes_completos === true),
      agendamentos: listaOuVazia(salvo && salvo.agendamentos),
      agendamento_servicos: listaOuVazia(salvo && salvo.agendamento_servicos),
      alteracoes_de_status: listaOuVazia(salvo && salvo.alteracoes_de_status),
      catalogo: catalogoOuNulo(salvo && salvo.catalogo),
      horarios_trabalho: listaOuNula(salvo && salvo.horarios_trabalho),
      bloqueios: listaOuNula(salvo && salvo.bloqueios),
    }
  } catch {
    return {
      clientes: [],
      clientes_completos: false,
      agendamentos: [],
      agendamento_servicos: [],
      alteracoes_de_status: [],
      catalogo: null,
      horarios_trabalho: null,
      bloqueios: null,
    }
  }
}

export function gravarBancoLocal(banco) {
  localStorage.setItem(chave, JSON.stringify(banco))
}
