import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import CampoTexto from './CampoTexto.jsx'

function CampoSenha({ id, rotulo, valor, aoMudar, aoSair, erro, ajuda, autoCompletar }) {
  const [mostrar, setMostrar] = useState(false)

  return (
    <CampoTexto
      id={id}
      rotulo={rotulo}
      tipo={mostrar ? 'text' : 'password'}
      valor={valor}
      aoMudar={aoMudar}
      aoSair={aoSair}
      erro={erro}
      ajuda={ajuda}
      obrigatorio
      autoCompletar={autoCompletar}
      limite={128}
      acao={
        <button
          type="button"
          onClick={() => setMostrar(!mostrar)}
          aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}
          aria-pressed={mostrar}
          className="flex size-12 items-center justify-center rounded-xl text-texto-suave"
        >
          {mostrar ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
        </button>
      }
    />
  )
}

export default CampoSenha
