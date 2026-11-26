import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Coffee,
  MessageCircle,
  MessageSquareText,
  Phone,
  Plus,
  RotateCcw,
  UserX,
  CircleCheck,
  CircleX,
} from 'lucide-react'
import Aviso from '../../components/Aviso.jsx'
import Botao from '../../components/Botao.jsx'
import Card from '../../components/Card.jsx'
import Chip from '../../components/Chip.jsx'
import ChipDeStatus from '../../components/ChipDeStatus.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import PainelInferior from '../../components/PainelInferior.jsx'
import PrecoDoServico from '../../components/PrecoDoServico.jsx'
import { atualizarStatusAgendamento, buscarSalao, listarAgendaDoDia } from '../../data/consultas.js'
import { montarLinhaDoTempo, resumirDia, textoDoValor, tipoDoPrecoGuardado, valorDoAgendamento } from '../../utils/agenda.js'
import { apenasDigitosDoCelular, formatarCelular } from '../../utils/cliente.js'
import { formatarDataCurta, formatarDataLonga, linkDoWhatsapp } from '../../utils/formatos.js'
import { partesEmSaoPaulo, somarDias } from '../../utils/fuso.js'
import { formatarMinutos } from '../../utils/horariosLivres.js'
import { profissionalLogado } from '../../utils/sessao.js'

const estiloDeBotaoComoLink =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-principal bg-superficie px-4 font-semibold text-principal [&>svg]:shrink-0'

function plural(quantidade, singular, pluralDaPalavra) {
  return quantidade + ' ' + (quantidade === 1 ? singular : pluralDaPalavra)
}

function nomeDosServicos(agendamento) {
  return agendamento.servicos
    .map((item) => (item.variacao ? item.servico.nome + ' · ' + item.variacao.nome : item.servico.nome))
    .join(' + ')
}

function primeiroNome(nome) {
  return nome.split(' ')[0]
}

function ItemDeAtendimento({ item, mostrarProfissional, aoAbrir }) {
  const agendamento = item.agendamento
  const cancelado = agendamento.status === 'cancelado'

  return (
    <button
      type="button"
      onClick={aoAbrir}
      className={`flex w-full gap-3 rounded-2xl border-2 p-3 text-left ${
        cancelado ? 'border-dashed border-texto-suave bg-fundo' : 'border-borda bg-superficie'
      }`}
    >
      <span className="flex w-16 shrink-0 flex-col">
        <span className="text-2xl font-semibold">{formatarMinutos(item.inicio)}</span>
        <span className="text-texto-suave">{formatarMinutos(item.fim)}</span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-lg leading-tight font-semibold">{agendamento.cliente.nome}</span>
          {agendamento.observacoes && (
            <MessageSquareText className="mt-0.5 size-5 shrink-0 text-principal" aria-label="Tem observação" />
          )}
        </span>
        <span className="text-texto-suave">{nomeDosServicos(agendamento)}</span>
        {mostrarProfissional && <span className="text-texto-suave">com {primeiroNome(agendamento.profissional.nome)}</span>}
        <span className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <ChipDeStatus valor={agendamento.status} />
          <span className="font-semibold">{textoDoValor(valorDoAgendamento(agendamento))}</span>
        </span>
      </span>
    </button>
  )
}

function ItemSimples({ item, nomeDoProfissional, data }) {
  const horario = item.diaInteiro ? 'Dia inteiro' : formatarMinutos(item.inicio) + ' às ' + formatarMinutos(item.fim)
  const quem = nomeDoProfissional ? ' · ' + nomeDoProfissional : ''

  if (item.tipo === 'livre') {
    const endereco =
      '/salao/novo?data=' + data + '&hora=' + formatarMinutos(item.inicio) + '&profissional=' + item.profissionalId
    return (
      <Link
        to={endereco}
        aria-label={'Agendar no horário livre de ' + horario + quem}
        className="flex min-h-12 items-center justify-between gap-2 rounded-2xl border-2 border-dashed border-texto-suave px-4 text-texto-suave"
      >
        <span>
          <span className="font-semibold">Livre</span> · {horario}
          {quem}
        </span>
        <Plus className="size-5 shrink-0 text-principal" aria-hidden="true" />
      </Link>
    )
  }

  const Icone = item.tipo === 'intervalo' ? Coffee : CalendarOff
  return (
    <p className="flex min-h-12 items-center gap-2 rounded-2xl bg-borda px-4 text-texto">
      <Icone className="size-5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-semibold">{item.motivo}</span> · {horario}
        {quem}
      </span>
    </p>
  )
}

