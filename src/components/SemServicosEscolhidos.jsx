import Botao from './Botao.jsx'
import Card from './Card.jsx'

function SemServicosEscolhidos() {
  return (
    <Card>
      <p className="font-semibold">Nenhum serviço escolhido ainda.</p>
      <p className="text-texto-suave">Escolha os serviços primeiro e depois continue o agendamento.</p>
      <Botao para="/servicos" larguraTotal>
        Escolher serviços
      </Botao>
    </Card>
  )
}

export default SemServicosEscolhidos
