import BotaoTema from './BotaoTema.jsx'

function Ornamento() {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      className="pointer-events-none absolute -top-20 -right-24 size-80 text-destaque opacity-60"
    >
      <circle cx="120" cy="120" r="46" strokeWidth="1.25" />
      <circle cx="120" cy="120" r="70" strokeWidth="1" />
      <circle cx="120" cy="120" r="94" strokeWidth="0.75" />
      <circle cx="120" cy="120" r="116" strokeWidth="0.5" />
      <path d="M120 104 L124 116 L136 120 L124 124 L120 136 L116 124 L104 120 L116 116 Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

function CapaDoSalao({ nome, descricao, fotoUrl, carregando }) {
  return (
    <section className="relative -mx-4 -mt-4 overflow-hidden rounded-b-[2rem] bg-capa text-sobre-capa">
      {fotoUrl ? (
        <>
          <img src={fotoUrl} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-capa/70" aria-hidden="true" />
        </>
      ) : (
        <Ornamento />
      )}

      <div className="relative flex min-h-56 flex-col justify-between gap-8 px-5 pt-4 pb-7">
        <div className="flex justify-end">
          <BotaoTema naCapa />
        </div>

        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-destaque" aria-hidden="true">
            <span className="h-px w-10 bg-destaque" />✦
          </span>
          {carregando ? (
            <>
              <span className="h-10 w-3/4 rounded-lg bg-sobre-capa/20 motion-safe:animate-pulse" />
              <span className="h-5 w-2/3 rounded-lg bg-sobre-capa/15 motion-safe:animate-pulse" />
            </>
          ) : (
            <>
              <h1 className="text-4xl font-semibold">{nome}</h1>
              <p className="text-sobre-capa/90">{descricao}</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

export default CapaDoSalao