function MarcaDeAgora({ hora }) {
  return (
    <div id="marca-agora" className="flex items-center gap-2 text-principal">
      <span className="rounded-full bg-principal px-3 py-1 font-semibold text-sobre-principal">Agora · {hora}</span>
      <span className="h-0.5 flex-1 bg-principal" aria-hidden="true" />
    </div>
  )
}

function Agenda() {
  const idLogado = profissionalLogado()
  const [agora, setAgora] = useState(() => Date.now())
  const location = useLocation()
  const [params] = useSearchParams()
  const [data, setData] = useState(() => {
    const pedida = params.get('data')
    return /^\d{4}-\d{2}-\d{2}$/.test(pedida || '') ? pedida : partesEmSaoPaulo(Date.now()).data
  })
  const [soEu, setSoEu] = useState(() => !(location.state && location.state.todos))
  const [versao, setVersao] = useState(0)
  const [dados, setDados] = useState(null)
  const [abertoId, setAbertoId] = useState(null)
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(() =>
    location.state && typeof location.state.aviso === 'string'
      ? { id: Date.now(), tipo: 'sucesso', mensagem: location.state.aviso }
      : null,
  )
  const rolouParaAgora = useRef(false)
  const inicioDoToque = useRef(null)

  const agoraEmSaoPaulo = partesEmSaoPaulo(agora)
  const hoje = agoraEmSaoPaulo.data
  const ehHoje = data === hoje
  const filtro = soEu ? idLogado : null

  useEffect(() => {
    let atual = true
    async function carregar() {
      const [dia, salao] = await Promise.all([listarAgendaDoDia(data, filtro), buscarSalao()])
      if (atual) setDados({ ...dia, salao, data, filtro })
    }
    carregar()
    return () => {
      atual = false
    }
  }, [data, filtro, versao])

  useEffect(() => {
    const relogio = setInterval(() => setAgora(Date.now()), 60000)
    return () => clearInterval(relogio)
  }, [])

  const carregado = dados && dados.data === data && dados.filtro === filtro

  useEffect(() => {
    if (!carregado || !ehHoje || rolouParaAgora.current) return
    const marca = document.getElementById('marca-agora')
    if (marca) {
      marca.scrollIntoView({ block: 'center' })
      rolouParaAgora.current = true
    }
  }, [carregado, ehHoje])

  function aoComecarToque(evento) {
    const toque = evento.touches[0]
    inicioDoToque.current = { x: toque.clientX, y: toque.clientY }
  }

  function aoTerminarToque(evento) {
    if (!inicioDoToque.current) return
    const toque = evento.changedTouches[0]
    const dx = toque.clientX - inicioDoToque.current.x
    const dy = toque.clientY - inicioDoToque.current.y
    inicioDoToque.current = null
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    setData((atual) => somarDias(atual, dx < 0 ? 1 : -1))
  }

  async function mudarStatus(id, novoStatus, mensagem) {
    setSalvando(true)
    const resultado = await atualizarStatusAgendamento(id, novoStatus)
    setSalvando(false)
    setConfirmandoCancelamento(false)
    if (resultado.erro) {
      setAviso({ id: Date.now(), tipo: 'erro', mensagem: 'Não conseguimos mudar o status. Tente de novo.' })
    } else {
      setAviso({ id: Date.now(), tipo: 'sucesso', mensagem })
      if (novoStatus === 'cancelado') setAbertoId(null)
    }
    setVersao(versao + 1)
  }

  const linhaDoTempo = carregado
    ? montarLinhaDoTempo({
        data,
        agendamentos: dados.agendamentos,
        bloqueios: dados.bloqueios,
        turnos: dados.turnos,
        profissionais: dados.profissionais,
        intervaloMinimo: dados.salao.intervalo_minutos,
      })
    : []

  const itensComAgora = [...linhaDoTempo]
  if (carregado && ehHoje) {
    const posicao = itensComAgora.findIndex((item) => item.inicio > agoraEmSaoPaulo.minutosDoDia)
    const marca = { tipo: 'agora', chave: 'agora' }
    if (posicao === -1) itensComAgora.push(marca)
    else itensComAgora.splice(posicao, 0, marca)
  }

  const resumo = carregado ? resumirDia(dados.agendamentos) : null
  const nomes = carregado ? Object.fromEntries(dados.profissionais.map((item) => [item.id, primeiroNome(item.nome)])) : {}
  const aberto = carregado ? dados.agendamentos.find((agendamento) => agendamento.id === abertoId) || null : null

  return (
    <>
      <div className="sticky top-16 z-[5] -mx-4 -mt-4 border-b border-borda bg-fundo px-4 py-2">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <button
            type="button"
            onClick={() => setData((atual) => somarDias(atual, -1))}
            aria-label="Dia anterior"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-texto-suave bg-superficie"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <h2 className="min-w-0 flex-1 text-center text-lg leading-tight font-semibold" aria-live="polite">
            <span className="sr-only">{ehHoje ? 'Hoje, ' : ''}{formatarDataLonga(data)}</span>
            <span aria-hidden="true">{ehHoje ? 'Hoje · ' + formatarDataCurta(data) : formatarDataCurta(data)}</span>
          </h2>
          {!ehHoje && (
            <button
              type="button"
              onClick={() => setData(hoje)}
              className="flex min-h-12 shrink-0 items-center gap-1 px-1 font-semibold text-principal underline underline-offset-4"
            >
              <RotateCcw className="size-5" aria-hidden="true" />
              Hoje
            </button>
          )}
          <button
            type="button"
            onClick={() => setData((atual) => somarDias(atual, 1))}
            aria-label="Próximo dia"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-texto-suave bg-superficie"
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip aoClicar={() => setSoEu(true)} selecionado={soEu}>
            Só eu
          </Chip>
          <Chip aoClicar={() => setSoEu(false)} selecionado={!soEu}>
            Todos
          </Chip>
        </div>

        {resumo ? (
          <p className="text-texto-suave">
            {plural(resumo.atendimentos, 'atendimento', 'atendimentos')} · {plural(resumo.concluidos, 'concluído', 'concluídos')}{' '}
            · {plural(resumo.faltas, 'falta', 'faltas')}
            {resumo.temAgendamento && (
              <>
                {' '}
                · <span className="font-semibold text-texto">{resumo.valor}</span>
              </>
            )}
          </p>
        ) : (
          <Esqueleto classes="h-6 w-full" />
        )}
      </section>

      <section
        className="flex flex-col gap-2"
        onTouchStart={aoComecarToque}
        onTouchEnd={aoTerminarToque}
        aria-label="Linha do tempo do dia"
      >
        <p className="sr-only" role="status">
          {carregado ? '' : 'Carregando a agenda'}
        </p>

        {!carregado && (
          <>
            <Esqueleto classes="h-24 w-full rounded-2xl" />
            <Esqueleto classes="h-12 w-full rounded-2xl" />
            <Esqueleto classes="h-24 w-full rounded-2xl" />
          </>
        )}

        {carregado && dados.agendamentos.length === 0 && (
          <Card>
            <p className="font-semibold">
              {!dados.salaoAberto
                ? 'Salão fechado neste dia.'
                : dados.turnos.length === 0
                  ? 'Você não atende neste dia.'
                  : 'Nenhum atendimento neste dia.'}
            </p>
          </Card>
        )}

        {carregado &&
          itensComAgora.map((item) => {
            if (item.tipo === 'agora') return <MarcaDeAgora key="agora" hora={agoraEmSaoPaulo.hora} />
            if (item.tipo === 'atendimento') {
              return (
                <ItemDeAtendimento
                  key={item.chave}
                  item={item}
                  mostrarProfissional={!soEu}
                  aoAbrir={() => setAbertoId(item.agendamento.id)}
                />
              )
            }
            return <ItemSimples
                key={item.chave}
                item={item}
                data={data}
                nomeDoProfissional={soEu ? '' : nomes[item.profissionalId]}
              />
          })}

        <div className="h-24" aria-hidden="true" />
      </section>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-borda bg-superficie">
        <div className="mx-auto max-w-lg px-4 py-3">
          <Botao para="/salao/novo" larguraTotal grande>
            <Plus className="size-6" aria-hidden="true" />
            Novo agendamento
          </Botao>
        </div>
      </div>

      <PainelInferior
        aberto={Boolean(aberto)}
        titulo={aberto ? aberto.cliente.nome : ''}
        subtitulo={
          aberto
            ? formatarDataCurta(partesEmSaoPaulo(aberto.inicio).data) +
              ' · ' +
              partesEmSaoPaulo(aberto.inicio).hora +
              ' às ' +
              partesEmSaoPaulo(aberto.fim).hora
            : ''
        }
        aoFechar={() => setAbertoId(null)}
      >
        {aberto && (
          <DetalheDoAtendimento
            agendamento={aberto}
            salao={dados.salao}
            salvando={salvando}
            aoMudarStatus={mudarStatus}
            aoPedirCancelamento={() => setConfirmandoCancelamento(true)}
          />
        )}
      </PainelInferior>

      <Dialogo
        aberto={confirmandoCancelamento && Boolean(aberto)}
        titulo="Cancelar este atendimento?"
        aoFechar={() => setConfirmandoCancelamento(false)}
      >
        {aberto && (
          <>
            <p>
              {aberto.cliente.nome}, {partesEmSaoPaulo(aberto.inicio).hora}. O horário volta a ficar livre.
            </p>
            <div className="flex flex-col gap-2">
              <Botao variante="secundario" larguraTotal aoClicar={() => setConfirmandoCancelamento(false)}>
                Manter atendimento
              </Botao>
              <Botao
                variante="perigo"
                larguraTotal
                carregando={salvando}
                aoClicar={() => mudarStatus(aberto.id, 'cancelado', 'Atendimento cancelado.')}
              >
                Sim, cancelar
              </Botao>
            </div>
          </>
        )}
      </Dialogo>

      <Aviso aviso={aviso} definirAviso={setAviso} alto />
    </>
  )
}

