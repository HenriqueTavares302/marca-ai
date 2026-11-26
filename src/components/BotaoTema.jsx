import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

function temaInicial() {
  return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro'
}

function BotaoTema({ redondo = false }) {
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

  if (redondo) {
    const Icone = tema === 'escuro' ? Sun : Moon
    return (
      <button
        type="button"
        onClick={trocarTema}
        aria-label={tema === 'escuro' ? 'Ativar modo claro' : 'Ativar modo escuro'}
        className="flex size-12 items-center justify-center rounded-full border border-sobre-capa/30 bg-sobre-capa/10 text-sobre-capa focus-visible:outline-sobre-capa"
      >
        <Icone className="size-5" aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={trocarTema}
      className="min-h-12 rounded-full border border-borda bg-superficie px-5 font-medium text-texto"
    >
      {tema === 'escuro' ? '☀ Modo claro' : '☾ Modo escuro'}
    </button>
  )
}

export default BotaoTema
