import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarOff, ChevronRight, Clock, LogOut, Store } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import { sair } from '../../utils/sessao.js'

const itensDoMenu = [
  {
    caminho: '/salao/configuracoes/horarios',
    titulo: 'Horários de trabalho',
    explicacao: 'Dias e horas que cada profissional atende.',
    icone: Clock,
  },
  {
    caminho: '/salao/configuracoes/bloqueios',
    titulo: 'Folgas e bloqueios',
    explicacao: 'Férias, folgas e compromissos.',
    icone: CalendarOff,
  },
  {
    caminho: '/',
    titulo: 'Ver como cliente',
    explicacao: 'Abre a vitrine do salão.',
    icone: Store,
  },
]

function Configuracoes() {
  const navegar = useNavigate()
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)

  function confirmarSaida() {
    sair()
    navegar('/', { replace: true })
  }

  return (
    <>
      <nav aria-label="Ajustes">
        <ul className="flex flex-col gap-3">
          {itensDoMenu.map((item) => (
            <li key={item.caminho}>
              <Link
                to={item.caminho}
                className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-borda bg-superficie p-3"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-capa text-destaque">
                  <item.icone className="size-6" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{item.titulo}</span>
                  <span className="text-texto-suave">{item.explicacao}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Botao variante="secundario" larguraTotal aoClicar={() => setConfirmandoSaida(true)}>
        <LogOut className="size-5" aria-hidden="true" />
        Sair
      </Botao>

      <Dialogo aberto={confirmandoSaida} titulo="Sair da área do salão?" aoFechar={() => setConfirmandoSaida(false)}>
        <p className="text-texto-suave">Para voltar, você vai precisar entrar de novo.</p>
        <div className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal aoClicar={() => setConfirmandoSaida(false)}>
            Continuar no salão
          </Botao>
          <Botao larguraTotal aoClicar={confirmarSaida}>
            <LogOut className="size-5" aria-hidden="true" />
            Sim, sair
          </Botao>
        </div>
      </Dialogo>
    </>
  )
}

export default Configuracoes
