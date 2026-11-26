import { useEffect, useState } from 'react'

function temaInicial() {
  return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro'
}

function BotaoTema() {
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
