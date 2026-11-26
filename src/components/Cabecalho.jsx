import { ArrowLeft } from 'lucide-react'

function Cabecalho({ titulo, aoVoltar, acao }) {
  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-borda bg-fundo px-2">
      {aoVoltar && (
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-texto"
        >
          <ArrowLeft className="size-6" aria-hidden="true" />
        </button>
      )}
      <h1 className={`flex-1 truncate text-2xl font-semibold ${aoVoltar ? '' : 'pl-2'}`}>{titulo}</h1>
      {acao}
    </header>
  )
}

export default Cabecalho
