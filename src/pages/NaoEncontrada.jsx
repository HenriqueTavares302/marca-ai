import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import Botao from '../components/Botao.jsx'
import BotaoTema from '../components/BotaoTema.jsx'
import Cabecalho from '../components/Cabecalho.jsx'

function NaoEncontrada() {
  const navegar = useNavigate()

  useEffect(() => {
    document.title = 'Página não encontrada · Marca Aí'
  }, [])

  return (
    <div className="min-h-screen">
      <Cabecalho titulo="Página não encontrada" acao={<BotaoTema />} />
      <main className="mx-auto flex max-w-lg flex-col items-center gap-4 p-6 text-center">
        <SearchX className="size-16 text-destaque" aria-hidden="true" />
        <p className="text-lg">Não achamos essa página. O endereço pode estar errado ou ter mudado.</p>
        <Botao larguraTotal aoClicar={() => navegar('/')}>
          Voltar ao início
        </Botao>
      </main>
    </div>
  )
}

export default NaoEncontrada
