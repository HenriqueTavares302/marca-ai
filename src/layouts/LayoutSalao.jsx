import { Navigate, useLocation } from 'react-router-dom'
import { CalendarDays, Scissors, Settings, Users } from 'lucide-react'
import LayoutDaArea from '../components/LayoutDaArea.jsx'
import { profissionalLogado } from '../utils/sessao.js'

const itensDoSalao = [
  { caminho: '/salao', rotulo: 'Agenda', titulo: 'Agenda', icone: CalendarDays, exato: true },
  { caminho: '/salao/servicos', rotulo: 'Serviços', titulo: 'Serviços do salão', icone: Scissors },
  { caminho: '/salao/clientes', rotulo: 'Clientes', titulo: 'Clientes', icone: Users },
  { caminho: '/salao/configuracoes', rotulo: 'Ajustes', titulo: 'Configurações', icone: Settings },
]

function LayoutSalao() {
  const { pathname } = useLocation()

  if (profissionalLogado() === null) {
    return <Navigate to="/salao/entrar" replace state={{ voltarPara: pathname }} />
  }

  return <LayoutDaArea itens={itensDoSalao} />
}

export default LayoutSalao
