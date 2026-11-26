import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CircleCheck,
  CircleX,
  Clock,
  MessageCircle,
  RotateCcw,
  UserX,
} from 'lucide-react'
import AcoesDoAgendamento from '../../components/AcoesDoAgendamento.jsx'
import Aviso from '../../components/Aviso.jsx'
import Botao from '../../components/Botao.jsx'
import Card from '../../components/Card.jsx'
import Chip from '../../components/Chip.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import {
  buscarSalao,
  cancelarAgendamento,
  listarMeusAgendamentos,
  listarProfissionaisComServicos,
} from '../../data/consultas.js'
import {
  carregarMeusAgendamentos,
  encerrarRemarcacao,
  iniciarRemarcacao,
  podeAlterarAgendamento,
  preencherEscolhaComAgendamento,
  profissionaisQueFazemTudo,
} from '../../utils/agendamento.js'
import { formatarDataLonga, formatarDuracao, linkDoWhatsapp, mensagemParaOSalao } from '../../utils/formatos.js'
import { hojeEmSaoPaulo, partesEmSaoPaulo } from '../../utils/fuso.js'

const status = {
  agendado: { texto: 'Agendado', variante: 'principal', icone: CalendarCheck },
  concluido: { texto: 'Concluído', variante: 'neutro', icone: CircleCheck },
  cancelado: { texto: 'Cancelado', variante: 'perigo', icone: CircleX },
  faltou: { texto: 'Faltou', variante: 'perigo', icone: UserX },
}

function nomesDosServicos(agendamento) {
  return agendamento.servicos
    .map((item) => (item.variacao ? item.servico.nome + ' · ' + item.variacao.nome : item.servico.nome))
    .join(' + ')
}

function diasEntre(dataA, dataB) {
  const [anoA, mesA, diaA] = dataA.split('-').map(Number)
  const [anoB, mesB, diaB] = dataB.split('-').map(Number)
  return Math.round((Date.UTC(anoB, mesB - 1, diaB) - Date.UTC(anoA, mesA - 1, diaA)) / 86400000)
}

function quantoFalta(agendamento) {
  const inicio = partesEmSaoPaulo(agendamento.inicio)
  const dias = diasEntre(hojeEmSaoPaulo(), inicio.data)
  if (dias === 0) return 'Hoje às ' + inicio.hora
  if (dias === 1) return 'Amanhã às ' + inicio.hora
  return 'Em ' + dias + ' dias'
}

function textoDoQuando(agendamento) {
  const inicio = partesEmSaoPaulo(agendamento.inicio)
  const fim = partesEmSaoPaulo(agendamento.fim)
  return { dia: formatarDataLonga(inicio.data), horas: inicio.hora + ' às ' + fim.hora }
}

function ChipDeStatus({ agendamento }) {
  const dados = status[agendamento.status] || status.agendado
  return (
    <Chip variante={dados.variante} icone={dados.icone}>
      {dados.texto}
    </Chip>
  )
}

