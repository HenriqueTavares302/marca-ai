import { useState } from 'react'
import { CircleCheck, CircleX, MessageCircle, MessageSquareText, Phone, RotateCcw, UserX } from 'lucide-react'
import Botao from './Botao.jsx'
import CampoTexto from './CampoTexto.jsx'
import ChipDeStatus from './ChipDeStatus.jsx'
import Dialogo from './Dialogo.jsx'
import MensagemErro from './MensagemErro.jsx'
import OpcaoDeEscolha from './OpcaoDeEscolha.jsx'
import PainelInferior from './PainelInferior.jsx'
import PrecoDoServico from './PrecoDoServico.jsx'
import { atualizarStatusAgendamento } from '../data/consultas.js'
import { textoDoValor, tipoDoPrecoGuardado, valorDoAgendamento } from '../utils/agenda.js'
import { apenasDigitosDoCelular, formatarCelular } from '../utils/cliente.js'
import { formatarDataCurta, formatarDataLonga, formatarPreco, linkDoWhatsapp } from '../utils/formatos.js'
import { partesEmSaoPaulo } from '../utils/fuso.js'
import { formasRecebidas } from '../utils/resumo.js'
import { lerPreco, textoDoPreco } from '../utils/servico.js'

const estiloDeBotaoComoLink =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-principal bg-superficie px-4 font-semibold text-principal [&>svg]:shrink-0'

function primeiroNome(nome) {
  return nome.split(' ')[0]
}

function DetalheDoAtendimento({ agendamento, salao, salvando, aoMudarStatus, aoPedirConclusao, aoPedirCancelamento }) {
  const telefone = agendamento.cliente.telefone ? apenasDigitosDoCelular(agendamento.cliente.telefone) : ''
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

      {telefone ? (
        <>
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
        </>
      ) : (
        <p className="text-texto-suave">Os dados deste cliente foram removidos.</p>
      )}

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

      {agendamento.status === 'concluido' && agendamento.forma_recebida ? (
        <p>
          Recebido: <span className="font-semibold">{formatarPreco(agendamento.valor_total || 0)}</span> em{' '}
          {formasRecebidas.find((forma) => forma.valor === agendamento.forma_recebida).rotulo.toLowerCase()}
        </p>
      ) : (
        <p>
          Pagamento: {agendamento.forma_pagamento === 'pix' ? 'Pix pelo app' : 'no salão'} ·{' '}
          {agendamento.pago ? 'pago' : 'a pagar'}
        </p>
      )}

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
            <Botao carregando={salvando} aoClicar={aoPedirConclusao}>
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

function avisoDoValor(agendamento) {
  if (agendamento.servicos.some((item) => item.preco === null)) {
    return 'Tem serviço sob consulta: digite o valor combinado.'
  }
  if (agendamento.servicos.some((item) => tipoDoPrecoGuardado(item) === 'a_partir')) {
    return 'Tem serviço "a partir de": confirme o valor final.'
  }
  return ''
}

function ValorCobrado({ agendamento, salvando, aoConfirmar, aoVoltar }) {
  const [valor, setValor] = useState(textoDoPreco(agendamento.valor_total))
  const [forma, setForma] = useState('')
  const [tentou, setTentou] = useState(false)
  const aviso = avisoDoValor(agendamento)
  const lido = lerPreco(valor)
  const erroDoValor = lido === null ? 'Digite o valor cobrado, como 150,00.' : lido > 100000 ? 'Confira o valor.' : ''
  const erroDaForma = forma ? '' : 'Escolha como o cliente pagou.'

  function confirmar() {
    setTentou(true)
    if (erroDoValor) {
      document.getElementById('campo-valor-cobrado').focus()
      return
    }
    if (erroDaForma) {
      document.querySelector('input[name="forma-recebida"]').focus()
      return
    }
    aoConfirmar({ valor: lido, forma })
  }

  return (
    <>
      <p className="text-texto-suave">
        {agendamento.servicos
          .map((item) => (item.variacao ? item.servico.nome + ' · ' + item.variacao.nome : item.servico.nome))
          .join(' + ')}
      </p>
      <div className={aviso ? 'flex flex-col gap-2 rounded-2xl border-2 border-principal p-3' : ''}>
        {aviso && <p className="font-semibold text-principal">{aviso}</p>}
        <CampoTexto
          id="campo-valor-cobrado"
          rotulo="Valor cobrado (R$)"
          valor={valor}
          aoMudar={setValor}
          erro={tentou ? erroDoValor : ''}
          ajuda={'Valor do agendamento: ' + textoDoValor(valorDoAgendamento({ ...agendamento, status: 'agendado' }))}
          placeholder="Ex.: 150,00"
          modoDeEntrada="decimal"
          autoCompletar="off"
          limite={12}
        />
      </div>
      <fieldset className="grid grid-cols-2 gap-x-3">
        <legend className="mb-1 font-medium">
          Forma recebida <span className="font-normal text-texto-suave">(controle do salão)</span>
        </legend>
        {formasRecebidas.map((opcao) => (
          <OpcaoDeEscolha
            key={opcao.valor}
            nome="forma-recebida"
            valor={opcao.valor}
            marcado={forma === opcao.valor}
            aoMarcar={() => setForma(opcao.valor)}
            titulo={opcao.rotulo}
          />
        ))}
        {tentou && erroDaForma && (
          <div className="col-span-2">
            <MensagemErro texto={erroDaForma} />
          </div>
        )}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Botao variante="secundario" larguraTotal aoClicar={aoVoltar}>
          Voltar
        </Botao>
        <Botao larguraTotal carregando={salvando} aoClicar={confirmar}>
          {!salvando && <CircleCheck className="size-5" aria-hidden="true" />}
          Concluir
        </Botao>
      </div>
    </>
  )
}

function PainelDoAtendimento({ agendamento, salao, aoFechar, aoMudar }) {
  const [salvando, setSalvando] = useState(false)
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
  const [concluindo, setConcluindo] = useState(false)
  const aberto = agendamento && salao ? agendamento : null

  async function mudarStatus(id, novoStatus, mensagem, recebimento = null) {
    setSalvando(true)
    const resultado = await atualizarStatusAgendamento(id, novoStatus, recebimento)
    setSalvando(false)
    setConfirmandoCancelamento(false)
    setConcluindo(false)
    if (resultado.erro) {
      aoMudar({ erro: true, mensagem: 'Não conseguimos mudar o status. Tente de novo.' })
    } else {
      aoMudar({ erro: false, mensagem, status: novoStatus })
    }
  }

  return (
    <>
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
        aoFechar={aoFechar}
      >
        {aberto && (
          <DetalheDoAtendimento
            agendamento={aberto}
            salao={salao}
            salvando={salvando}
            aoMudarStatus={mudarStatus}
            aoPedirConclusao={() => setConcluindo(true)}
            aoPedirCancelamento={() => setConfirmandoCancelamento(true)}
          />
        )}
      </PainelInferior>

      <Dialogo aberto={concluindo && Boolean(aberto)} titulo="Valor cobrado" aoFechar={() => setConcluindo(false)}>
        {concluindo && aberto && (
          <ValorCobrado
            agendamento={aberto}
            salvando={salvando}
            aoVoltar={() => setConcluindo(false)}
            aoConfirmar={(recebimento) =>
              mudarStatus(
                aberto.id,
                'concluido',
                'Concluído: ' + formatarPreco(recebimento.valor) + ' recebido.',
                recebimento,
              )
            }
          />
        )}
      </Dialogo>

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
    </>
  )
}

export default PainelDoAtendimento
