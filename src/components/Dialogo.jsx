import { useEffect, useId, useRef } from 'react'

function Dialogo({ aberto, titulo, children, aoFechar }) {
  const dialogo = useRef(null)
  const quemAbriu = useRef(null)
  const idDoTitulo = useId()

  useEffect(() => {
    const elemento = dialogo.current
    if (aberto && !elemento.open) {
      quemAbriu.current = document.activeElement
      elemento.showModal()
    }
    if (!aberto && elemento.open) {
      elemento.close()
    }
  }, [aberto])

  function aoFecharDialogo() {
    aoFechar()
    const anterior = quemAbriu.current
    if (anterior && document.contains(anterior)) anterior.focus()
  }

  function fecharAoTocarFora(evento) {
    if (evento.target === dialogo.current) aoFechar()
  }

  return (
    <dialog
      ref={dialogo}
      onClose={aoFecharDialogo}
      onClick={fecharAoTocarFora}
      aria-labelledby={idDoTitulo}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-superficie p-0 text-texto backdrop:bg-capa/60"
    >
      {aberto && (
        <div className="flex flex-col gap-4 p-5">
          <h2 id={idDoTitulo} className="text-2xl font-semibold">
            {titulo}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  )
}

export default Dialogo
