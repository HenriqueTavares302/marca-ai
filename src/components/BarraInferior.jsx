import { NavLink } from 'react-router-dom'

function BarraInferior({ itens }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-lg">
        {itens.map((item) => {
          const Icone = item.icone

          return (
            <li key={item.caminho} className="flex-1">
              <NavLink
                to={item.caminho}
                end={item.exato}
                className={({ isActive }) =>
                  `relative flex min-h-16 w-full flex-col items-center justify-center gap-1 text-sm whitespace-nowrap ${
                    isActive ? 'font-semibold text-principal' : 'text-texto-suave'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-0 h-1 w-10 rounded-b-full bg-principal" aria-hidden="true" />
                    )}
                    <Icone className="size-6" strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
                    {item.rotulo}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default BarraInferior
