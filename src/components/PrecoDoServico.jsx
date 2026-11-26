import { formatarPreco } from '../utils/formatos.js'

function PrecoDoServico({ tipoPreco, preco }) {
  if (tipoPreco === 'consulta' || preco === null) {
    return <span className="block text-right font-semibold">Sob consulta</span>
  }

  return (
    <span className="block text-right font-semibold">
      {tipoPreco === 'a_partir' && <span className="block font-normal text-texto-suave">a partir de</span>}
      {formatarPreco(preco)}
    </span>
  )
}

export default PrecoDoServico
