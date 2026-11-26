import { useEffect } from 'react'
import { Navigate, Outlet, matchPath, useLocation, useNavigate } from 'react-router-dom'
import BarraInferior from './BarraInferior.jsx'
import BotaoTema from './BotaoTema.jsx'
import Cabecalho from './Cabecalho.jsx'

function LayoutDaArea({ itens }) {
  const { pathname } = useLocation()
  const navegar = useNavigate()
  const caminho = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
  const itemAtual = itens.find((item) => matchPath(item.caminho, caminho))
  let titulo = 'Marca Aí'
  if (itemAtual) {
    titulo = typeof itemAtual.titulo === 'function' ? itemAtual.titulo() : itemAtual.titulo
  }
  const itensDaBarra = itens.filter((item) => !item.foraDaBarra)

  useEffect(() => {
    document.title = titulo === 'Marca Aí' ? 'Marca Aí' : titulo + ' · Marca Aí'
  }, [titulo])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (caminho !== pathname) {
    return <Navigate to={caminho} replace />
  }

  function voltar() {
    const temPaginaAnterior = window.history.state && window.history.state.idx > 0
    if (temPaginaAnterior) {
      navegar(-1)
    } else {
      navegar(itemAtual.voltarPara)
    }
  }

  const mostrarCabecalho = !(itemAtual && itemAtual.semCabecalho)
  const mostrarBarra = !(itemAtual && itemAtual.semBarra)
  const aoVoltar = itemAtual && itemAtual.comVoltar ? voltar : undefined

  return (
    <div className={`min-h-screen ${mostrarBarra ? 'pb-[calc(7rem+env(safe-area-inset-bottom))]' : 'pb-4'}`}>
      {mostrarCabecalho && <Cabecalho titulo={titulo} aoVoltar={aoVoltar} acao={<BotaoTema />} />}
      <main className="mx-auto flex max-w-lg flex-col gap-6 p-4">
        <Outlet />
      </main>
      {mostrarBarra && <BarraInferior itens={itensDaBarra} />}
    </div>
  )
}

export default LayoutDaArea