function DetalheDoAtendimento({ agendamento, salao, salvando, aoMudarStatus, aoPedirCancelamento }) {
  const telefone = apenasDigitosDoCelular(agendamento.cliente.telefone)
  const inicio = partesEmSaoPaulo(agendamento.inicio)
  const mensagem =
    'Olá, ' +
    primeiroNome(agendamento.cliente.nome) +
    '! Aqui é do ' +
    salao.nome +
    '. Sobre o seu horário de ' +
    formatarDataLonga(inicio.data).toLowerCase() +
    ', às ' +
    inicio.hora +
    ': '
  const valor = valorDoAgendamento(agendamento)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChipDeStatus valor={agendamento.status} />
        <span className="text-texto-suave">com {agendamento.profissional.nome}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a href={'tel:+55' + telefone} className={estiloDeBotaoComoLink}>
          <Phone className="size-5" aria-hidden="true" />
          Ligar
        </a>
        <Botao variante="secundario" linkExterno={linkDoWhatsapp('55' + telefone, mensagem)}>
          <MessageCircle className="size-5" aria-hidden="true" />
          WhatsApp
        </Botao>
      </div>
      <p className="text-center text-texto-suave">{formatarCelular(telefone)}</p>

      <ul className="divide-y divide-borda rounded-2xl border-2 border-borda px-4">
        {agendamento.servicos.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-2">
            <span>{item.variacao ? item.servico.nome + ' · ' + item.variacao.nome : item.servico.nome}</span>
            <PrecoDoServico tipoPreco={tipoDoPrecoGuardado(item)} preco={item.preco} />
          </li>
        ))}
        <li className="flex items-start justify-between gap-3 py-2">
          <span className="font-semibold">Total</span>
          <span className="text-right font-semibold">{textoDoValor(valor)}</span>
        </li>
      </ul>

      <p>
        Pagamento: {agendamento.forma_pagamento === 'pix' ? 'Pix pelo app' : 'no salão'} ·{' '}
        {agendamento.pago ? 'pago' : 'a pagar'}
      </p>

      {agendamento.observacoes && (
        <p className="flex items-start gap-2 rounded-2xl border-2 border-principal p-3">
          <MessageSquareText className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
          <span>
            <span className="font-semibold">Observação:</span> {agendamento.observacoes}
          </span>
        </p>
      )}

      {agendamento.status === 'agendado' && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Botao carregando={salvando} aoClicar={() => aoMudarStatus(agendamento.id, 'concluido', 'Marcado como concluído.')}>
              {!salvando && <CircleCheck className="size-5" aria-hidden="true" />}
              Concluído
            </Botao>
            <Botao
              variante="secundario"
              carregando={salvando}
              aoClicar={() => aoMudarStatus(agendamento.id, 'faltou', 'Marcado como falta.')}
            >
              {!salvando && <UserX className="size-5" aria-hidden="true" />}
              Faltou
            </Botao>
          </div>
          <Botao variante="secundario" larguraTotal aoClicar={aoPedirCancelamento}>
            <CircleX className="size-5" aria-hidden="true" />
            Cancelar atendimento
          </Botao>
        </div>
      )}

      {(agendamento.status === 'concluido' || agendamento.status === 'faltou') && (
        <Botao
          variante="secundario"
          larguraTotal
          carregando={salvando}
          aoClicar={() => aoMudarStatus(agendamento.id, 'agendado', 'Voltou para agendado.')}
        >
          {!salvando && <RotateCcw className="size-5" aria-hidden="true" />}
          Voltar para agendado
        </Botao>
      )}

      {agendamento.status === 'cancelado' && <p className="text-texto-suave">Este atendimento foi cancelado.</p>}
    </div>
  )
}

export default Agenda
