import { CalendarCheck, CircleCheck, CircleX, UserX } from 'lucide-react'
import Chip from './Chip.jsx'

const status = {
  agendado: { texto: 'Agendado', variante: 'principal', icone: CalendarCheck },
  concluido: { texto: 'Concluído', variante: 'neutro', icone: CircleCheck },
  cancelado: { texto: 'Cancelado', variante: 'perigo', icone: CircleX },
  faltou: { texto: 'Faltou', variante: 'perigo', icone: UserX },
}

function ChipDeStatus({ valor }) {
  const dados = status[valor] || status.agendado
  return (
    <Chip variante={dados.variante} icone={dados.icone}>
      {dados.texto}
    </Chip>
  )
}

export default ChipDeStatus
