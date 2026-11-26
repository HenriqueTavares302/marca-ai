import { Link, useNavigate } from 'react-router-dom'
import Botao from '../../components/Botao.jsx'
import EmConstrucao from '../../components/EmConstrucao.jsx'

function Inicio() {
  const navegar = useNavigate()

  return (
    <>
      <section className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="text-3xl text-destaque" aria-hidden="true">
          ✦
        </span>
        <h2 className="text-3xl font-semibold text-principal">Seu horário no salão, em poucos toques.</h2>
      </section>
      <Botao larguraTotal aoClicar={() => navegar('/agendar')}>
        Agendar horário
      </Botao>
      <EmConstrucao texto="Aqui vai ficar a vitrine do salão, com fotos, serviços e avaliações." />
      <Link
        to="/salao"
        className="mx-auto flex min-h-12 items-center px-4 font-medium text-principal underline underline-offset-4"
      >
        Sou do salão
      </Link>
    </>
  )
}

export default Inicio
