import { Check, Users } from 'lucide-react'

function iniciais(nome) {
  const partes = nome.trim().split(' ')
  const primeira = partes[0].charAt(0)
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : ''
  return (primeira + ultima).toUpperCase()
}

function CardProfissional({ nome, detalhe, fotoUrl, valor, qualquer = false, escolhido, aoEscolher }) {
  const corDaBorda = escolhido ? 'border-principal' : 'border-borda'

  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={escolhido}
      className={`flex min-h-20 w-full items-center gap-4 rounded-2xl border-2 bg-superficie p-4 text-left ${corDaBorda}`}
    >
      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-capa text-lg font-semibold text-sobre-capa ring-2 ring-destaque ring-offset-2 ring-offset-superficie">
        {qualquer && <Users className="size-6" aria-hidden="true" />}
        {!qualquer && fotoUrl && <img src={fotoUrl} alt="" className="size-full object-cover" />}
        {!qualquer && !fotoUrl && <span aria-hidden="true">{iniciais(nome)}</span>}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-lg font-semibold">{nome}</span>
        <span className="text-texto-suave">{detalhe}</span>
        {valor && (
          <span className="font-semibold">
            <span className="sr-only">Total: </span>
            {valor}
          </span>
        )}
        {escolhido && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full border-2 border-principal bg-principal px-3 py-0.5 font-semibold text-sobre-principal">
            <Check className="size-4" aria-hidden="true" />
            Escolhido
          </span>
        )}
      </span>
    </button>
  )
}

export default CardProfissional
