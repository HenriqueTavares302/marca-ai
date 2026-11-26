import { CircleAlert } from 'lucide-react'

function MensagemErro({ id, texto }) {
  return (
    <p id={id} className="flex items-center gap-2 font-medium text-perigo">
      <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
      {texto}
    </p>
  )
}

export default MensagemErro
