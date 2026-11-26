import { Check } from 'lucide-react'
import { formatarDataLonga, nomeCurtoDoDia, numeroDoDia } from '../utils/formatos.js'
import { somarDias } from '../utils/fuso.js'

function DiaDaFaixa({ data, hoje, aberto, selecionado, aoEscolher }) {
  let rotulo = nomeCurtoDoDia(data)
  if (data === hoje) rotulo = 'Hoje'
  if (data === somarDias(hoje, 1)) rotulo = 'Amanhã'

  if (!aberto) {
    return (
      <span
        id={'dia-' + data}
        className="flex min-h-20 w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-texto-suave px-1 text-texto-suave"
      >
        <span>{rotulo}</span>
        <span className="text-lg font-semibold">{numeroDoDia(data)}</span>
        <span>Fechado</span>
      </span>
    )
  }

  const cores = selecionado
    ? 'border-principal bg-principal text-sobre-principal'
    : 'border-texto-suave bg-superficie text-texto'

  return (
    <button
      id={'dia-' + data}
      type="button"
      onClick={aoEscolher}
      aria-pressed={selecionado}
      aria-label={formatarDataLonga(data) + (rotulo === 'Hoje' || rotulo === 'Amanhã' ? ', ' + rotulo.toLowerCase() : '')}
      className={`flex min-h-20 w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-2xl border-2 px-1 ${cores}`}
    >
      <span>{rotulo}</span>
      <span className="text-lg font-semibold">{numeroDoDia(data)}</span>
      <span className="flex h-6 items-center">{selecionado && <Check className="size-5" aria-hidden="true" />}</span>
    </button>
  )
}

export default DiaDaFaixa
