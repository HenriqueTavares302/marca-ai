import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarCheck, CalendarDays, Info, MessageCircle, RotateCcw, Store } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import Card from '../../components/Card.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import IndicadorDePassos from '../../components/IndicadorDePassos.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import PrecoDoServico from '../../components/PrecoDoServico.jsx'
import RodapeFixo from '../../components/RodapeFixo.jsx'
import SemServicosEscolhidos from '../../components/SemServicosEscolhidos.jsx'
import {
  buscarSalao,
  criarAgendamento,
  listarHorariosLivres,
  listarMeusAgendamentos,
  remarcarAgendamento,
} from '../../data/consultas.js'
import { codigoDoProblema, mensagemDoErro } from '../../data/supabase/erros.js'
import { limparCacheDaVitrine } from '../../data/supabase/vitrine.js'
import {
  adicionarMeuAgendamento,
  carregarDadosDoCliente,
  carregarRemarcacao,
  encerrarRemarcacao,
  carregarEscolha,
  itensParaOBanco,
  limparEscolha,
  resumirEscolha,
  salvarHorario,
  salvarUltimoAgendamento,
  textoDaQuantidade,
  textoDoValorTotal,
} from '../../utils/agendamento.js'
import { apenasDigitosDoCelular, erroDoCelular, erroDoNome, formatarCelular } from '../../utils/cliente.js'
import { carregarResumoDoFluxo } from '../../utils/fluxo.js'
import { destinoDoErro, mensagemDoLimite } from '../../utils/errosDoAgendamento.js'
import { formatarDataLonga, formatarDuracao, formatarPreco, linkDoWhatsapp } from '../../utils/formatos.js'
import { instanteEmSaoPaulo, partesEmSaoPaulo } from '../../utils/fuso.js'
import { formatarMinutos } from '../../utils/horariosLivres.js'
import { textoDoValor, tipoDoPrecoGuardado, valorDoAgendamento } from '../../utils/agenda.js'

function Bloco({ titulo, para, children }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{titulo}</h2>
        {para && (
          <Link
            to={para}
            aria-label={'Alterar ' + titulo.toLowerCase()}
            className="flex min-h-12 shrink-0 items-center px-2 font-semibold text-principal underline underline-offset-4"
          >
            Alterar
          </Link>
        )}
      </div>
      {children}
    </Card>
  )
}

