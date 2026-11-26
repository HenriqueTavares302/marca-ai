import { Link } from 'react-router-dom'
import EmConstrucao from '../../components/EmConstrucao.jsx'

function Configuracoes() {
  return (
    <>
      <EmConstrucao texto="Aqui vão ficar os dados do salão, os profissionais e os horários de funcionamento." />
      <Link
        to="/"
        className="mx-auto flex min-h-12 items-center px-4 font-medium text-principal underline underline-offset-4"
      >
        Ver como cliente
      </Link>
    </>
  )
}

export default Configuracoes
