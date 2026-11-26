import { ArrowRight } from 'lucide-react'
import Botao from './Botao.jsx'
import { formatarDuracao } from '../utils/formatos.js'
import { textoDaQuantidade, textoDoValorTotal } from '../utils/agendamento.js'

function ResumoDaEscolha({ resumo }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-borda bg-superficie">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1" aria-live="polite">
          <span className="block font-semibold">
            {textoDaQuantidade(resumo.quantidade)} · {formatarDuracao(resumo.duracaoTotal)}
          </span>
          <span className="block text-texto-suave">{textoDoValorTotal(resumo)}</span>
        </p>
        <Botao para="/agendar">
          Continuar
          <ArrowRight className="size-5" aria-hidden="true" />
        </Botao>
      </div>
    </div>
  )
}

export default ResumoDaEscolha
