import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import EmConstrucao from '../../components/EmConstrucao.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import IndicadorDePassos from '../../components/IndicadorDePassos.jsx'
import ResumoDosServicos from '../../components/ResumoDosServicos.jsx'
import RodapeFixo from '../../components/RodapeFixo.jsx'
import SemServicosEscolhidos from '../../components/SemServicosEscolhidos.jsx'
import { buscarProfissional, listarServicosComVariacoes } from '../../data/consultas.js'
import { carregarEscolha, carregarProfissional, resumirEscolha } from '../../utils/agendamento.js'

function PassoEmConstrucao({ passo, texto, proximoCaminho }) {
  const [dados, setDados] = useState(null)

  useEffect(() => {
    async function carregar() {
      const servicos = await listarServicosComVariacoes()
      const idDoProfissional = carregarProfissional()
      const profissional = idDoProfissional === null ? null : await buscarProfissional(idDoProfissional)
      setDados({
        resumo: resumirEscolha(carregarEscolha(), servicos),
        nomeDoProfissional: profissional ? profissional.nome : 'Qualquer profissional',
      })
    }
    carregar()
  }, [])

  if (!dados) {
    return <Esqueleto classes="h-32 w-full" />
  }

  if (dados.resumo.quantidade === 0) {
    return <SemServicosEscolhidos />
  }

  return (
    <>
      <IndicadorDePassos passo={passo} />
      <ResumoDosServicos resumo={dados.resumo} nomeDoProfissional={dados.nomeDoProfissional} />
      <EmConstrucao texto={texto} />
      {proximoCaminho && (
        <RodapeFixo>
          <Botao para={proximoCaminho} larguraTotal grande>
            Continuar
            <ArrowRight className="size-5" aria-hidden="true" />
          </Botao>
        </RodapeFixo>
      )}
    </>
  )
}

export default PassoEmConstrucao
