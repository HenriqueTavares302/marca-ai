import { CalendarCheck, House, Scissors } from 'lucide-react'
import LayoutDaArea from '../components/LayoutDaArea.jsx'

const itensDoCliente = [
  { caminho: '/', rotulo: 'Início', titulo: 'Marca Aí', icone: House, exato: true, semCabecalho: true },
  { caminho: '/servicos', rotulo: 'Serviços', titulo: 'Serviços', icone: Scissors },
  { caminho: '/meus-agendamentos', rotulo: 'Horários', titulo: 'Meus agendamentos', icone: CalendarCheck },
  { caminho: '/agendar', titulo: 'Agendar horário', foraDaBarra: true, semBarra: true, comVoltar: true, voltarPara: '/servicos' },
  { caminho: '/agendar/horario', titulo: 'Agendar horário', foraDaBarra: true, semBarra: true, comVoltar: true, voltarPara: '/agendar' },
  { caminho: '/agendar/dados', titulo: 'Agendar horário', foraDaBarra: true, semBarra: true, comVoltar: true, voltarPara: '/agendar/horario' },
  {
    caminho: '/agendar/confirmacao',
    titulo: 'Agendar horário',
    foraDaBarra: true,
    semBarra: true,
    comVoltar: true,
    voltarPara: '/agendar/dados',
  },
  { caminho: '/agendar/sucesso', titulo: 'Confirmado', foraDaBarra: true },
]

function LayoutCliente() {
  return <LayoutDaArea itens={itensDoCliente} />
}

export default LayoutCliente
