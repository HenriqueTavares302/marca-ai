import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import EmConstrucao from '../../components/EmConstrucao.jsx'
import { sair } from '../../utils/sessao.js'

function Configuracoes() {
  const navegar = useNavigate()
  const [confirmandoSaida, setConfirmandoSaida] = useState(false)

  function confirmarSaida() {
    sair()
    navegar('/', { replace: true })
  }

  return (
    <>
      <EmConstrucao texto="Aqui vão ficar os dados do salão, os profissionais e os horários de funcionamento." />

      <Link
        to="/"
        className="mx-auto flex min-h-12 items-center px-4 font-medium text-principal underline underline-offset-4"
      >
        Ver como cliente
      </Link>

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
