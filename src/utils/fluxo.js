import { buscarProfissional, listarServicosComVariacoes } from '../data/consultas.js'
import { carregarEscolha, carregarHorario, carregarProfissional, resumirEscolha } from './agendamento.js'
import { formatarDataCurta } from './formatos.js'
import { formatarMinutos } from './horariosLivres.js'

export async function carregarResumoDoFluxo() {
  const servicos = await listarServicosComVariacoes()
  const resumo = resumirEscolha(carregarEscolha(), servicos)
  const horario = carregarHorario()
  const idDoProfissional = horario ? horario.profissionalId : carregarProfissional()
  const profissional = idDoProfissional === null ? null : await buscarProfissional(idDoProfissional)
  const quando = horario
    ? formatarDataCurta(horario.data) +
      ' · ' +
      formatarMinutos(horario.minutos) +
      ' às ' +
      formatarMinutos(horario.minutos + resumo.duracaoTotal)
    : ''

  return {
    resumo,
    horario,
    quando,
    nomeDoProfissional: profissional ? profissional.nome : 'Qualquer profissional',
  }
}
