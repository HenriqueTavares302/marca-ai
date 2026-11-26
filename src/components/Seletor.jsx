import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import MensagemErro from './MensagemErro.jsx'

function Seletor({ rotulo, valor, aoMudar, opcoes, ajuda, erro, textoVazio = 'Escolha uma opção' }) {
  const id = useId()
  const idAjuda = id + '-ajuda'
  const idErro = id + '-erro'
  const descricoes = []
  if (ajuda) descricoes.push(idAjuda)
  if (erro) descricoes.push(idErro)
  const corDaBorda = erro ? 'border-perigo' : 'border-texto-suave'

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {rotulo}
      </label>
      <div className="relative">
        <select
          id={id}
          value={valor}
          onChange={(evento) => aoMudar(evento.target.value)}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricoes.length > 0 ? descricoes.join(' ') : undefined}
          className={`min-h-12 w-full appearance-none rounded-xl border-2 bg-superficie pr-12 pl-4 text-texto ${corDaBorda}`}
        >
          <option value="">{textoVazio}</option>
          {opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-texto-suave"
          aria-hidden="true"
        />
      </div>
      {ajuda && (
        <p id={idAjuda} className="text-texto-suave">
          {ajuda}
        </p>
      )}
      {erro && <MensagemErro id={idErro} texto={erro} />}
    </div>
  )
}

export default Seletor
