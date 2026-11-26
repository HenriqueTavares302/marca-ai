import { useEffect, useLayoutEffect, useRef, useState } from 'react'

function RodapeFixo({ children }) {
  const rodape = useRef(null)
  const [altura, setAltura] = useState(0)

  useLayoutEffect(() => {
    setAltura(rodape.current.offsetHeight)
  }, [children])

  useEffect(() => {
    const elemento = rodape.current
    const observador = new ResizeObserver(() => setAltura(elemento.offsetHeight))
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  return (
    <>
      <div style={{ height: altura }} aria-hidden="true" />
      <div
        ref={rodape}
        id="rodape-fixo"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex max-w-lg flex-col gap-2 px-4 py-3">{children}</div>
      </div>
    </>
  )
}

export default RodapeFixo
