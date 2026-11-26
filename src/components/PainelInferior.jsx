import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

function PainelInferior({ aberto, titulo, subtitulo, aoFechar, children }) {
  const painel = useRef(null)
  const quemAbriu = useRef(null)
  const idDoTitulo = useId()

  useEffect(() => {
    const elemento = painel.current
    if (aberto && !elemento.open) {
      quemAbriu.current = document.activeElement
      elemento.showModal()
    }
    if (!aberto && elemento.open) {
      elemento.close()
    }
  }, [aberto])

  function aoFecharPainel() {
    aoFechar()
    const anterior = quemAbriu.current
    if (anterior && document.contains(anterior)) anterior.focus()
  }

  function fecharAoTocarFora(evento) {
    if (evento.target === painel.current) aoFechar()
  }

  return (
    <dialog
      ref={painel}
      onClose={aoFecharPainel}
      onClick={fecharAoTocarFora}
      aria-labelledby={idDoTitulo}
      className="mx-auto mt-auto mb-0 max-h-[90vh] w-full max-w-lg rounded-t-3xl bg-superficie p-0 text-texto backdrop:bg-capa/60"
    >
      {aberto && (
        <div className="flex flex-col gap-4 px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <span className="mx-auto h-1.5 w-12 rounded-full bg-borda" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={idDoTitulo} className="text-2xl font-semibold">
                {titulo}
              </h2>
              {subtitulo && <p className="text-texto-suave">{subtitulo}</p>}
            </div>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="flex size-12 shrink-0 items-center justify-center rounded-full"
            >
              <X className="size-6" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

export default PainelInferior
