import { useEffect, useRef, useState } from 'react'

function FileiraRolavel({ children, rotulo, quantidade }) {
  const fileira = useRef(null)
  const [temMaisADireita, setTemMaisADireita] = useState(false)

  function verificarRolagem() {
    const elemento = fileira.current
    if (!elemento) return
    const falta = elemento.scrollWidth - elemento.clientWidth - elemento.scrollLeft
    setTemMaisADireita(falta > 1)
  }

  useEffect(() => {
    verificarRolagem()
    window.addEventListener('resize', verificarRolagem)
    return () => window.removeEventListener('resize', verificarRolagem)
  }, [quantidade])

  return (
    <div className="relative">
      <div
        ref={fileira}
        role="group"
        aria-label={rotulo}
        onScroll={verificarRolagem}
        className="flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {children}
      </div>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-fundo to-transparent motion-safe:transition-opacity ${
          temMaisADireita ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}

export default FileiraRolavel
