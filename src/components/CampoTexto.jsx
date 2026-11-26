import { useId } from 'react'
import MensagemErro from './MensagemErro.jsx'

function CampoTexto({
  id,
  rotulo,
  valor,
  aoMudar,
  aoSair,
  tipo = 'text',
  ajuda,
  erro,
  placeholder,
  obrigatorio = false,
  opcional = false,
  modoDeEntrada,
  autoCompletar,
  limite,
  multilinha = false,
}) {
  const idGerado = useId()
  const idDoCampo = id || idGerado
  const idAjuda = idDoCampo + '-ajuda'
  const idErro = idDoCampo + '-erro'
  const descricoes = []
  if (ajuda) descricoes.push(idAjuda)
  if (erro) descricoes.push(idErro)
  const corDaBorda = erro ? 'border-perigo' : 'border-texto-suave'

  const propriedades = {
    id: idDoCampo,
    value: valor,
    onChange: (evento) => aoMudar(evento.target.value),
    onBlur: aoSair,
    placeholder,
    required: obrigatorio,
    maxLength: limite,
    inputMode: modoDeEntrada,
    autoComplete: autoCompletar,
    'aria-invalid': erro ? true : undefined,
    'aria-describedby': descricoes.length > 0 ? descricoes.join(' ') : undefined,
    className: `rounded-xl border-2 bg-superficie px-4 text-texto placeholder:text-texto-suave ${corDaBorda} ${
      multilinha ? 'min-h-24 py-3' : 'min-h-12'
    }`,
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={idDoCampo} className="font-medium">
        {rotulo}
        {opcional && <span className="font-normal text-texto-suave"> (opcional)</span>}
      </label>
      {multilinha ? <textarea rows={3} {...propriedades} /> : <input type={tipo} {...propriedades} />}
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
