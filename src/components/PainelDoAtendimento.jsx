import { useState } from 'react'
import { CircleCheck, CircleX, MessageCircle, MessageSquareText, Phone, RotateCcw, UserX } from 'lucide-react'
import Botao from './Botao.jsx'
import ChipDeStatus from './ChipDeStatus.jsx'
import Dialogo from './Dialogo.jsx'
import PainelInferior from './PainelInferior.jsx'
import PrecoDoServico from './PrecoDoServico.jsx'
import { atualizarStatusAgendamento } from '../data/consultas.js'
import { textoDoValor, tipoDoPrecoGuardado, valorDoAgendamento } from '../utils/agenda.js'
import { apenasDigitosDoCelular, formatarCelular } from '../utils/cliente.js'
import { formatarDataCurta, formatarDataLonga, linkDoWhatsapp } from '../utils/formatos.js'
import { partesEmSaoPaulo } from '../utils/fuso.js'

const estiloDeBotaoComoLink =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-principal bg-superficie px-4 font-semibold text-principal [&>svg]:shrink-0'

function primeiroNome(nome) {
  return nome.split(' ')[0]
}

function DetalheDoAtendimento({ agendamento, salao, salvando, aoMudarStatus, aoPedirCancelamento }) {
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

function PainelDoAtendimento({ agendamento, salao, aoFechar, aoMudar }) {
  const [salvando, setSalvando] = useState(false)
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
  const aberto = agendamento && salao ? agendamento : null

  async function mudarStatus(id, novoStatus, mensagem) {
    setSalvando(true)
    const resultado = await atualizarStatusAgendamento(id, novoStatus)
    setSalvando(false)
    setConfirmandoCancelamento(false)
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
    </>
  )
}

export default PainelDoAtendimento
