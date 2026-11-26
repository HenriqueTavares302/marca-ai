import { CalendarDays, Scissors, Settings, Users } from 'lucide-react'
import LayoutDaArea from '../components/LayoutDaArea.jsx'

const itensDoSalao = [
  { caminho: '/salao', rotulo: 'Agenda', titulo: 'Agenda', icone: CalendarDays, exato: true },
  { caminho: '/salao/servicos', rotulo: 'Serviços', titulo: 'Serviços do salão', icone: Scissors },
  { caminho: '/salao/clientes', rotulo: 'Clientes', titulo: 'Clientes', icone: Users },
  { caminho: '/salao/configuracoes', rotulo: 'Ajustes', titulo: 'Configurações', icone: Settings },
]

function LayoutSalao() {
  return <LayoutDaArea itens={itensDoSalao} />
}

export default LayoutSalao
