import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BotaoTema from './BotaoTema.jsx'
import { buscarSalao } from '../data/consultas.js'

function TelaDeAcesso({ titulo, voltarPara, textoDoVoltar, children }) {
  const [salao, setSalao] = useState(null)

  useEffect(() => {
    document.title = titulo + ' · Marca Aí'
    async function carregar() {
      try {
        setSalao(await buscarSalao())
      } catch {
        setSalao(null)
      }
    }
    carregar()
  }, [titulo])

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 pt-4 pb-10">
        <div className="flex items-center justify-between">
          <Link
            to={voltarPara}
            className="flex min-h-12 items-center gap-2 font-semibold text-principal underline underline-offset-4"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
            {textoDoVoltar}
          </Link>
          <BotaoTema />
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="flex size-16 items-center justify-center rounded-full bg-capa text-2xl text-destaque ring-2 ring-destaque ring-offset-2 ring-offset-fundo"
            aria-hidden="true"
          >
            ✦
          </span>
          <p className="text-texto-suave">{salao ? salao.nome : ' '}</p>
          <h1 className="text-3xl font-semibold">{titulo}</h1>
        </div>

        {children}
      </div>
    </div>
  )
}

export default TelaDeAcesso
