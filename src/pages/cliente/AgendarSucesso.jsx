import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CalendarCheck, Check } from 'lucide-react'
import AcoesDoAgendamento from '../../components/AcoesDoAgendamento.jsx'
import Botao from '../../components/Botao.jsx'
import Card from '../../components/Card.jsx'
import { buscarSalao } from '../../data/consultas.js'
import { carregarUltimoAgendamento } from '../../utils/agendamento.js'
import { formatarDataLonga, mensagemParaOSalao } from '../../utils/formatos.js'
import { partesEmSaoPaulo } from '../../utils/fuso.js'

function AgendarSucesso() {
  const [ultimo] = useState(carregarUltimoAgendamento)
  const [salao, setSalao] = useState(null)

  useEffect(() => {
    async function carregar() {
      try {
        setSalao(await buscarSalao())
      } catch {
        setSalao(null)
      }
    }
    carregar()
  }, [])

  if (!ultimo) {
    return <Navigate to="/" replace />
  }

  const inicio = partesEmSaoPaulo(ultimo.inicio)
  const fim = partesEmSaoPaulo(ultimo.fim)
  const evento = salao && {
    id: ultimo.id,
    titulo: ultimo.servicos.join(' + ') + ' · ' + salao.nome,
    descricao: 'Com ' + ultimo.profissional + '. Valor: ' + ultimo.valor + '.',
    local: salao.endereco,
    inicio: ultimo.inicio,
    fim: ultimo.fim,
  }

  return (
    <>
      <section className="flex flex-col items-center gap-3 pt-4 text-center" role="status">
        <span className="flex size-20 items-center justify-center rounded-full bg-principal text-sobre-principal ring-4 ring-destaque ring-offset-4 ring-offset-fundo">
          <Check className="size-10" strokeWidth={3} aria-hidden="true" />
        </span>
        <h2 className="text-3xl font-semibold">{ultimo.remarcado ? 'Horário remarcado!' : 'Horário agendado!'}</h2>
        <p className="text-texto-suave">Te esperamos no salão.</p>
      </section>

      <Card>
        <p className="font-semibold">{ultimo.servicos.join(' + ')}</p>
        <p>Com {ultimo.profissional}</p>
        <p className="flex items-start gap-2">
          <CalendarCheck className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
          <span>
            <span className="block font-semibold">{formatarDataLonga(inicio.data)}</span>
            <span className="block">
              {inicio.hora} às {fim.hora}
            </span>
          </span>
        </p>
        <p className="text-texto-suave">
          {ultimo.valor} · {ultimo.formaPagamento === 'pix' ? 'Pix pelo app' : 'pagamento no salão'}
        </p>
        {evento && (
          <AcoesDoAgendamento
            evento={evento}
            nomeDoArquivo={'agendamento-' + inicio.data + '.ics'}
            salao={salao}
            mensagem={mensagemParaOSalao(salao, formatarDataLonga(inicio.data), inicio.hora, ultimo.servicos.join(' + '))}
          />
        )}
      </Card>

      <section className="flex flex-col gap-3">
        <Botao para="/meus-agendamentos" larguraTotal grande>
          Ver meus agendamentos
        </Botao>
        <Botao para="/" variante="secundario" larguraTotal>
          Voltar ao início
        </Botao>
      </section>
    </>
  )
}

export default AgendarSucesso
