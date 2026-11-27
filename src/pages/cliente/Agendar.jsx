import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowRight, CircleAlert, Info } from 'lucide-react'
import AvisoDaVolta from '../../components/AvisoDaVolta.jsx'
import Botao from '../../components/Botao.jsx'
import Card from '../../components/Card.jsx'
import CardProfissional from '../../components/CardProfissional.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import IndicadorDePassos from '../../components/IndicadorDePassos.jsx'
import ResumoDosServicos from '../../components/ResumoDosServicos.jsx'
import RodapeFixo from '../../components/RodapeFixo.jsx'
import SemServicosEscolhidos from '../../components/SemServicosEscolhidos.jsx'
import { listarCategorias, listarProfissionaisComServicos, listarServicosComVariacoes } from '../../data/consultas.js'
import { codigoDoProblema } from '../../data/supabase/erros.js'
import {
  carregarEscolha,
  carregarProfissional,
  faixaDosProfissionais,
  juntarComE,
  profissionaisQueFazemTudo,
  resumirEscolha,
  salvarProfissional,
  servicosQueFaltam,
  textoDaFaixa,
  textoDoValorTotal,
} from '../../utils/agendamento.js'

function descreverEspecialidades(profissional, servicos, categorias) {
  const categoriasQueFaz = categorias.filter((categoria) =>
    servicos.some((servico) => servico.categoria === categoria && profissional.servico_ids.includes(servico.id)),
  )
  const texto = juntarComE(categoriasQueFaz).toLowerCase()
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function Agendar() {
  const [dados, setDados] = useState(null)
  const [profissionalId, setProfissionalId] = useState(null)
  const [avisoDeTroca, setAvisoDeTroca] = useState('')
  const location = useLocation()
  const avisoDaVolta = location.state && location.state.aviso ? location.state.aviso : ''
  const [erro, setErro] = useState(null)
  const [tentando, setTentando] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    async function carregar() {
      let lidos
      try {
        lidos = await Promise.all([
          listarServicosComVariacoes(),
          listarProfissionaisComServicos(),
          listarCategorias(),
        ])
      } catch (problema) {
        setErro(codigoDoProblema(problema))
        setTentando(false)
        return
      }
      setErro(null)
      setTentando(false)
      const [servicos, profissionais, categorias] = lidos
      const resumo = resumirEscolha(carregarEscolha(), servicos)
      const possiveis = profissionaisQueFazemTudo(profissionais, resumo.itens)
      const salvo = carregarProfissional()

      if (salvo !== null && !possiveis.some((profissional) => profissional.id === salvo)) {
        const antigo = profissionais.find((profissional) => profissional.id === salvo)
        if (antigo && resumo.quantidade > 0) {
          const faltam = servicosQueFaltam(antigo, resumo.itens).map((servico) => servico.nome)
          setAvisoDeTroca(
            antigo.nome.split(' ')[0] + ' não faz ' + juntarComE(faltam) + '. Voltamos para "Qualquer profissional".',
          )
        }
        salvarProfissional(null)
        setProfissionalId(null)
      } else {
        setProfissionalId(salvo)
      }

      setDados({ servicos, profissionais, categorias, resumo, possiveis, escolha: carregarEscolha() })
    }
    carregar()
  }, [tentativa])

  function tentarDeNovo() {
    setTentando(true)
    setTentativa(tentativa + 1)
  }

  function escolher(id) {
    setProfissionalId(id)
    salvarProfissional(id)
  }

  if (erro) {
    return <ErroAoCarregar codigo={erro} aoTentarDeNovo={tentarDeNovo} tentando={tentando} />
  }

  if (!dados) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando profissionais
        </p>
        <Esqueleto classes="h-12 w-full" />
        <Esqueleto classes="h-20 w-full" />
        <Esqueleto classes="h-20 w-full" />
      </>
    )
  }

  const { servicos, profissionais, categorias, resumo, possiveis, escolha } = dados

  if (resumo.quantidade === 0) {
    return <SemServicosEscolhidos />
  }

  const escolhido = possiveis.find((profissional) => profissional.id === profissionalId)
  const nomeDoProfissional = escolhido ? escolhido.nome : 'Qualquer profissional'
  const textoDaFaixaDeTodos = textoDaFaixa(faixaDosProfissionais(escolha, servicos, possiveis))
  const totalCom = (id) => textoDoValorTotal(resumirEscolha(escolha, servicos, id))

  return (
    <>
      <IndicadorDePassos passo={1} />
      <ResumoDosServicos
        resumo={resumo}
        nomeDoProfissional={nomeDoProfissional}
        textoDoValor={escolhido ? totalCom(escolhido.id) : textoDaFaixaDeTodos}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Com quem você quer agendar?</h2>
        <AvisoDaVolta texto={avisoDaVolta} />

        {avisoDeTroca && (
          <p role="status" className="flex items-start gap-2 rounded-2xl border-2 border-principal bg-superficie p-3">
            <Info className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
            {avisoDeTroca}
          </p>
        )}

        {possiveis.length === 0 ? (
          <Card>
            <p className="flex items-start gap-2 font-semibold">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-perigo" aria-hidden="true" />
              Nenhum profissional faz todos esses serviços juntos.
            </p>
            <ul className="flex flex-col gap-1 text-texto-suave">
              {profissionais.map((profissional) => (
                <li key={profissional.id}>
                  {profissional.nome.split(' ')[0]} não faz{' '}
                  {juntarComE(servicosQueFaltam(profissional, resumo.itens).map((servico) => servico.nome))}.
                </li>
              ))}
            </ul>
            <p>Tire um desses serviços para continuar. O outro pode ser marcado num agendamento separado.</p>
          </Card>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              <li>
                <CardProfissional
                  qualquer
                  nome="Qualquer profissional"
                  detalhe="Mostramos os horários de todos"
                  valor={textoDaFaixaDeTodos}
                  escolhido={!escolhido}
                  aoEscolher={() => escolher(null)}
                />
              </li>
              {possiveis.map((profissional) => (
                <li key={profissional.id}>
                  <CardProfissional
                    nome={profissional.nome}
                    detalhe={descreverEspecialidades(profissional, servicos, categorias)}
                    fotoUrl={profissional.foto_url}
                    valor={totalCom(profissional.id)}
                    escolhido={Boolean(escolhido && escolhido.id === profissional.id)}
                    aoEscolher={() => escolher(profissional.id)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <RodapeFixo>
        {possiveis.length === 0 ? (
          <Botao para="/servicos" larguraTotal grande>
            Alterar serviços
          </Botao>
        ) : (
          <Botao para="/agendar/horario" larguraTotal grande>
            Continuar
            <ArrowRight className="size-5" aria-hidden="true" />
          </Botao>
        )}
      </RodapeFixo>
    </>
  )
}

export default Agendar
