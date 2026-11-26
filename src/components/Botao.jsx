import { LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

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
  para,
  linkExterno,
  desabilitado = false,
  carregando = false,
  larguraTotal = false,
  grande = false,
}) {
  const bloqueado = desabilitado || carregando
  const largura = larguraTotal ? 'w-full' : ''
  const tamanho = grande ? 'min-h-14 text-lg' : 'min-h-12'
  const classes = `inline-flex items-center justify-center gap-2 rounded-xl border-2 px-6 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${tamanho} ${estilosPorVariante[variante]} ${largura}`

  if (linkExterno) {
    return (
      <a href={linkExterno} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
        <span className="sr-only">(abre em outra janela)</span>
      </a>
    )
  }

  if (para) {
    return (
      <Link to={para} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button type={tipo} onClick={aoClicar} disabled={bloqueado} aria-busy={carregando} className={classes}>
      {carregando && <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

export default Botao
