import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { CalendarDays, Scissors, Settings, Users } from 'lucide-react'
import LayoutDaArea from '../components/LayoutDaArea.jsx'
import { aoSairDaConta, conferirSessao, profissionalLogado } from '../utils/sessao.js'

const itensDoSalao = [
  { caminho: '/salao', rotulo: 'Agenda', titulo: 'Agenda', icone: CalendarDays, exato: true },
  { caminho: '/salao/servicos', rotulo: 'Serviços', titulo: 'Serviços do salão', icone: Scissors },
  { caminho: '/salao/clientes', rotulo: 'Clientes', titulo: 'Clientes', icone: Users },
  { caminho: '/salao/configuracoes', rotulo: 'Ajustes', titulo: 'Configurações', icone: Settings },
  {
    caminho: '/salao/novo',
    titulo: 'Novo agendamento',
    foraDaBarra: true,
    semBarra: true,
    comVoltar: true,
    voltarPara: '/salao',
  },
  {
    caminho: '/salao/resumo',
    titulo: 'Resumo',
    foraDaBarra: true,
    comVoltar: true,
    voltarPara: '/salao',
  },
  {
    caminho: '/salao/servicos/novo',
    titulo: 'Novo serviço',
    foraDaBarra: true,
    semBarra: true,
    comVoltar: true,
    voltarPara: '/salao/servicos',
  },
  {
    caminho: '/salao/servicos/:id',
    titulo: 'Editar serviço',
    foraDaBarra: true,
    semBarra: true,
    comVoltar: true,
    voltarPara: '/salao/servicos',
  },
  {
    caminho: '/salao/clientes/novo',
    titulo: 'Novo cliente',
    foraDaBarra: true,
    semBarra: true,
    comVoltar: true,
    voltarPara: '/salao/clientes',
  },
  {
    caminho: '/salao/clientes/:id/editar',
    titulo: 'Editar cliente',
    foraDaBarra: true,
    semBarra: true,
    comVoltar: true,
    voltarPara: '/salao/clientes',
  },
  {
    caminho: '/salao/clientes/:id',
    titulo: 'Cliente',
    foraDaBarra: true,
    comVoltar: true,
    voltarPara: '/salao/clientes',
  },
  {
    caminho: '/salao/configuracoes/horarios',
    titulo: 'Horários',
    foraDaBarra: true,
    semBarra: true,
    comVoltar: true,
    voltarPara: '/salao/configuracoes',
  },
  {
    caminho: '/salao/configuracoes/bloqueios',
    titulo: 'Folgas e bloqueios',
    foraDaBarra: true,
    comVoltar: true,
    voltarPara: '/salao/configuracoes',
  },
  {
    caminho: '/salao/configuracoes/bloqueios/novo',
    titulo: 'Novo bloqueio',
    foraDaBarra: true,
    semBarra: true,
    comVoltar: true,
    voltarPara: '/salao/configuracoes/bloqueios',
  },
]

function LayoutSalao() {
  const { pathname } = useLocation()
  const [semSessao, setSemSessao] = useState(profissionalLogado() === null)

  useEffect(() => {
    let ativo = true
    async function conferir() {
      const perfil = await conferirSessao()
      if (ativo && !perfil) setSemSessao(true)
    }
    conferir()
    const pararDeOuvir = aoSairDaConta(() => {
      if (ativo) setSemSessao(true)
    })
    return () => {
      ativo = false
      pararDeOuvir()
    }
  }, [])

  if (semSessao || profissionalLogado() === null) {
    return <Navigate to="/salao/entrar" replace state={{ voltarPara: pathname }} />
  }

  return <LayoutDaArea itens={itensDoSalao} />
}

export default LayoutSalao
