import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck, UserRound } from 'lucide-react'
import AvisoDaVolta from '../../components/AvisoDaVolta.jsx'
import Botao from '../../components/Botao.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Card from '../../components/Card.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import IndicadorDePassos from '../../components/IndicadorDePassos.jsx'
import ResumoDosServicos from '../../components/ResumoDosServicos.jsx'
import RodapeFixo from '../../components/RodapeFixo.jsx'
import SemServicosEscolhidos from '../../components/SemServicosEscolhidos.jsx'
import {
  carregarDadosDoCliente,
  carregarDadosLembrados,
  esquecerDados,
  lembrarDados,
  salvarDadosDoCliente,
} from '../../utils/agendamento.js'
import { codigoDoProblema } from '../../data/supabase/erros.js'
import { erroDoCelular, erroDoNome, formatarCelular } from '../../utils/cliente.js'
import { carregarResumoDoFluxo } from '../../utils/fluxo.js'

const limiteDaObservacao = 200

function AgendarDados() {
  const navegar = useNavigate()
  const location = useLocation()
  const avisoDaVolta = location.state && location.state.aviso ? location.state.aviso : ''
  const [erro, setErro] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const [fluxo, setFluxo] = useState(null)
  const [nome, setNome] = useState('')
  const [celular, setCelular] = useState('')
  const [observacao, setObservacao] = useState('')
  const [lembrar, setLembrar] = useState(true)
  const [temDadosLembrados, setTemDadosLembrados] = useState(false)
  const [tocados, setTocados] = useState({ nome: false, celular: false })
  const [tentouContinuar, setTentouContinuar] = useState(false)

  useEffect(() => {
    async function carregar() {
      let resumoDoFluxo = null
      try {
        resumoDoFluxo = await carregarResumoDoFluxo()
      } catch (problema) {
        setErro(codigoDoProblema(problema))
        return
      }
      setErro(null)
      const daSessao = carregarDadosDoCliente()
      const lembrados = carregarDadosLembrados()

      if (daSessao) {
        setNome(daSessao.nome)
        setCelular(formatarCelular(daSessao.celular))
        setObservacao(daSessao.observacao)
        setLembrar(daSessao.lembrar)
      } else if (lembrados) {
        setNome(lembrados.nome)
        setCelular(formatarCelular(lembrados.celular))
      }

      setTemDadosLembrados(Boolean(lembrados))
      setFluxo(resumoDoFluxo)
    }
    carregar()
  }, [tentativa])

  useEffect(() => {
    if (!fluxo) return
    salvarDadosDoCliente({ nome, celular, observacao, lembrar })
  }, [fluxo, nome, celular, observacao, lembrar])

  const erroNome = erroDoNome(nome)
  const erroCelular = erroDoCelular(celular)
  const erroNomeVisivel = tocados.nome || tentouContinuar ? erroNome : ''
  const erroCelularVisivel = tocados.celular || tentouContinuar ? erroCelular : ''

  function continuar() {
    setTentouContinuar(true)
    if (erroNome) {
      document.getElementById('campo-nome').focus()
      return
    }
    if (erroCelular) {
      document.getElementById('campo-celular').focus()
      return
    }

    const nomeLimpo = nome.trim().replace(/\s+/g, ' ')
    salvarDadosDoCliente({ nome: nomeLimpo, celular, observacao: observacao.trim(), lembrar })
    if (lembrar) {
      lembrarDados(nomeLimpo, celular)
    } else {
      esquecerDados()
    }
    navegar('/agendar/confirmacao')
  }

  function limparDados() {
    esquecerDados()
    setTemDadosLembrados(false)
    setNome('')
    setCelular('')
    setTocados({ nome: false, celular: false })
    setTentouContinuar(false)
    document.getElementById('campo-nome').focus()
  }

  if (erro) {
    return (
      <ErroAoCarregar
        codigo={erro}
        aoTentarDeNovo={() => {
          setErro(null)
          setTentativa(tentativa + 1)
        }}
      />
    )
  }

  if (!fluxo) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando
        </p>
        <Esqueleto classes="h-12 w-full" />
        <Esqueleto classes="h-48 w-full" />
      </>
    )
  }

  if (fluxo.resumo.quantidade === 0) {
    return <SemServicosEscolhidos />
  }

  if (!fluxo.horario) {
    return (
      <>
        <IndicadorDePassos passo={3} />
        <Card>
          <p className="font-semibold">Escolha o dia e o horário primeiro.</p>
          <p className="text-texto-suave">Depois é só informar seus dados.</p>
        </Card>
        <RodapeFixo>
          <Botao para="/agendar/horario" larguraTotal grande>
            Escolher dia e horário
          </Botao>
        </RodapeFixo>
      </>
    )
  }

  return (
    <>
      <IndicadorDePassos passo={3} />
      <AvisoDaVolta texto={avisoDaVolta} />
      <ResumoDosServicos resumo={fluxo.resumo} nomeDoProfissional={fluxo.nomeDoProfissional} quando={fluxo.quando} />

      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Seus dados</h2>

        {temDadosLembrados && (
          <p className="flex flex-wrap items-center gap-x-2 rounded-2xl border-2 border-borda bg-superficie px-4 py-1">
            <UserRound className="size-5 text-principal" aria-hidden="true" />
            <span>Dados lembrados neste aparelho.</span>
            <button
              type="button"
              onClick={limparDados}
              className="min-h-12 font-semibold text-principal underline underline-offset-4"
            >
              Não é você? Limpar dados
            </button>
          </p>
        )}

        <CampoTexto
          id="campo-nome"
          rotulo="Nome"
          valor={nome}
          aoMudar={setNome}
          aoSair={() => setTocados({ ...tocados, nome: true })}
          erro={erroNomeVisivel}
          placeholder="Como podemos te chamar?"
          obrigatorio
          autoCompletar="name"
          limite={80}
        />

        <CampoTexto
          id="campo-celular"
          rotulo="Celular / WhatsApp"
          tipo="tel"
          valor={celular}
          aoMudar={(texto) => setCelular(formatarCelular(texto))}
          aoSair={() => setTocados({ ...tocados, celular: true })}
          erro={erroCelularVisivel}
          ajuda="Usamos para confirmar o horário pelo WhatsApp."
          placeholder="(DDD) 9XXXX-XXXX"
          obrigatorio
          modoDeEntrada="tel"
          autoCompletar="tel"
          limite={20}
        />

        <CampoTexto
          id="campo-observacao"
          rotulo="Algo que o salão precisa saber?"
          valor={observacao}
          aoMudar={setObservacao}
          ajuda={observacao.length + ' de ' + limiteDaObservacao + ' caracteres'}
          placeholder="Ex.: alergia, cabelo com química, preferência de corte"
          opcional
          multilinha
          limite={limiteDaObservacao}
        />

        <label className="flex min-h-12 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={lembrar}
            onChange={(evento) => setLembrar(evento.target.checked)}
            className="size-6 shrink-0 accent-principal"
          />
          Lembrar meus dados neste aparelho
        </label>

        <p className="flex items-start gap-2 text-texto-suave">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          Usamos seus dados só para confirmar e lembrar você do agendamento.
        </p>
      </section>

      <RodapeFixo>
        <Botao aoClicar={continuar} larguraTotal grande>
          Continuar
          <ArrowRight className="size-5" aria-hidden="true" />
        </Botao>
      </RodapeFixo>
    </>
  )
}

export default AgendarDados
