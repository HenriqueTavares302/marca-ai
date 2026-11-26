import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import BarraInferior from './BarraInferior.jsx'
import BotaoTema from './BotaoTema.jsx'
import Cabecalho from './Cabecalho.jsx'

function LayoutDaArea({ itens }) {
  const { pathname } = useLocation()
  const caminho = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  const itemAtual = itens.find((item) => item.caminho === caminho)
  const titulo = itemAtual ? itemAtual.titulo : 'Marca Aí'

  useEffect(() => {
    document.title = titulo === 'Marca Aí' ? 'Marca Aí' : titulo + ' · Marca Aí'
  }, [titulo])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (caminho !== pathname) {
    return <Navigate to={caminho} replace />
  }

  return (
    <div className="min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <Cabecalho titulo={titulo} acao={<BotaoTema />} />
      <main className="mx-auto flex max-w-lg flex-col gap-6 p-4">
        <Outlet />
      </main>
      <BarraInferior itens={itens} />
    </div>
  )
}

export default LayoutDaArea
