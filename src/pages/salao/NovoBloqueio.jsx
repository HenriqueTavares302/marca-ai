import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { CalendarOff } from 'lucide-react'
import AgendamentosAfetados from '../../components/AgendamentosAfetados.jsx'
import Botao from '../../components/Botao.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Chip from '../../components/Chip.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import OpcaoDeEscolha from '../../components/OpcaoDeEscolha.jsx'
import RodapeFixo from '../../components/RodapeFixo.jsx'
import { conflitosDoBloqueio, criarBloqueio, listarProfissionaisAtivos } from '../../data/consultas.js'
import { codigoDoProblema } from '../../data/supabase/erros.js'
import {
  diasEntre,
  errosDoBloqueio,
  motivoDoBloqueio,
  motivosDeBloqueio,
  periodoDoBloqueio,
} from '../../utils/expediente.js'
import { formatarDataCurta } from '../../utils/formatos.js'
import { hojeEmSaoPaulo } from '../../utils/fuso.js'
import { mostrarEscolhaDeProfissional, papelLogado, profissionalLogado } from '../../utils/sessao.js'

function formularioInicial(profissionalId, hoje) {
  return {
    profissionalId,
    tipo: 'dia',
    dataInicio: hoje,
    dataFim: hoje,
    horaInicio: '',
    horaFim: '',
    motivo: 'Folga',
    outroMotivo: '',
  }
}