function AgendamentoFuturo({ agendamento, salao, destaque, podeAlterar, aoCancelar, aoRemarcar }) {
  const quando = textoDoQuando(agendamento)
  const servicos = nomesDosServicos(agendamento)
  const evento = {
    id: agendamento.id,
    titulo: servicos + ' · ' + salao.nome,
    descricao: 'Com ' + agendamento.profissional.nome + '.',
    local: salao.endereco,
    inicio: agendamento.inicio,
    fim: agendamento.fim,
  }
  const mensagem = mensagemParaOSalao(salao, quando.dia, partesEmSaoPaulo(agendamento.inicio).hora, servicos)

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`flex items-center gap-2 font-semibold text-principal ${destaque ? 'text-lg' : ''}`}>
          <CalendarClock className="size-5" aria-hidden="true" />
          {quantoFalta(agendamento)}
        </p>
        <ChipDeStatus agendamento={agendamento} />
      </div>

      <p className={destaque ? 'text-xl font-semibold' : 'font-semibold'}>{servicos}</p>
      <p>Com {agendamento.profissional.nome}</p>
      <p>
        <span className="block font-semibold">{quando.dia}</span>
        <span className="block">
          {quando.horas} · {formatarDuracao(agendamento.servicos.reduce((total, item) => total + item.duracao_min, 0))}
        </span>
      </p>

      {podeAlterar ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Botao variante="secundario" aoClicar={aoRemarcar}>
            <RotateCcw className="size-5" aria-hidden="true" />
            Remarcar
          </Botao>
          <Botao variante="secundario" aoClicar={aoCancelar}>
            <CircleX className="size-5" aria-hidden="true" />
            Cancelar
          </Botao>
        </div>
      ) : (
        <>
          <p className="mt-2 flex items-start gap-2 rounded-2xl border-2 border-borda p-3">
            <Clock className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
            Para cancelar ou remarcar com menos de {salao.cancelamento_minimo_minutos / 60}h de antecedência, fale com
            o salão.
          </p>
          <Botao variante="secundario" larguraTotal linkExterno={linkDoWhatsapp(salao.whatsapp, mensagem)}>
            <MessageCircle className="size-5" aria-hidden="true" />
            Falar com o salão
          </Botao>
        </>
      )}

      <AcoesDoAgendamento
        evento={evento}
        nomeDoArquivo={'agendamento-' + partesEmSaoPaulo(agendamento.inicio).data + '.ics'}
        salao={salao}
        mensagem={mensagem}
        mostrarWhatsapp={podeAlterar}
      />
    </Card>
  )
}

function AgendamentoPassado({ agendamento, aoAgendarDeNovo }) {
  const quando = textoDoQuando(agendamento)
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold">{nomesDosServicos(agendamento)}</p>
        <ChipDeStatus agendamento={agendamento} />
      </div>
      <p className="text-texto-suave">
        {quando.dia} · {quando.horas} · com {agendamento.profissional.nome}
      </p>
      <Botao variante="secundario" larguraTotal aoClicar={aoAgendarDeNovo}>
        <RotateCcw className="size-5" aria-hidden="true" />
        Agendar de novo
      </Botao>
    </Card>
  )
}

