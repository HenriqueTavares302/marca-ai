import { useId } from 'react'
import MensagemErro from './MensagemErro.jsx'

function CampoTexto({ rotulo, valor, aoMudar, tipo = 'text', ajuda, erro, placeholder }) {
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
      <input
        id={id}
        type={tipo}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        placeholder={placeholder}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricoes.length > 0 ? descricoes.join(' ') : undefined}
        className={`min-h-12 rounded-xl border-2 bg-superficie px-4 text-texto placeholder:text-texto-suave ${corDaBorda}`}
      />
      {ajuda && (
        <p id={idAjuda} className="text-texto-suave">
          {ajuda}
        </p>
      )}
      {erro && <MensagemErro id={idErro} texto={erro} />}
    </div>
  )
}

export default CampoTexto