function NovoBloqueio() {
  const [erroAoCarregar, setErroAoCarregar] = useState(null)
  const navegar = useNavigate()
  const idLogado = profissionalLogado()
  const [hoje] = useState(hojeEmSaoPaulo)
  const [agora] = useState(() => Date.now())
  const [inicial] = useState(() => JSON.stringify(formularioInicial(idLogado, hoje)))
  const [formulario, setFormulario] = useState(() => formularioInicial(idLogado, hoje))
  const [profissionais, setProfissionais] = useState([])
  const [tentouCriar, setTentouCriar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [conflitos, setConflitos] = useState(null)
  const [erroGeral, setErroGeral] = useState('')
  const saindoDeProposito = useRef(false)

  useEffect(() => {
    async function carregar() {
      setProfissionais(await listarProfissionaisAtivos())
    }
    carregar().catch((problema) => setErroAoCarregar(codigoDoProblema(problema)))
  }, [])

  const sujo = JSON.stringify(formulario) !== inicial

  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sujo && !saindoDeProposito.current && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!sujo) return
    function avisarAntesDeSair(evento) {
      evento.preventDefault()
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', avisarAntesDeSair)
    return () => window.removeEventListener('beforeunload', avisarAntesDeSair)
  }, [sujo])

  function mudar(campo, valor) {
    setFormulario((atual) => {
      const novo = { ...atual, [campo]: valor }
      if (campo === 'dataInicio' && novo.dataFim < valor) novo.dataFim = valor
      return novo
    })
  }

  const erros = errosDoBloqueio(formulario, agora)
  const mostrar = (chave) => (tentouCriar && erros[chave] ? erros[chave] : '')
  const profissional = profissionais.find((item) => item.id === formulario.profissionalId) || null
  const primeiroNome = profissional ? profissional.nome.split(' ')[0] : ''
  const datasValidas = !erros.dataInicio && !erros.dataFim
  const quantidadeDeDias = datasValidas ? diasEntre(formulario.dataInicio, formulario.dataFim) : 0

  let resumo = ''
  if (datasValidas && profissional) {
    const quando =
      formulario.dataInicio === formulario.dataFim
        ? formatarDataCurta(formulario.dataInicio).toLowerCase()
        : formatarDataCurta(formulario.dataInicio).toLowerCase() +
          ' a ' +
          formatarDataCurta(formulario.dataFim).toLowerCase() +
          ' (' +
          quantidadeDeDias +
          ' dias)'
    resumo =
      formulario.tipo === 'dia'
        ? primeiroNome + ' fica sem horários ' + (formulario.dataInicio === formulario.dataFim ? 'em ' : 'de ') + quando + '.'
        : primeiroNome + ' fica bloqueado ' + (formulario.dataInicio === formulario.dataFim ? 'em ' : 'de ') + quando + '.'
  }

  function focarPrimeiroErro() {
    const ordem = [
      ['dataInicio', 'campo-data-inicio'],
      ['dataFim', 'campo-data-fim'],
      ['horaInicio', 'campo-hora-inicio'],
      ['horaFim', 'campo-hora-fim'],
      ['motivo', 'campo-outro-motivo'],
    ]
    const encontrado = ordem.find(([chave]) => erros[chave])
    if (!encontrado) return false
    const elemento = document.getElementById(encontrado[1])
    elemento.scrollIntoView({ block: 'center' })
    elemento.focus({ preventScroll: true })
    return true
  }

  async function criar() {
    const periodo = periodoDoBloqueio(formulario)
    setSalvando(true)
    const resultado = await criarBloqueio({
      profissionalId: formulario.profissionalId,
      inicio: new Date(periodo.inicio).toISOString(),
      fim: new Date(periodo.fim).toISOString(),
      motivo: motivoDoBloqueio(formulario),
    })
    if (resultado.erro) {
      setSalvando(false)
      setConflitos(null)
      setErroGeral(
        resultado.erro === 'ja_passou' ? 'Esse período já passou.' : 'Não conseguimos criar o bloqueio. Tente de novo.',
      )
      return
    }
    saindoDeProposito.current = true
    navegar('/salao/configuracoes/bloqueios', {
      replace: true,
      state: {
        aviso: 'Bloqueio criado: ' + resultado.bloqueio.motivo + ' de ' + primeiroNome + '.',
        bloqueioId: resultado.bloqueio.id,
      },
    })
  }

  async function aoCriar() {
    setTentouCriar(true)
    setErroGeral('')
    if (focarPrimeiroErro()) return
    const periodo = periodoDoBloqueio(formulario)
    const encontrados = await conflitosDoBloqueio(
      formulario.profissionalId,
      new Date(periodo.inicio).toISOString(),
      new Date(periodo.fim).toISOString(),
    )
    if (encontrados.length > 0) {
      setConflitos(encontrados)
      return
    }
    criar()
  }

  if (erroAoCarregar) {
    return <ErroAoCarregar codigo={erroAoCarregar} aoTentarDeNovo={() => window.location.reload()} />
  }

  return (
    <>
      {mostrarEscolhaDeProfissional(papelLogado(), profissionais.length) && (
        <div className="flex flex-col gap-2">
          <p className="font-medium" id="rotulo-profissional-bloqueio">
            Profissional
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rotulo-profissional-bloqueio">
            {profissionais.map((item) => (
              <Chip
                key={item.id}
                selecionado={item.id === formulario.profissionalId}
                aoClicar={() => mudar('profissionalId', item.id)}
              >
                {item.nome.split(' ')[0]}
                {item.id === idLogado ? ' (você)' : ''}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <fieldset className="flex flex-col">
        <legend className="mb-1 font-medium">Tipo</legend>
        <OpcaoDeEscolha
          nome="tipo-de-bloqueio"
          valor="dia"
          marcado={formulario.tipo === 'dia'}
          aoMarcar={() => mudar('tipo', 'dia')}
          titulo="Dia inteiro"
          explicacao="Um ou mais dias sem atender, como folga ou férias."
        />
        <OpcaoDeEscolha
          nome="tipo-de-bloqueio"
          valor="periodo"
          marcado={formulario.tipo === 'periodo'}
          aoMarcar={() => mudar('tipo', 'periodo')}
          titulo="Período"
          explicacao="Só algumas horas, como um compromisso."
        />
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <CampoTexto
          id="campo-data-inicio"
          rotulo={formulario.tipo === 'dia' ? 'Primeiro dia' : 'Data de início'}
          tipo="date"
          valor={formulario.dataInicio}
          aoMudar={(valor) => mudar('dataInicio', valor)}
          idDoErroExterno={mostrar('dataInicio') ? 'erro-datas' : undefined}
        />
        <CampoTexto
          id="campo-data-fim"
          rotulo={formulario.tipo === 'dia' ? 'Último dia' : 'Data de fim'}
          tipo="date"
          valor={formulario.dataFim}
          aoMudar={(valor) => mudar('dataFim', valor)}
          idDoErroExterno={mostrar('dataFim') ? 'erro-datas' : undefined}
        />
      </div>
      {(mostrar('dataInicio') || mostrar('dataFim')) && (
        <MensagemErro id="erro-datas" texto={mostrar('dataInicio') || mostrar('dataFim')} />
      )}

      {formulario.tipo === 'periodo' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <CampoTexto
              id="campo-hora-inicio"
              rotulo="Hora de início"
              tipo="time"
              valor={formulario.horaInicio}
              aoMudar={(valor) => mudar('horaInicio', valor)}
              idDoErroExterno={mostrar('horaInicio') ? 'erro-horas' : undefined}
            />
            <CampoTexto
              id="campo-hora-fim"
              rotulo="Hora de fim"
              tipo="time"
              valor={formulario.horaFim}
              aoMudar={(valor) => mudar('horaFim', valor)}
              idDoErroExterno={mostrar('horaFim') ? 'erro-horas' : undefined}
            />
          </div>
          {(mostrar('horaInicio') || mostrar('horaFim')) && (
            <MensagemErro id="erro-horas" texto={mostrar('horaInicio') || mostrar('horaFim')} />
          )}
        </>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-medium" id="rotulo-motivo">
          Motivo
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rotulo-motivo">
          {motivosDeBloqueio.map((motivo) => (
            <Chip key={motivo} selecionado={formulario.motivo === motivo} aoClicar={() => mudar('motivo', motivo)}>
              {motivo}
            </Chip>
          ))}
        </div>
        {formulario.motivo === 'Outro' && (
          <CampoTexto
            id="campo-outro-motivo"
            rotulo="Qual motivo?"
            valor={formulario.outroMotivo}
            aoMudar={(valor) => mudar('outroMotivo', valor)}
            erro={mostrar('motivo')}
            autoCompletar="off"
            limite={40}
          />
        )}
      </div>

      {resumo && (
        <p className="flex items-start gap-2 rounded-2xl border-2 border-borda bg-superficie p-3">
          <CalendarOff className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
          <span>
            {resumo}
            {formulario.tipo === 'periodo' && formulario.horaInicio && formulario.horaFim && (
              <span className="block text-texto-suave">
                Das {formulario.horaInicio} {formulario.dataInicio === formulario.dataFim ? 'às' : 'do primeiro dia às'}{' '}
                {formulario.horaFim}
                {formulario.dataInicio === formulario.dataFim ? '' : ' do último'}.
              </span>
            )}
          </span>
        </p>
      )}

      <RodapeFixo>
        {erroGeral && <MensagemErro texto={erroGeral} />}
        <Botao larguraTotal grande carregando={salvando && conflitos === null} aoClicar={aoCriar}>
          {salvando ? 'Criando...' : 'Criar bloqueio'}
        </Botao>
      </RodapeFixo>

      <Dialogo aberto={conflitos !== null} titulo="Criar mesmo assim?" aoFechar={() => setConflitos(null)}>
        {conflitos && (
          <>
            <p>
              Este bloqueio bate com{' '}
              <strong>{conflitos.length === 1 ? '1 agendamento' : conflitos.length + ' agendamentos'}</strong> de{' '}
              {primeiroNome}:
            </p>
            <AgendamentosAfetados agendamentos={conflitos} />
            <p className="text-texto-suave">
              Eles não são cancelados sozinhos. Depois de criar, avise os clientes pelo WhatsApp para remarcar.
            </p>
            <div className="flex flex-col gap-2">
              <Botao variante="secundario" larguraTotal aoClicar={() => setConflitos(null)}>
                Voltar e mudar
              </Botao>
              <Botao variante="perigo" larguraTotal carregando={salvando} aoClicar={criar}>
                Criar mesmo assim
              </Botao>
            </div>
          </>
        )}
      </Dialogo>

      <Dialogo
        aberto={bloqueio.state === 'blocked'}
        titulo="Descartar bloqueio?"
        aoFechar={() => {
          if (bloqueio.state === 'blocked') bloqueio.reset()
        }}
      >
        <p className="text-texto-suave">O que você preencheu vai ser perdido.</p>
        <div className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal aoClicar={() => bloqueio.reset()}>
            Continuar preenchendo
          </Botao>
          <Botao variante="perigo" larguraTotal aoClicar={() => bloqueio.proceed()}>
            Descartar
          </Botao>
        </div>
      </Dialogo>
    </>
  )
}

export default NovoBloqueio
