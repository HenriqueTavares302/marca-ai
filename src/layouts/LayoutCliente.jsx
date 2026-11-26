import { CalendarCheck, House, Scissors } from 'lucide-react'
import LayoutDaArea from '../components/LayoutDaArea.jsx'
import { carregarRemarcacao } from '../utils/agendamento.js'

function tituloDoFluxo() {
  return carregarRemarcacao() ? 'Remarcar horário' : 'Agendar horário'
}

const itensDoCliente = [
  { caminho: '/', rotulo: 'Início', titulo: 'Marca Aí', icone: House, exato: true, semCabecalho: true },
  { caminho: '/servicos', rotulo: 'Serviços', titulo: 'Serviços', icone: Scissors },
  { caminho: '/meus-agendamentos', rotulo: 'Horários', titulo: 'Meus agendamentos', icone: CalendarCheck },
  { caminho: '/agendar', titulo: tituloDoFluxo, foraDaBarra: true, semBarra: true, comVoltar: true, voltarPara: '/servicos' },
  { caminho: '/agendar/horario', titulo: tituloDoFluxo, foraDaBarra: true, semBarra: true, comVoltar: true, voltarPara: '/agendar' },
  { caminho: '/agendar/dados', titulo: tituloDoFluxo, foraDaBarra: true, semBarra: true, comVoltar: true, voltarPara: '/agendar/horario' },
  {
    caminho: '/agendar/confirmacao',
    titulo: tituloDoFluxo,
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
