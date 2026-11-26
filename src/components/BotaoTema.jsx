import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

function temaInicial() {
  return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro'
}

function BotaoTema({ naCapa = false }) {
  const [tema, setTema] = useState(temaInicial)

  useEffect(() => {
    if (tema === 'escuro') {
      document.documentElement.dataset.tema = 'escuro'
    } else {
      delete document.documentElement.dataset.tema
    }
    try {
      localStorage.setItem('tema', tema)
    } catch {
      return
    }
  }, [tema])

  function trocarTema() {
    setTema(tema === 'escuro' ? 'claro' : 'escuro')
  }

  const Icone = tema === 'escuro' ? Sun : Moon
  const cores = naCapa
    ? 'border-sobre-capa/30 bg-sobre-capa/10 text-sobre-capa focus-visible:outline-sobre-capa'
    : 'border-borda bg-superficie text-texto'

  return (
    <button
      type="button"
      onClick={trocarTema}
      aria-label={tema === 'escuro' ? 'Ativar modo claro' : 'Ativar modo escuro'}
      className={`flex size-12 shrink-0 items-center justify-center rounded-full border ${cores}`}
    >
      <Icone className="size-5" aria-hidden="true" />
    </button>
  )
}

export default BotaoTema
