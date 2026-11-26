import { CalendarCheck, House, Scissors } from 'lucide-react'
import LayoutDaArea from '../components/LayoutDaArea.jsx'

const itensDoCliente = [
  { caminho: '/', rotulo: 'Início', titulo: 'Marca Aí', icone: House, exato: true, semCabecalho: true },
  { caminho: '/servicos', rotulo: 'Serviços', titulo: 'Serviços', icone: Scissors },
  { caminho: '/meus-agendamentos', rotulo: 'Horários', titulo: 'Meus agendamentos', icone: CalendarCheck },
  { caminho: '/agendar', titulo: 'Agendar horário', foraDaBarra: true, comVoltar: true, voltarPara: '/servicos' },
]

function LayoutCliente() {
  return <LayoutDaArea itens={itensDoCliente} />
}

export default LayoutCliente
