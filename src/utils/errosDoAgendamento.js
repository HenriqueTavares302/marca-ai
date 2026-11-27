const horarioQueNaoServeMais = [
  'horario_ocupado',
  'horario_bloqueado',
  'sem_profissional_livre',
  'fora_do_expediente',
  'antecedencia_minima',
]
const horarioForaDoPrazo = ['muito_distante', 'data_invalida', 'horario_invalido']
const cardapioMudou = ['servicos_invalidos', 'tamanho_invalido']
const profissionalMudou = ['profissional_nao_faz_o_servico', 'profissional_invalido']

const avisosDosDados = {
  nome_invalido: 'Confira o nome: escreva pelo menos 2 letras.',
  telefone_invalido: 'Confira o celular: escreva o DDD e o número.',
  observacoes_invalidas: 'A observação não foi aceita. Encurte o texto e tente de novo.',
}

export function destinoDoErro(codigo, nomeDoProfissional = '') {
  if (horarioQueNaoServeMais.includes(codigo)) {
    return { para: '/agendar/horario', aviso: 'Esse horário não está mais disponível. Escolha outro.' }
  }
  if (horarioForaDoPrazo.includes(codigo)) {
    return { para: '/agendar/horario', aviso: 'Escolha um horário dentro dos próximos 90 dias.' }
  }
  if (cardapioMudou.includes(codigo)) {
    return {
      para: '/servicos',
      aviso: 'Um serviço ou tamanho que você escolheu mudou no cardápio. Confira a escolha.',
      limparCardapio: true,
    }
  }
  if (profissionalMudou.includes(codigo)) {
    const quem = nomeDoProfissional ? nomeDoProfissional.split(' ')[0] : 'O profissional escolhido'
    return {
      para: '/agendar',
      aviso: quem + ' não faz mais esse serviço. Escolha outro profissional.',
      limparCardapio: true,
    }
  }
  if (avisosDosDados[codigo]) {
    return { para: '/agendar/dados', aviso: avisosDosDados[codigo] }
  }
  if (codigo === 'nao_encontrado') {
    return {
      para: '/meus-agendamentos',
      aviso: 'Não encontramos esse agendamento. Ele pode ter sido cancelado pelo salão.',
    }
  }
  return { para: null, aviso: '' }
}

export const mensagemDoLimite =
  'Este celular já tem 3 horários marcados. Para marcar outro, cancele um em Meus agendamentos ou fale com o salão.'
