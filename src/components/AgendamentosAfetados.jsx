import { MessageCircle } from 'lucide-react'
import { formatarDataCurta, linkDoWhatsapp } from '../utils/formatos.js'
import { partesEmSaoPaulo } from '../utils/fuso.js'

function mensagemDeRemarcacao(agendamento, nomeDoSalao) {
  const inicio = partesEmSaoPaulo(agendamento.inicio)
  return (
    'Olá, ' +
    agendamento.cliente.nome.split(' ')[0] +
    '! Aqui é do ' +
    nomeDoSalao +
    '. Precisamos remarcar seu horário de ' +
    formatarDataCurta(inicio.data).toLowerCase() +
    ' às ' +
    inicio.hora +
    '. Qual outro horário fica bom para você?'
  )
}

function AgendamentosAfetados({ agendamentos, nomeDoSalao }) {
  return (
    <ul className="flex flex-col divide-y divide-borda rounded-2xl border-2 border-borda bg-superficie px-3">
      {agendamentos.map((agendamento) => {
        const inicio = partesEmSaoPaulo(agendamento.inicio)
        const nome = agendamento.cliente ? agendamento.cliente.nome : 'Cliente'
        return (
          <li key={agendamento.id} className="flex items-center justify-between gap-2 py-2">
            <span className="min-w-0">
              <span className="block font-semibold">
                {formatarDataCurta(inicio.data)} · {inicio.hora}
              </span>
              <span className="block text-texto-suave">{nome}</span>
            </span>
            {nomeDoSalao && agendamento.cliente && (
              <a
                href={linkDoWhatsapp('55' + agendamento.cliente.telefone, mensagemDeRemarcacao(agendamento, nomeDoSalao))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl border-2 border-principal px-3 font-semibold text-principal"
              >
                <MessageCircle className="size-5 shrink-0" aria-hidden="true" />
                WhatsApp
                <span className="sr-only">
                  para {nome} (abre em outra janela)
                </span>
              </a>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default AgendamentosAfetados
