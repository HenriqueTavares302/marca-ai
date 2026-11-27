export const codigosDoBanco = [
  'antecedencia_minima',
  'cliente_nao_encontrado',
  'codigos_demais',
  'data_invalida',
  'fora_do_expediente',
  'fora_do_prazo',
  'forma_de_pagamento_invalida',
  'horario_bloqueado',
  'horario_invalido',
  'horario_ocupado',
  'limite_de_agendamentos',
  'mudanca_invalida',
  'muito_distante',
  'nao_encontrado',
  'nome_invalido',
  'observacoes_invalidas',
  'periodo_invalido',
  'profissional_invalido',
  'profissional_nao_faz_o_servico',
  'recebimento_invalido',
  'salao_nao_encontrado',
  'sem_permissao',
  'sem_profissional_livre',
  'servicos_invalidos',
  'tamanho_invalido',
  'telefone_invalido',
  'tem_agendamento_futuro',
  'ultimo_dono',
]

const mensagens = {
  sem_internet: 'Sem conexão com a internet. Confira a conexão e tente de novo.',
  servidor_indisponivel: 'O sistema do salão está fora do ar agora. Tente de novo em alguns minutos.',
  sessao_vencida: 'Sua sessão terminou. Entre de novo para continuar.',
  sem_permissao: 'Você não tem acesso a isso.',
  muitas_tentativas: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  sem_configuracao: 'O app ainda não está configurado neste endereço.',
  erro_inesperado: 'Algo deu errado. Tente de novo.',
}

function navegadorOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

export function traduzirErro(problema, online = navegadorOnline()) {
  if (!problema) return null
  const erro = problema.error ?? problema
  const status = Number(problema.status ?? erro.status ?? 0)
  const mensagem = String(erro.message ?? '')
  const codigo = String(erro.code ?? '')

  if (!online) return 'sem_internet'
  if (codigosDoBanco.includes(mensagem)) return mensagem
  if (status === 401 || codigo === 'PGRST301' || codigo === 'PGRST303' || /jwt expired/i.test(mensagem)) return 'sessao_vencida'
  if (status === 403 || codigo === '42501' || /permission denied/i.test(mensagem)) return 'sem_permissao'
  if (status === 429) return 'muitas_tentativas'
  if (erro instanceof TypeError || /failed to fetch|networkerror|load failed|fetch failed/i.test(mensagem)) {
    return 'servidor_indisponivel'
  }
  if (status >= 500 || status === 408) return 'servidor_indisponivel'
  return 'erro_inesperado'
}

export function mensagemDoErro(codigo) {
  return mensagens[codigo] || mensagens.erro_inesperado
}

export class ErroDosDados extends Error {
  constructor(codigo) {
    super(codigo)
    this.codigo = codigo
  }
}

export function codigoDoProblema(problema) {
  return problema && typeof problema.codigo === 'string' ? problema.codigo : 'erro_inesperado'
}
