import { useState } from 'react'
import { CalendarPlus, Download, MessageCircle } from 'lucide-react'
import Botao from './Botao.jsx'
import Dialogo from './Dialogo.jsx'
import { baixarArquivoDeAgenda, gerarArquivoDeAgenda, linkDoGoogleAgenda } from '../utils/calendario.js'
import { linkDoWhatsapp } from '../utils/formatos.js'

const estiloDoBotaoDeTexto =
  'flex min-h-12 items-center justify-center gap-2 px-1 text-center font-semibold text-principal underline underline-offset-4 [&>svg]:shrink-0'

function AcoesDoAgendamento({ evento, nomeDoArquivo, salao, mensagem, mostrarWhatsapp = true }) {
  const [escolhendoAgenda, setEscolhendoAgenda] = useState(false)

  function baixar() {
    baixarArquivoDeAgenda(gerarArquivoDeAgenda(evento), nomeDoArquivo)
    setEscolhendoAgenda(false)
  }

  return (
    <div className={`grid gap-2 ${mostrarWhatsapp ? 'grid-cols-2' : 'grid-cols-1'}`}>
      <button type="button" onClick={() => setEscolhendoAgenda(true)} className={estiloDoBotaoDeTexto}>
        <CalendarPlus className="size-5" aria-hidden="true" />
        Adicionar à agenda
      </button>

      {mostrarWhatsapp && (
        <a
          href={linkDoWhatsapp(salao.whatsapp, mensagem)}
          target="_blank"
          rel="noopener noreferrer"
          className={estiloDoBotaoDeTexto}
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          Falar com o salão
          <span className="sr-only">(abre em outra janela)</span>
        </a>
      )}

      <Dialogo aberto={escolhendoAgenda} titulo="Adicionar à agenda" aoFechar={() => setEscolhendoAgenda(false)}>
        <p className="text-texto-suave">Escolha onde guardar o lembrete do horário.</p>
        <div className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal aoClicar={baixar}>
            <Download className="size-5" aria-hidden="true" />
            Agenda do celular (.ics)
          </Botao>
          <Botao variante="secundario" larguraTotal linkExterno={linkDoGoogleAgenda(evento)}>
            <CalendarPlus className="size-5" aria-hidden="true" />
            Google Agenda
          </Botao>
          <button
            type="button"
            onClick={() => setEscolhendoAgenda(false)}
            className="min-h-12 font-semibold text-principal underline underline-offset-4"
          >
            Fechar
          </button>
        </div>
      </Dialogo>
    </div>
  )
}

export default AcoesDoAgendamento
