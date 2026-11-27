import { Info } from 'lucide-react'

function AvisoDaVolta({ texto }) {
  if (!texto) return null
  return (
    <p role="status" className="flex items-start gap-2 rounded-2xl border-2 border-principal bg-superficie p-3">
      <Info className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
      {texto}
    </p>
  )
}

export default AvisoDaVolta
