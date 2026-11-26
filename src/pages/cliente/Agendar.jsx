import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Botao from '../../components/Botao.jsx'
import Card from '../../components/Card.jsx'
import EmConstrucao from '../../components/EmConstrucao.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import { listarServicosComVariacoes } from '../../data/consultas.js'
import { formatarDuracao } from '../../utils/formatos.js'
import { carregarEscolha, resumirEscolha, textoDaQuantidade, textoDoValorTotal } from '../../utils/agendamento.js'

function Agendar() {
  const [resumo, setResumo] = useState(null)

  useEffect(() => {
    async function carregar() {
      const servicos = await listarServicosComVariacoes()
      setResumo(resumirEscolha(carregarEscolha(), servicos))
    }
    carregar()
  }, [])

  if (!resumo) {
    return <Esqueleto classes="h-32 w-full" />
  }

  if (resumo.quantidade === 0) {
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

  return (
    <>
      <Card>
        <h2 className="text-xl font-semibold">Serviços escolhidos</h2>
        <ul className="divide-y divide-borda">
          {resumo.itens.map((item) => (
            <li key={item.servico.id} className="flex justify-between gap-3 py-2">
              <span>{item.nome}</span>
              <span className="text-texto-suave">{formatarDuracao(item.duracao_min)}</span>
            </li>
          ))}
        </ul>
        <p className="font-semibold">
          {textoDaQuantidade(resumo.quantidade)} · {formatarDuracao(resumo.duracaoTotal)} · {textoDoValorTotal(resumo)}
        </p>
        <Link
          to="/servicos"
          className="flex min-h-12 items-center font-semibold text-principal underline underline-offset-4"
        >
          Alterar serviços
        </Link>
      </Card>
      <EmConstrucao texto="Os próximos passos vêm aqui: escolher o profissional, a data e o horário, se identificar e confirmar." />
    </>
  )
}

export default Agendar
