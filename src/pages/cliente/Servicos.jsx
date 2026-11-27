import { useEffect, useState } from 'react'
import CardServico from '../../components/CardServico.jsx'
import Card from '../../components/Card.jsx'
import Chip from '../../components/Chip.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import FileiraRolavel from '../../components/FileiraRolavel.jsx'
import PainelDeTamanho from '../../components/PainelDeTamanho.jsx'
import ResumoDaEscolha from '../../components/ResumoDaEscolha.jsx'
import { listarCategorias, listarServicosComVariacoes } from '../../data/consultas.js'
import { codigoDoProblema } from '../../data/supabase/erros.js'
import { carregarEscolha, encerrarRemarcacao, resumirEscolha, salvarEscolha } from '../../utils/agendamento.js'

const todas = 'Todos'

function CardCarregando() {
  return (
    <div className="flex gap-3 rounded-2xl border-2 border-borda bg-superficie p-3">
      <Esqueleto classes="size-16 shrink-0 rounded-xl" />
      <span className="flex flex-1 flex-col gap-2">
        <Esqueleto classes="h-5 w-2/3" />
        <Esqueleto classes="h-4 w-full" />
        <Esqueleto classes="h-4 w-1/3" />
      </span>
    </div>
  )
}

function Servicos() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const [servicos, setServicos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [categoriaAtual, setCategoriaAtual] = useState(todas)
  const [escolha, setEscolha] = useState(carregarEscolha)
  const [servicoDoPainel, setServicoDoPainel] = useState(null)

  useEffect(() => {
    async function carregar() {
      try {
        const [lista, nomesDasCategorias] = await Promise.all([listarServicosComVariacoes(), listarCategorias()])
        setServicos(lista)
        setCategorias(nomesDasCategorias)
        setErro(null)
      } catch (problema) {
        setErro(codigoDoProblema(problema))
      }
      setCarregando(false)
    }
    carregar()
  }, [tentativa])

  function tentarDeNovo() {
    setCarregando(true)
    setTentativa(tentativa + 1)
  }

  useEffect(() => {
    encerrarRemarcacao()
  }, [])

  useEffect(() => {
    salvarEscolha(escolha)
  }, [escolha])

  const resumo = resumirEscolha(escolha, servicos)

  function itemEscolhidoDe(servico) {
    return resumo.itens.find((item) => item.servico.id === servico.id) || null
  }

  function tocarNoServico(servico) {
    if (servico.variacoes.length > 0) {
      setServicoDoPainel(servico)
      return
    }
    const jaEscolhido = escolha.some((item) => item.servico_id === servico.id)
    if (jaEscolhido) {
      setEscolha(escolha.filter((item) => item.servico_id !== servico.id))
    } else {
      setEscolha([...escolha, { servico_id: servico.id, variacao_id: null }])
    }
  }

  function escolherTamanho(variacao) {
    const novoItem = { servico_id: servicoDoPainel.id, variacao_id: variacao.id }
    const posicao = escolha.findIndex((item) => item.servico_id === servicoDoPainel.id)
    if (posicao >= 0) {
      const novaEscolha = [...escolha]
      novaEscolha[posicao] = novoItem
      setEscolha(novaEscolha)
    } else {
      setEscolha([...escolha, novoItem])
    }
    setServicoDoPainel(null)
  }

  function tirarDoPainel() {
    setEscolha(escolha.filter((item) => item.servico_id !== servicoDoPainel.id))
    setServicoDoPainel(null)
  }

  const categoriasVisiveis = categoriaAtual === todas ? categorias : [categoriaAtual]
  const grupos = categoriasVisiveis
    .map((categoria) => ({
      categoria,
      servicos: servicos.filter((servico) => servico.categoria === categoria),
    }))
    .filter((grupo) => categoriaAtual !== todas || grupo.servicos.length > 0)

  const itemDoPainel = servicoDoPainel ? itemEscolhidoDe(servicoDoPainel) : null

  if (erro) {
    return <ErroAoCarregar codigo={erro} aoTentarDeNovo={tentarDeNovo} tentando={carregando} />
  }

  return (
    <>
      <p className="text-texto-suave">Toque nos serviços que você quer. Depois é só continuar.</p>

      <div className="sticky top-16 z-[5] -mx-4 -my-2 bg-fundo py-2">
        <FileiraRolavel rotulo="Categorias" quantidade={categorias.length}>
          {[todas, ...categorias].map((categoria) => (
            <Chip
              key={categoria}
              aoClicar={() => setCategoriaAtual(categoria)}
              selecionado={categoria === categoriaAtual}
            >
              {categoria}
            </Chip>
          ))}
        </FileiraRolavel>
      </div>

      <p className="sr-only" role="status">
        {carregando ? 'Carregando serviços' : ''}
      </p>

      {carregando ? (
        <div className="flex flex-col gap-3">
          <CardCarregando />
          <CardCarregando />
          <CardCarregando />
          <CardCarregando />
        </div>
      ) : servicos.length === 0 ? (
        <Card>
          <p className="text-texto-suave">O salão ainda não cadastrou serviços. Volte mais tarde ou chame o salão no WhatsApp.</p>
        </Card>
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.categoria} className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold">{grupo.categoria}</h2>
            {grupo.servicos.length === 0 ? (
              <Card>
                <p className="text-texto-suave">Nenhum serviço nesta categoria por enquanto.</p>
              </Card>
            ) : (
              <ul className="flex flex-col gap-3">
                {grupo.servicos.map((servico) => (
                  <li key={servico.id}>
                    <CardServico
                      servico={servico}
                      itemEscolhido={itemEscolhidoDe(servico)}
                      aoTocar={() => tocarNoServico(servico)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}

      {resumo.quantidade > 0 && (
        <>
          <div className="h-24" aria-hidden="true" />
          <ResumoDaEscolha resumo={resumo} />
        </>
      )}

      <PainelDeTamanho
        servico={servicoDoPainel}
        variacaoAtualId={itemDoPainel && itemDoPainel.variacao ? itemDoPainel.variacao.id : null}
        aoEscolher={escolherTamanho}
        aoRemover={tirarDoPainel}
        aoFechar={() => setServicoDoPainel(null)}
      />
    </>
  )
}

export default Servicos
