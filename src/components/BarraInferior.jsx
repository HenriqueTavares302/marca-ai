function BarraInferior({ itens, atual, aoEscolher }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-lg">
        {itens.map((item) => {
          const ativo = item.id === atual
          const Icone = item.icone
          const estilo = ativo ? 'font-semibold text-principal' : 'text-texto-suave'

          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => aoEscolher(item.id)}
                aria-current={ativo ? 'page' : undefined}
                className={`relative flex min-h-16 w-full flex-col items-center justify-center gap-1 text-sm whitespace-nowrap ${estilo}`}
              >
                {ativo && (
                  <span className="absolute top-0 h-1 w-10 rounded-b-full bg-principal" aria-hidden="true" />
                )}
                <Icone className="size-6" strokeWidth={ativo ? 2.5 : 2} aria-hidden="true" />
                {item.rotulo}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default BarraInferior
