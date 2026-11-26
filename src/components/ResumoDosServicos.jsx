import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { formatarDuracao } from '../utils/formatos.js'
import { textoDaQuantidade, textoDoValorTotal } from '../utils/agendamento.js'

function ResumoDosServicos({ resumo, nomeDoProfissional, quando, textoDoValor }) {
  return (
    <details className="group rounded-2xl border-2 border-borda bg-superficie">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-semibold">
            {textoDaQuantidade(resumo.quantidade)} · {formatarDuracao(resumo.duracaoTotal)}
          </span>
          <span className="block text-texto-suave">{textoDoValor || textoDoValorTotal(resumo)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-principal">
          <span className="group-open:hidden">Ver</span>
          <span className="hidden group-open:inline">Esconder</span>
          <ChevronDown className="size-5 group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>

      <div className="flex flex-col gap-1 border-t border-borda px-4 pt-2 pb-1">
        <ul className="divide-y divide-borda">
          {resumo.itens.map((item) => (
            <li key={item.servico.id} className="flex justify-between gap-3 py-2">
              <span>{item.nome}</span>
              <span className="shrink-0 text-texto-suave">{formatarDuracao(item.duracao_min)}</span>
            </li>
          ))}
        </ul>
        {nomeDoProfissional && <p className="py-2">Com: {nomeDoProfissional}</p>}
        {quando && <p className="pb-2">Quando: {quando}</p>}
        <Link
          to="/servicos"
          className="flex min-h-12 items-center font-semibold text-principal underline underline-offset-4"
        >
          Alterar serviços
        </Link>
      </div>
    </details>
  )
}

export default ResumoDosServicos