function MeusAgendamentos() {
  const navegar = useNavigate()
  const [dados, setDados] = useState(null)
  const [paraCancelar, setParaCancelar] = useState(null)
  const [cancelando, setCancelando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    encerrarRemarcacao()
  }, [])

  useEffect(() => {
    async function carregar() {
      const [lista, salao, profissionais] = await Promise.all([
        listarMeusAgendamentos(carregarMeusAgendamentos()),
        buscarSalao(),
        listarProfissionaisComServicos(),
      ])
      setDados({ lista, salao, profissionais, agora: Date.now() })
    }
    carregar()
  }, [versao])

  async function confirmarCancelamento() {
    setCancelando(true)
    const resultado = await cancelarAgendamento(paraCancelar.id)
    setCancelando(false)
    setParaCancelar(null)
    if (resultado.erro === 'fora_do_prazo') {
      setAviso({ id: Date.now(), tipo: 'erro', mensagem: 'Já passou do prazo para cancelar pelo app. Fale com o salão.' })
    } else if (resultado.erro) {
      setAviso({ id: Date.now(), tipo: 'erro', mensagem: 'Não conseguimos cancelar. Tente de novo.' })
    } else {
      setAviso({ id: Date.now(), tipo: 'sucesso', mensagem: 'Horário cancelado.' })
    }
    setVersao(versao + 1)
  }

  function remarcar(agendamento) {
    preencherEscolhaComAgendamento(agendamento, agendamento.profissional_id)
    iniciarRemarcacao(agendamento)
    navegar('/agendar/horario')
  }

  function agendarDeNovo(agendamento) {
    const itensValidos = agendamento.servicos.filter(
      (item) => item.servico && item.servico.ativo && (item.variacao_id === null || item.variacao),
    )
    const comServicosValidos = { ...agendamento, servicos: itensValidos }
    const possiveis = profissionaisQueFazemTudo(
      dados.profissionais,
      itensValidos.map((item) => ({ servico: item.servico })),
    )
    const mesmoProfissional = possiveis.some((profissional) => profissional.id === agendamento.profissional_id)
    preencherEscolhaComAgendamento(comServicosValidos, mesmoProfissional ? agendamento.profissional_id : null)
    navegar('/servicos')
  }

  if (!dados) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando seus horários
        </p>
        <Esqueleto classes="h-64 w-full" />
        <Esqueleto classes="h-32 w-full" />
      </>
    )
  }

  const { lista, salao, agora } = dados
  const futuros = lista.filter(
    (agendamento) => agendamento.status === 'agendado' && new Date(agendamento.fim).getTime() > agora,
  )
  const historico = lista.filter((agendamento) => !futuros.includes(agendamento)).reverse()
  const [proximo, ...outrosFuturos] = futuros

  if (lista.length === 0) {
    return (
      <Card>
        <p className="font-semibold">Você ainda não tem horários marcados neste aparelho.</p>
        <p className="text-texto-suave">Quando você agendar por aqui, seus horários aparecem nesta tela.</p>
        <Botao para="/servicos" larguraTotal grande>
          <CalendarPlus className="size-6" aria-hidden="true" />
          Agendar horário
        </Botao>
      </Card>
    )
  }

  function cartaoFuturo(agendamento, destaque) {
    return (
      <AgendamentoFuturo
        agendamento={agendamento}
        salao={salao}
        destaque={destaque}
        podeAlterar={podeAlterarAgendamento(agendamento, salao.cancelamento_minimo_minutos, agora)}
        aoCancelar={() => setParaCancelar(agendamento)}
        aoRemarcar={() => remarcar(agendamento)}
      />
    )
  }

  return (
    <>
      <p className="text-texto-suave">Mostramos os horários marcados neste aparelho.</p>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Próximo horário</h2>
        {proximo ? (
          cartaoFuturo(proximo, true)
        ) : (
          <Card>
            <p>Nenhum horário marcado daqui para frente.</p>
            <Botao para="/servicos" larguraTotal>
              Agendar horário
            </Botao>
          </Card>
        )}
      </section>

      {outrosFuturos.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Depois</h2>
          <ul className="flex flex-col gap-3">
            {outrosFuturos.map((agendamento) => (
              <li key={agendamento.id}>{cartaoFuturo(agendamento, false)}</li>
            ))}
          </ul>
        </section>
      )}

      {historico.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Histórico</h2>
          <ul className="flex flex-col gap-3">
            {historico.map((agendamento) => (
              <li key={agendamento.id}>
                <AgendamentoPassado agendamento={agendamento} aoAgendarDeNovo={() => agendarDeNovo(agendamento)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialogo aberto={Boolean(paraCancelar)} titulo="Cancelar este horário?" aoFechar={() => setParaCancelar(null)}>
        {paraCancelar && (
          <>
            <p>
              {nomesDosServicos(paraCancelar)}, {textoDoQuando(paraCancelar).dia.toLowerCase()},{' '}
              {textoDoQuando(paraCancelar).horas}.
            </p>
            <p className="text-texto-suave">O horário fica livre para outra pessoa.</p>
            <div className="flex flex-col gap-2">
              <Botao variante="secundario" larguraTotal aoClicar={() => setParaCancelar(null)}>
                Manter horário
              </Botao>
              <Botao variante="perigo" larguraTotal carregando={cancelando} aoClicar={confirmarCancelamento}>
                Sim, cancelar
              </Botao>
            </div>
          </>
        )}
      </Dialogo>

      <Aviso aviso={aviso} definirAviso={setAviso} />
    </>
  )
}

export default MeusAgendamentos
