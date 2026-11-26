import { Check } from 'lucide-react'

const estilosPorVariante = {
  neutro: 'border-texto-suave bg-superficie text-texto',
  principal: 'border-principal bg-superficie text-principal',
  perigo: 'border-perigo bg-superficie text-perigo',
}

function Chip({ children, variante = 'neutro', icone: Icone, aoClicar, selecionado = false }) {
  if (aoClicar) {
    const estilo = selecionado
      ? 'border-principal bg-principal text-sobre-principal'
      : 'border-texto-suave bg-superficie text-texto'

    return (
      <button
        type="button"
        onClick={aoClicar}
        aria-pressed={selecionado}
        className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border-2 px-5 font-medium whitespace-nowrap ${estilo}`}
      >
        {selecionado && <Check className="size-5" aria-hidden="true" />}
        {children}
      </button>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 font-medium ${estilosPorVariante[variante]}`}
    >
      {Icone && <Icone className="size-4" aria-hidden="true" />}
      {children}
    </span>
  )
}

export default Chip
