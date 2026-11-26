import { CalendarCheck, CalendarPlus, House, Scissors } from 'lucide-react'
import LayoutDaArea from '../components/LayoutDaArea.jsx'

const itensDoCliente = [
  { caminho: '/', rotulo: 'Início', titulo: 'Marca Aí', icone: House, exato: true },
  { caminho: '/servicos', rotulo: 'Serviços', titulo: 'Serviços', icone: Scissors },
  { caminho: '/agendar', rotulo: 'Agendar', titulo: 'Agendar horário', icone: CalendarPlus },
  { caminho: '/meus-agendamentos', rotulo: 'Horários', titulo: 'Meus agendamentos', icone: CalendarCheck },
]

function LayoutCliente() {
  return <LayoutDaArea itens={itensDoCliente} />
}

export default LayoutCliente
