import { LoaderCircle } from 'lucide-react'

const estilosPorVariante = {
  principal: 'border-principal bg-principal text-sobre-principal',
  secundario: 'border-principal bg-superficie text-principal',
  perigo: 'border-perigo bg-perigo text-sobre-perigo',
}

function Botao({
  children,
  variante = 'principal',
  tipo = 'button',
  aoClicar,
  desabilitado = false,
  carregando = false,
  larguraTotal = false,
}) {
  const bloqueado = desabilitado || carregando
  const largura = larguraTotal ? 'w-full' : ''

  return (
    <button
      type={tipo}
      onClick={aoClicar}
      disabled={bloqueado}
      aria-busy={carregando}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-6 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${estilosPorVariante[variante]} ${largura}`}
    >
      {carregando && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

export default Botao
