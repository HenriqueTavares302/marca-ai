import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarCheck, Info, RotateCcw, Store } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import Card from '../../components/Card.jsx'
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
import {
  adicionarMeuAgendamento,
  carregarDadosDoCliente,
  carregarRemarcacao,
  encerrarRemarcacao,
  limparEscolha,
  salvarUltimoAgendamento,
  textoDaQuantidade,
  textoDoValorTotal,
} from '../../utils/agendamento.js'
import { apenasDigitosDoCelular, erroDoCelular, erroDoNome, formatarCelular } from '../../utils/cliente.js'
import { carregarResumoDoFluxo } from '../../utils/fluxo.js'
import { formatarDataLonga, formatarDuracao, formatarPreco } from '../../utils/formatos.js'
import { instanteEmSaoPaulo, partesEmSaoPaulo } from '../../utils/fuso.js'
import { formatarMinutos } from '../../utils/horariosLivres.js'

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
  const enviando = useRef(false)

  useEffect(() => {
    async function carregar() {
      const [fluxo, salao] = await Promise.all([carregarResumoDoFluxo(), buscarSalao()])
      const remarcacao = carregarRemarcacao()
      if (remarcacao) {
        const [original] = await listarMeusAgendamentos([remarcacao.agendamentoId])
        const cliente = original
          ? { nome: original.cliente.nome, celular: original.cliente.telefone, observacao: original.observacoes || '' }
          : null
        setDados({ ...fluxo, salao, cliente, remarcacao, original: original || null })
        return
      }
      setDados({ ...fluxo, salao, cliente: carregarDadosDoCliente(), remarcacao: null, original: null })
    }
    carregar()
  }, [])

  function irParaOPasso2() {
    navegar('/agendar/horario', { state: { aviso: 'Esse horário acabou de ser ocupado. Escolha outro.' } })
  }

  async function confirmar() {
    if (enviando.current) return
    enviando.current = true
    setConfirmando(true)
    setErro('')

    const { resumo, horario, cliente, profissionalEscolhidoId, original } = dados
    const servicoIds = resumo.itens.map((item) => item.servico.id)
    const livres = await listarHorariosLivres(
      horario.data,
      profissionalEscolhidoId,
      resumo.duracaoTotal,
      servicoIds,
      original ? original.id : null,
    )
    const vaga = livres.find((livre) => livre.minutos === horario.minutos)
    if (!vaga) {
      irParaOPasso2()
      return
    }
    const inicio = new Date(instanteEmSaoPaulo(horario.data, horario.minutos)).toISOString()

    if (original) {
      const remarcado = await remarcarAgendamento(original.id, vaga.profissionalId, inicio)
      if (remarcado.erro === 'horario_ocupado') {
        irParaOPasso2()
        return
      }
      if (remarcado.erro) {
        setErro(
          remarcado.erro === 'fora_do_prazo'
            ? 'Já passou do prazo para remarcar pelo app. Fale com o salão.'
            : 'Não conseguimos remarcar. Tente de novo.',
        )
        setConfirmando(false)
        enviando.current = false
        return
      }
      terminar(remarcado.agendamento, true)
      return
    }

    const resultado = await criarAgendamento({
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

    if (resultado.erro === 'horario_ocupado') {
      irParaOPasso2()
      return
    }
    if (resultado.erro) {
      setErro('Não conseguimos salvar o agendamento. Tente de novo.')
      setConfirmando(false)
      enviando.current = false
      return
    }

    adicionarMeuAgendamento(resultado.agendamento.id)
    terminar(resultado.agendamento, false)
  }

  function terminar(agendamento, remarcado) {
    salvarUltimoAgendamento({
      id: agendamento.id,
      inicio: agendamento.inicio,
      fim: agendamento.fim,
      servicos: dados.resumo.itens.map((item) => item.nome),
      profissional: agendamento.profissional.nome,
      valor: textoDoValorTotal(dados.resumo),
      formaPagamento: agendamento.forma_pagamento,
      remarcado,
    })
    limparEscolha()
    encerrarRemarcacao()
    navegar('/agendar/sucesso', { replace: true })
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

  const valorACombinar = resumo.aPartir || resumo.aCombinar
  const valorPrincipal = resumo.temValor
    ? (resumo.aPartir ? 'a partir de ' : '') + formatarPreco(resumo.valorTotal)
    : 'Valor a combinar'
  const valorExtra = resumo.temValor && resumo.aCombinar ? '+ valor a combinar' : ''

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
          {resumo.itens.map((item) => (
            <li key={item.servico.id} className="flex items-start justify-between gap-3 py-2">
              <span>
                <span className="block">{item.nome}</span>
                <span className="block text-texto-suave">{formatarDuracao(item.duracao_min)}</span>
              </span>
              <PrecoDoServico tipoPreco={item.servico.tipo_preco} preco={item.preco} />
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
        <p>{cliente.nome}</p>
        <p>{formatarCelular(cliente.celular)}</p>
        {cliente.observacao && <p className="text-texto-suave">Observação: {cliente.observacao}</p>}
      </Bloco>

      {!original && (
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Pagamento</h2>
        {salao.pix_ativo ? (
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
        {erro && <MensagemErro texto={erro} />}
        <Botao aoClicar={confirmar} carregando={confirmando} larguraTotal grande>
          {confirmando ? 'Confirmando...' : original ? 'Confirmar remarcação' : 'Confirmar agendamento'}
        </Botao>
      </RodapeFixo>
    </>
  )
}

export default AgendarConfirmacao