function OpcaoDePagamento({ valor, escolhida, aoEscolher, titulo, detalhe }) {
  const corDaBorda = escolhida ? 'border-principal' : 'border-borda'
  return (
    <label
      className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-superficie px-4 py-3 ${corDaBorda}`}
    >
      <input
        type="radio"
        name="forma-de-pagamento"
        value={valor}
        checked={escolhida}
        onChange={() => aoEscolher(valor)}
        className="size-6 shrink-0 accent-principal"
      />
      <span>
        <span className="block font-semibold">{titulo}</span>
        <span className="block text-texto-suave">{detalhe}</span>
      </span>
    </label>
  )
}

function AvisoParaVoltar({ texto, botao, para }) {
  return (
    <>
      <IndicadorDePassos passo={4} />
      <Card>
        <p className="font-semibold">{texto}</p>
      </Card>
      <RodapeFixo>
        <Botao para={para} larguraTotal grande>
          {botao}
        </Botao>
      </RodapeFixo>
    </>
  )
}

function AgendarConfirmacao() {
  const navegar = useNavigate()
  const [dados, setDados] = useState(null)
  const [formaPagamento, setFormaPagamento] = useState('salao')
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState('')
  const [avisoDeTroca, setAvisoDeTroca] = useState('')
  const [erroAoCarregar, setErroAoCarregar] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const [passouDoLimite, setPassouDoLimite] = useState(false)
  const [pixIndisponivel, setPixIndisponivel] = useState(false)
  const enviando = useRef(false)

  useEffect(() => {
    async function montar() {
      const [fluxo, salao] = await Promise.all([carregarResumoDoFluxo(), buscarSalao()])
      const remarcacao = carregarRemarcacao()
      if (remarcacao) {
        const meus = await listarMeusAgendamentos([remarcacao.agendamentoId])
        const original = meus.find((agendamento) => agendamento.id === remarcacao.agendamentoId)
        const cliente =
          original && original.cliente
            ? { nome: original.cliente.nome, celular: original.cliente.telefone, observacao: original.observacoes || '' }
            : null
        setDados({ ...fluxo, salao, cliente, remarcacao, original: original || null })
        return
      }
      setDados({ ...fluxo, salao, cliente: carregarDadosDoCliente(), remarcacao: null, original: null })
    }

    async function carregar() {
      try {
        await montar()
        setErroAoCarregar(null)
      } catch (problema) {
        setErroAoCarregar(codigoDoProblema(problema))
      }
    }
    carregar()
  }, [tentativa])

  function irParaOPasso2() {
    navegar('/agendar/horario', { state: { aviso: 'Esse horário acabou de ser ocupado. Escolha outro.' } })
  }

  function liberarBotao() {
    setConfirmando(false)
    enviando.current = false
  }

  function tratarFalha(codigo, remarcando) {
    if (codigo === 'horario_ocupado') {
      irParaOPasso2()
      return
    }
    const destino = destinoDoErro(codigo, dados.nomeDoProfissional)
    if (destino.para) {
      if (destino.limparCardapio) limparCacheDaVitrine()
      navegar(destino.para, { state: { aviso: destino.aviso } })
      return
    }
    if (codigo === 'limite_de_agendamentos') {
      setPassouDoLimite(true)
      setErro(mensagemDoLimite)
    } else if (codigo === 'forma_de_pagamento_invalida') {
      setFormaPagamento('salao')
      setPixIndisponivel(true)
      setErro('O pagamento por Pix não está disponível agora. Ficou "Pagar no salão": confira e confirme de novo.')
    } else if (codigo === 'fora_do_prazo') {
      setErro('Já passou do prazo para remarcar pelo app. Fale com o salão.')
    } else if (['sem_internet', 'servidor_indisponivel', 'muitas_tentativas'].includes(codigo)) {
      setErro(mensagemDoErro(codigo))
    } else {
      setErro(remarcando ? 'Não conseguimos remarcar. Tente de novo.' : 'Não conseguimos salvar o agendamento. Tente de novo.')
    }
    liberarBotao()
  }

  async function confirmar() {
    if (enviando.current) return
    enviando.current = true
    setConfirmando(true)
    setErro('')
    setPassouDoLimite(false)

    const { resumo, horario, cliente, profissionalEscolhidoId, original } = dados
    const servicoIds = resumo.itens.map((item) => item.servico.id)
    let livres = []
    try {
      livres = await listarHorariosLivres(
        horario.data,
        profissionalEscolhidoId,
        resumo.duracaoTotal,
        servicoIds,
        original ? original.id : null,
        false,
        itensParaOBanco(resumo),
      )
    } catch (problema) {
      tratarFalha(codigoDoProblema(problema), Boolean(original))
      return
    }
    const vaga = livres.find((livre) => livre.minutos === horario.minutos)
    if (!vaga) {
      irParaOPasso2()
      return
    }
    if (vaga.profissionalId !== horario.profissionalId) {
      const novoResumo = resumirEscolha(carregarEscolha(), dados.servicos, vaga.profissionalId)
      const novoHorario = { ...horario, profissionalId: vaga.profissionalId }
      salvarHorario(novoHorario)
      if (textoDoValorTotal(novoResumo) !== textoDoValorTotal(resumo)) {
        const fluxo = await carregarResumoDoFluxo()
        setDados({ ...dados, ...fluxo })
        setAvisoDeTroca(
          'O horário passou para ' +
            fluxo.nomeDoProfissional.split(' ')[0] +
            '. O total agora é ' +
            textoDoValorTotal(fluxo.resumo) +
            '. Confira e confirme de novo.',
        )
        setConfirmando(false)
        enviando.current = false
        return
      }
    }
    const inicio = new Date(instanteEmSaoPaulo(horario.data, horario.minutos)).toISOString()

    if (original) {
      const remarcado = await remarcarAgendamento(original.id, vaga.profissionalId, inicio)
      if (remarcado.erro) {
        tratarFalha(remarcado.erro, true)
        return
      }
      terminar(remarcado.agendamento, true)
      return
    }

    const resultado = await criarAgendamento({
      origem: 'cliente',
      nome: cliente.nome,
      telefone: apenasDigitosDoCelular(cliente.celular),
      profissionalId: vaga.profissionalId,
      inicio,
      itens: resumo.itens.map((item) => ({
        servico_id: item.servico.id,
        variacao_id: item.variacao ? item.variacao.id : null,
        preco: item.servico.tipo_preco === 'consulta' ? null : item.preco,
        duracao_min: item.duracao_min,
      })),
      observacoes: cliente.observacao,
      formaPagamento,
    })

    if (resultado.erro) {
      tratarFalha(resultado.erro, false)
      return
    }

    if (!resultado.guardadoNoAparelho) adicionarMeuAgendamento(resultado.agendamento.id)
    terminar(resultado.agendamento, false)
  }

  function valorFinal(agendamento) {
    const { resumo, original } = dados
    if (original && original.profissional_id === agendamento.profissional_id) {
      return textoDoValor(valorDoAgendamento(original))
    }
    const doBanco = agendamento.valor_total
    if (resumo.temValor && typeof doBanco === 'number' && doBanco !== resumo.valorTotal) {
      const valor = (resumo.aPartir ? 'a partir de ' : '') + formatarPreco(doBanco)
      return resumo.aCombinar ? valor + ' + valor a combinar' : valor
    }
    return textoDoValorTotal(resumo)
  }

  function terminar(agendamento, remarcado) {
    salvarUltimoAgendamento({
      id: agendamento.id,
      inicio: agendamento.inicio,
      fim: agendamento.fim,
      servicos: dados.resumo.itens.map((item) => item.nome),
      profissional: agendamento.profissional.nome,
      valor: valorFinal(agendamento),
      formaPagamento: agendamento.forma_pagamento,
      remarcado,
    })
    limparEscolha()
    encerrarRemarcacao()
    navegar('/agendar/sucesso', { replace: true })
  }

  if (erroAoCarregar) {
    return (
      <ErroAoCarregar
        codigo={erroAoCarregar}
        aoTentarDeNovo={() => {
          setErroAoCarregar(null)
          setTentativa(tentativa + 1)
        }}
      />
    )
  }

  if (!dados) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando
        </p>
        <Esqueleto classes="h-12 w-full" />
        <Esqueleto classes="h-48 w-full" />
      </>
    )
  }

  const { resumo, horario, cliente, salao, remarcacao, original } = dados

  if (resumo.quantidade === 0) {
    return <SemServicosEscolhidos />
  }
  if (!horario) {
    return <AvisoParaVoltar texto="Escolha o dia e o horário primeiro." botao="Escolher dia e horário" para="/agendar/horario" />
  }
  if (remarcacao && !original) {
    return (
      <AvisoParaVoltar
        texto="Não encontramos o agendamento para remarcar neste aparelho."
        botao="Ver meus agendamentos"
        para="/meus-agendamentos"
      />
    )
  }
  if (!original && (!cliente || erroDoNome(cliente.nome) || erroDoCelular(cliente.celular))) {
    return <AvisoParaVoltar texto="Falta informar seu nome e celular." botao="Informar meus dados" para="/agendar/dados" />
  }

  const mesmoProfissional = Boolean(original) && original.profissional_id === horario.profissionalId
  const trocouDeProfissional = Boolean(original) && !mesmoProfissional
  const itensParaMostrar = mesmoProfissional
    ? original.servicos.map((item) => ({
        chave: item.id,
        nome: item.variacao ? item.servico.nome + ' · ' + item.variacao.nome : item.servico.nome,
        duracao: item.duracao_min,
        tipoPreco: tipoDoPrecoGuardado(item),
        preco: item.preco,
      }))
    : resumo.itens.map((item) => ({
        chave: item.servico.id,
        nome: item.nome,
        duracao: item.duracao_min,
        tipoPreco: item.servico.tipo_preco,
        preco: item.preco,
      }))
  const valorDoOriginal = original ? valorDoAgendamento(original) : null
  const valorACombinar = mesmoProfissional
    ? valorDoOriginal.aPartir || valorDoOriginal.aCombinar
    : resumo.aPartir || resumo.aCombinar
  const valorPrincipal = mesmoProfissional
    ? textoDoValor(valorDoOriginal)
    : resumo.temValor
      ? (resumo.aPartir ? 'a partir de ' : '') + formatarPreco(resumo.valorTotal)
      : 'Valor a combinar'
  const valorExtra = !mesmoProfissional && resumo.temValor && resumo.aCombinar ? '+ valor a combinar' : ''

  return (
    <>
      {original ? (
        <p className="flex items-start gap-2 rounded-2xl border-2 border-principal bg-superficie p-3">
          <RotateCcw className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
          Confira o novo horário e confirme a remarcação.
        </p>
      ) : (
        <IndicadorDePassos passo={4} />
      )}

      <Bloco titulo="Serviços" para={original ? null : '/servicos'}>
        <ul className="divide-y divide-borda">
          {itensParaMostrar.map((item) => (
            <li key={item.chave} className="flex items-start justify-between gap-3 py-2">
              <span>
                <span className="block">{item.nome}</span>
                <span className="block text-texto-suave">{formatarDuracao(item.duracao)}</span>
              </span>
              <PrecoDoServico tipoPreco={item.tipoPreco} preco={item.preco} />
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1 border-t-2 border-borda pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">Total</span>
            <span className="whitespace-nowrap text-texto-suave">
              {textoDaQuantidade(resumo.quantidade)} · {formatarDuracao(resumo.duracaoTotal)}
            </span>
          </div>
          <p className="text-right text-lg font-semibold">
            <span className="whitespace-nowrap">{valorPrincipal}</span>
            {valorExtra && (
              <>
                {' '}
                <span className="whitespace-nowrap">{valorExtra}</span>
              </>
            )}
          </p>
        </div>
        {trocouDeProfissional && (
          <p className="flex items-start gap-2 rounded-2xl border-2 border-principal p-3" role="status">
            <Info className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
            <span>
              Antes: {textoDoValor(valorDoOriginal)} · Agora com {dados.nomeDoProfissional.split(' ')[0]}:{' '}
              <span className="font-semibold">{textoDoValorTotal(resumo)}</span>
            </span>
          </p>
        )}
        {mesmoProfissional && (
          <p className="text-texto-suave">Mesmo profissional: o valor da primeira marcação continua valendo.</p>
        )}
        {valorACombinar && (
          <p className="flex items-start gap-2 text-texto-suave">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />O valor final é confirmado no salão.
          </p>
        )}
      </Bloco>

      <Bloco titulo="Profissional" para={original ? null : '/agendar'}>
        <p>{dados.nomeDoProfissional}</p>
      </Bloco>

      <Bloco titulo="Quando" para="/agendar/horario">
        <p className="flex items-start gap-2">
          <CalendarCheck className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
          <span>
            <span className="block font-semibold">{formatarDataLonga(horario.data)}</span>
            <span className="block">
              {formatarMinutos(horario.minutos)} às {formatarMinutos(horario.minutos + resumo.duracaoTotal)}
            </span>
          </span>
        </p>
        {original && (
          <p className="text-texto-suave">
            Antes: {formatarDataLonga(partesEmSaoPaulo(original.inicio).data)}, {partesEmSaoPaulo(original.inicio).hora}
          </p>
        )}
      </Bloco>

      <Bloco titulo="Seus dados" para={original ? null : '/agendar/dados'}>
        {cliente ? (
          <>
            <p>{cliente.nome}</p>
            <p>{formatarCelular(cliente.celular)}</p>
            {cliente.observacao && <p className="text-texto-suave">Observação: {cliente.observacao}</p>}
          </>
        ) : (
          <p className="text-texto-suave">Seus dados continuam os mesmos do agendamento.</p>
        )}
      </Bloco>

      {!original && (
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Pagamento</h2>
        {salao.pix_ativo && !pixIndisponivel ? (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Como você quer pagar?</legend>
            <OpcaoDePagamento
              valor="salao"
              escolhida={formaPagamento === 'salao'}
              aoEscolher={setFormaPagamento}
              titulo="Pagar no salão"
              detalhe="No dia do atendimento"
            />
            <OpcaoDePagamento
              valor="pix"
              escolhida={formaPagamento === 'pix'}
              aoEscolher={setFormaPagamento}
              titulo="Pix pelo app"
              detalhe="Pague agora pelo celular"
            />
            {formaPagamento === 'pix' && (
              <p role="status" className="flex items-start gap-2 rounded-2xl border-2 border-principal bg-superficie p-3">
                <Info className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />O pagamento por Pix vai ser
                feito no próximo passo, depois de confirmar.
              </p>
            )}
          </fieldset>
        ) : (
          <Card>
            <p className="flex items-center gap-3">
              <Store className="size-6 shrink-0 text-principal" aria-hidden="true" />
              Pagamento no salão, no dia do atendimento
            </p>
          </Card>
        )}
      </section>
      )}

      <RodapeFixo>
        {avisoDeTroca && (
          <p className="flex items-start gap-2 font-semibold text-principal" role="alert">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            {avisoDeTroca}
          </p>
        )}
        {erro && <MensagemErro texto={erro} />}
        {passouDoLimite && (
          <div className="grid grid-cols-2 gap-2">
            <Botao para="/meus-agendamentos">
              <CalendarDays className="size-5" aria-hidden="true" />
              Horários
            </Botao>
            {salao.whatsapp && (
              <Botao
                variante="secundario"
                linkExterno={linkDoWhatsapp(salao.whatsapp, 'Olá! Quero marcar mais um horário e o app diz que já tenho 3.')}
              >
                <MessageCircle className="size-5" aria-hidden="true" />
                WhatsApp
              </Botao>
            )}
          </div>
        )}
        <Botao
          variante={passouDoLimite ? 'secundario' : 'principal'}
          aoClicar={confirmar}
          carregando={confirmando}
          larguraTotal
          grande
        >
          {confirmando ? 'Confirmando...' : original ? 'Confirmar remarcação' : 'Confirmar agendamento'}
        </Botao>
      </RodapeFixo>
    </>
  )
}

export default AgendarConfirmacao
