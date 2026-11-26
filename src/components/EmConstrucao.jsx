import { Hammer } from 'lucide-react'
import Card from './Card.jsx'

function EmConstrucao({ texto }) {
  return (
    <Card>
      <p className="flex items-center gap-2 font-semibold">
        <Hammer className="size-5 text-destaque" aria-hidden="true" />
        Em construção
      </p>
      <p className="text-texto-suave">{texto}</p>
    </Card>
  )
}

export default EmConstrucao
