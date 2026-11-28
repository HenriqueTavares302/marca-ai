import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, CircleCheck, Clock, Plus, Search, Store, UserPlus, UserRound } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Chip from '../../components/Chip.jsx'
import DiaDaFaixa from '../../components/DiaDaFaixa.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import FileiraRolavel from '../../components/FileiraRolavel.jsx'
import GradeDeHorarios from '../../components/GradeDeHorarios.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import PainelDeTamanho from '../../components/PainelDeTamanho.jsx'
import PrecoDoServico from '../../components/PrecoDoServico.jsx'
import RodapeFixo from '../../components/RodapeFixo.jsx'
import {
  buscarSalao,
  criarAgendamento,
  listarClientes,
  listarDatasAbertas,
  listarHorariosLivres,
  listarProfissionaisComServicos,
  listarServicosComVariacoes,
  verificarEncaixe,
} from '../../data/consultas.js'
import { codigoDoProblema } from '../../data/supabase/erros.js'
import {
  itensParaOBanco,
  juntarComE,
  profissionaisQueFazemTudo,
  resumirEscolha,
  servicosQueFaltam,
  textoDaQuantidade,
  textoDoValorTotal,
} from '../../utils/agendamento.js'
import {
  apenasDigitosDoCelular,
  erroDoCelular,
  erroDoNome,
  filtrarClientes,
  formatarCelular,
  semAcento,
} from '../../utils/cliente.js'
import { formatarDataCurta, formatarDuracao } from '../../utils/formatos.js'
import { hojeEmSaoPaulo, instanteEmSaoPaulo, partesEmSaoPaulo, somarDias } from '../../utils/fuso.js'
import { formatarMinutos, minutosDaHora } from '../../utils/horariosLivres.js'
import { mostrarAcimaDoRodape, rolarFaixaParaODia } from '../../utils/rolagem.js'
import { precoParaMostrar } from '../../utils/precos.js'
import { mostrarEscolhaDeProfissional, papelLogado, profissionalLogado } from '../../utils/sessao.js'

const quantidadeDeDias = 21


function lerParametros(params, hoje, idLogado) {
  const data = params.get('data')
  const hora = params.get('hora')
  const profissional = Number(params.get('profissional'))
  const clienteId = Number(params.get('cliente'))
  const dataValida =
    /^\d{4}-\d{2}-\d{2}$/.test(data || '') && data >= hoje && data <= somarDias(hoje, quantidadeDeDias - 1)
  const horaValida = /^\d{2}:\d{2}$/.test(hora || '') && minutosDaHora(hora) < 24 * 60
  return {
    data: dataValida ? data : hoje,
    minutos: dataValida && horaValida ? minutosDaHora(hora) : null,
    profissionalId: papelLogado() === 'dono' && Number.isInteger(profissional) && profissional > 0 ? profissional : idLogado,
    clienteId: Number.isInteger(clienteId) && clienteId > 0 ? clienteId : null,
  }
}

function Secao({ id, numero, titulo, erro, children }) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-3">
      <h2 tabIndex={-1} className="text-2xl font-semibold">
        <span className="text-principal">{numero} ·</span> {titulo}
      </h2>
      {erro && <MensagemErro texto={erro} />}
      {children}
    </section>
  )
}

function LinhaDeServico({ servico, item, profissionalId, aoTocar }) {
  const escolhido = Boolean(item)
  const duracoes = servico.variacoes.map((variacao) => variacao.duracao_min)
  const tempo = item
    ? formatarDuracao(item.duracao_min)
    : duracoes.length > 0
      ? formatarDuracao(Math.min(...duracoes)) + ' a ' + formatarDuracao(Math.max(...duracoes))
      : formatarDuracao(servico.duracao_min)

  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={servico.variacoes.length > 0 ? undefined : escolhido}
      aria-haspopup={servico.variacoes.length > 0 ? 'dialog' : undefined}
      className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 bg-superficie px-3 py-2 text-left ${
        escolhido ? 'border-principal' : 'border-borda'
      }`}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${
          escolhido ? 'border-principal bg-principal text-sobre-principal' : 'border-texto-suave text-texto-suave'
        }`}
        aria-hidden="true"
      >
        {escolhido ? <Check className="size-5" /> : <Plus className="size-5" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{item ? item.nome : servico.nome}</span>
        <span className="text-texto-suave">
          {tempo}
          {escolhido && <span className="sr-only">, adicionado</span>}
        </span>
      </span>
      <PrecoDoServico {...precoParaMostrar(servico, item ? item.variacao : null, profissionalId)} />
    </button>
  )
}

function NovoAgendamento() {
  const [erroAoCarregar, setErroAoCarregar] = useState(null)
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const idLogado = profissionalLogado()
  const [hoje] = useState(hojeEmSaoPaulo)
  const [inicial] = useState(() => lerParametros(params, hoje, idLogado))

  const [base, setBase] = useState(null)
  const [busca, setBusca] = useState('')
  const [cliente, setCliente] = useState(null)
  const [telefoneDaRota, setTelefoneDaRota] = useState(null)
  const [cadastrando, setCadastrando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoCelular, setNovoCelular] = useState('')
  const [tentouCadastrar, setTentouCadastrar] = useState(false)
  const [avisoDoCliente, setAvisoDoCliente] = useState('')

  const [buscaServico, setBuscaServico] = useState('')
  const [escolha, setEscolha] = useState([])
  const [servicoDoPainel, setServicoDoPainel] = useState(null)

  const [profissionalId, setProfissionalId] = useState(inicial.profissionalId)
  const [diasAbertos, setDiasAbertos] = useState([])
  const [data, setData] = useState(inicial.data)
  const [horarios, setHorarios] = useState(null)
  const [horario, setHorario] = useState(
    inicial.minutos === null ? null : { data: inicial.data, minutos: inicial.minutos, origem: 'lista' },
  )
  const [mostrarEncaixe, setMostrarEncaixe] = useState(false)
  const [horaDoEncaixe, setHoraDoEncaixe] = useState('')
  const [encaixe, setEncaixe] = useState(null)
  const [conferindo, setConferindo] = useState(false)

  const [observacao, setObservacao] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('salao')

  const [tentouAgendar, setTentouAgendar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [perguntarFora, setPerguntarFora] = useState(false)
  const [erroGeral, setErroGeral] = useState('')
  const enviando = useRef(false)
  const saindoDeProposito = useRef(false)

  useEffect(() => {
    async function carregar() {
      const [clientes, servicos, profissionais, salao] = await Promise.all([
        listarClientes(),
        listarServicosComVariacoes(),
        listarProfissionaisComServicos(),
        buscarSalao(),
      ])
      setBase({ clientes, servicos, profissionais, salao })
      const daRota = clientes.find((item) => item.id === inicial.clienteId)
      if (daRota) {
        setCliente({ nome: daRota.nome, telefone: daRota.telefone })
        setTelefoneDaRota(daRota.telefone)
      }
    }
    carregar().catch((problema) => setErroAoCarregar(codigoDoProblema(problema)))
  }, [inicial.clienteId])

  useEffect(() => {
    async function carregarDias() {
      const proximosDias = Array.from({ length: quantidadeDeDias }, (_, indice) => somarDias(hoje, indice))
      setDiasAbertos(await listarDatasAbertas(profissionalId, [], proximosDias))
    }
    carregarDias().catch((problema) => setErroAoCarregar(codigoDoProblema(problema)))
  }, [profissionalId, hoje])

  const resumo = base ? resumirEscolha(escolha, base.servicos, profissionalId) : resumirEscolha([], [])
  const servicoIds = resumo.itens.map((item) => item.servico.id)
  const chaveDosServicos = servicoIds.join(',')
  const chaveDosItens = JSON.stringify(itensParaOBanco(resumo))
  const possiveis = base ? profissionaisQueFazemTudo(base.profissionais, resumo.itens) : []
  const profissional = possiveis.find((item) => item.id === profissionalId) || null
  const profissionalAtual = base ? base.profissionais.find((item) => item.id === profissionalId) : null
  const podeVerHorarios = resumo.quantidade > 0 && Boolean(profissional)

  useEffect(() => {
    if (!podeVerHorarios) return
    let atual = true
    async function carregarHorarios() {
      setHorarios(null)
      const livres = await listarHorariosLivres(
        data,
        profissionalId,
        resumo.duracaoTotal,
        chaveDosServicos.split(',').map(Number),
        null,
        true,
        JSON.parse(chaveDosItens),
      )
      if (atual) setHorarios(livres)
    }
    carregarHorarios().catch((problema) => setErroAoCarregar(codigoDoProblema(problema)))
    return () => {
      atual = false
    }
  }, [podeVerHorarios, data, profissionalId, resumo.duracaoTotal, chaveDosServicos, chaveDosItens])

  useEffect(() => {
    rolarFaixaParaODia(data)
  }, [data, diasAbertos])

  useEffect(() => {
    if (encaixe) mostrarAcimaDoRodape(document.getElementById('resultado-encaixe'))
  }, [encaixe])

  const chaveDoEncaixe = data + '|' + profissionalId + '|' + resumo.duracaoTotal
  const horarioNaLista = Boolean(
    horario &&
      horario.origem === 'lista' &&
      horario.data === data &&
      horarios &&
      horarios.some((livre) => livre.minutos === horario.minutos),
  )
  const encaixeValido = Boolean(
    horario && horario.origem === 'manual' && encaixe && encaixe.livre && encaixe.chave === chaveDoEncaixe,
  )
  const horarioValido = podeVerHorarios && (horarioNaLista || encaixeValido)

  const sujo = Boolean(
    (cliente && cliente.telefone !== telefoneDaRota) || escolha.length > 0 || observacao.trim() || horaDoEncaixe || (cadastrando && (novoNome || novoCelular)),
  )

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

  function escolherCliente(escolhido) {
    setCliente({ nome: escolhido.nome, telefone: escolhido.telefone })
    setAvisoDoCliente('')
  }

  function comecarCadastro() {
    const digitos = busca.replace(/\D/g, '')
    if (digitos.length >= 3) {
      setNovoCelular(formatarCelular(digitos))
      setNovoNome('')
    } else {
      setNovoNome(busca.trim())
      setNovoCelular('')
    }
    setTentouCadastrar(false)
    setCadastrando(true)
  }

  function usarNovoCliente() {
    setTentouCadastrar(true)
    if (erroDoNome(novoNome)) {
      document.getElementById('campo-novo-nome').focus()
      return
    }
    if (erroDoCelular(novoCelular)) {
      document.getElementById('campo-novo-celular').focus()
      return
    }
    const telefone = apenasDigitosDoCelular(novoCelular)
    const existente = base.clientes.find((item) => item.telefone === telefone)
    if (existente) {
      setCliente({ nome: existente.nome, telefone: existente.telefone })
      setAvisoDoCliente('Esse celular já é de ' + existente.nome + '. Usamos o cadastro que já existe.')
    } else {
      setCliente({ nome: novoNome.trim().replace(/\s+/g, ' '), telefone })
      setAvisoDoCliente('')
    }
    setCadastrando(false)
  }

  function trocarCliente() {
    setCliente(null)
    setBusca('')
    setAvisoDoCliente('')
  }

  function tocarNoServico(servico) {
    if (servico.variacoes.length > 0) {
      setServicoDoPainel(servico)
      return
    }
    if (escolha.some((item) => item.servico_id === servico.id)) {
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

  function escolherDia(novaData) {
    setData(novaData)
    if (horario && horario.data !== novaData) setHorario(null)
    if (!diasAbertos.includes(novaData)) setMostrarEncaixe(true)
  }

  async function conferirEncaixe() {
    if (!/^\d{2}:\d{2}$/.test(horaDoEncaixe)) {
      setEncaixe({ chave: chaveDoEncaixe, mensagem: 'Digite a hora do encaixe, como 15:10.' })
      return
    }
    setConferindo(true)
    const minutos = minutosDaHora(horaDoEncaixe)
    const resultado = await verificarEncaixe(profissionalId, data, minutos, resumo.duracaoTotal)
    setConferindo(false)
    const faixa = formatarMinutos(minutos) + ' às ' + formatarMinutos(minutos + resumo.duracaoTotal)

    if (resultado.livre) {
      setEncaixe({ chave: chaveDoEncaixe, livre: true, faixa, foraDoExpediente: resultado.foraDoExpediente })
      setHorario({ data, minutos, origem: 'manual' })
      return
    }

    let mensagem = 'Esse horário já passou.'
    if (resultado.erro === 'conflito') {
      const inicio = partesEmSaoPaulo(resultado.conflito.inicio).hora
      const fim = partesEmSaoPaulo(resultado.conflito.fim).hora
      mensagem =
        resultado.conflito.tipo === 'atendimento'
          ? faixa + ' bate com o atendimento de ' + resultado.conflito.nome + ' (' + inicio + ' às ' + fim + ').'
          : faixa + ' bate com: ' + resultado.conflito.nome + ' (' + inicio + ' às ' + fim + ').'
    }
    setEncaixe({ chave: chaveDoEncaixe, livre: false, mensagem })
    if (horario && horario.origem === 'manual') setHorario(null)
  }

  function irPara(id) {
    const secao = document.getElementById(id)
    secao.scrollIntoView({ block: 'start' })
    secao.querySelector('h2').focus({ preventScroll: true })
  }

  const erros = {
    cliente: cliente ? '' : 'Escolha ou cadastre o cliente.',
    servicos: resumo.quantidade > 0 ? '' : 'Escolha pelo menos um serviço.',
    profissional: profissional ? '' : 'Escolha um profissional que faça todos os serviços.',
    horario: horarioValido ? '' : 'Escolha um horário livre ou confira um encaixe.',
  }

  async function agendar(confirmouFora = false) {
    if (enviando.current) return
    setTentouAgendar(true)
    setErroGeral('')
    const primeiroErro = ['cliente', 'servicos', 'profissional', 'horario'].find((chave) => erros[chave])
    if (primeiroErro) {
      irPara('secao-' + primeiroErro)
      return
    }
    if (!confirmouFora && horario.origem === 'manual' && encaixe && encaixe.foraDoExpediente) {
      setPerguntarFora(true)
      return
    }
    setPerguntarFora(false)

    enviando.current = true
    setSalvando(true)
    let continuaLivre = false
    if (horario.origem === 'lista') {
      const livres = await listarHorariosLivres(
        data,
        profissionalId,
        resumo.duracaoTotal,
        servicoIds,
        null,
        true,
        itensParaOBanco(resumo),
      )
      continuaLivre = livres.some((livre) => livre.minutos === horario.minutos)
    } else {
      continuaLivre = Boolean((await verificarEncaixe(profissionalId, data, horario.minutos, resumo.duracaoTotal)).livre)
    }

    const resultado = continuaLivre
      ? await criarAgendamento({
          nome: cliente.nome,
          telefone: cliente.telefone,
          profissionalId,
          inicio: new Date(instanteEmSaoPaulo(data, horario.minutos)).toISOString(),
          itens: resumo.itens.map((item) => ({
            servico_id: item.servico.id,
            variacao_id: item.variacao ? item.variacao.id : null,
            preco: item.servico.tipo_preco === 'consulta' ? null : item.preco,
            duracao_min: item.duracao_min,
          })),
          observacoes: observacao.trim(),
          formaPagamento,
        })
      : { erro: 'horario_ocupado' }

    if (resultado.erro) {
      setErroGeral(
        resultado.erro === 'horario_ocupado'
          ? 'Esse horário acabou de ser ocupado. Escolha outro.'
          : 'Não conseguimos salvar. Tente de novo.',
      )
      if (resultado.erro === 'horario_ocupado') setHorario(null)
      setSalvando(false)
      enviando.current = false
      return
    }

    saindoDeProposito.current = true
    navegar('/salao?data=' + data, {
      state: {
        aviso: 'Agendado para ' + cliente.nome.split(' ')[0] + ' às ' + formatarMinutos(horario.minutos),
        todos: profissionalId !== idLogado,
      },
    })
  }

  if (erroAoCarregar) {
    return <ErroAoCarregar codigo={erroAoCarregar} aoTentarDeNovo={() => window.location.reload()} />
  }

  if (!base) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando
        </p>
        <Esqueleto classes="h-12 w-full" />
        <Esqueleto classes="h-40 w-full" />
        <Esqueleto classes="h-40 w-full" />
      </>
    )
  }

  const encontrados = filtrarClientes(base.clientes, busca).slice(0, 6)
  const servicosVisiveis = base.servicos.filter((servico) => semAcento(servico.nome).includes(semAcento(buscaServico).trim()))
  const dias = Array.from({ length: quantidadeDeDias }, (_, indice) => somarDias(hoje, indice))
  const itemDoPainel = servicoDoPainel ? resumo.itens.find((item) => item.servico.id === servicoDoPainel.id) : null
  const mostrarErro = (chave) => (tentouAgendar ? erros[chave] : '')

  return (
    <>
      <Secao id="secao-cliente" numero="1" titulo="Cliente" erro={mostrarErro('cliente')}>
        {cliente ? (
          <div className="flex items-center gap-3 rounded-2xl border-2 border-principal bg-superficie p-3">
            <UserRound className="size-6 shrink-0 text-principal" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{cliente.nome}</span>
              <span className="block text-texto-suave">{formatarCelular(cliente.telefone)}</span>
            </span>
            <button
              type="button"
              onClick={trocarCliente}
              className="flex min-h-12 items-center px-2 font-semibold text-principal underline underline-offset-4"
            >
              Trocar
            </button>
          </div>
        ) : cadastrando ? (
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-borda bg-superficie p-3">
            <CampoTexto
              id="campo-novo-nome"
              rotulo="Nome"
              valor={novoNome}
              aoMudar={setNovoNome}
              erro={tentouCadastrar ? erroDoNome(novoNome) : ''}
              autoCompletar="off"
              limite={80}
              obrigatorio
            />
            <CampoTexto
              id="campo-novo-celular"
              rotulo="Celular / WhatsApp"
              tipo="tel"
              valor={novoCelular}
              aoMudar={(texto) => setNovoCelular(formatarCelular(texto))}
              erro={tentouCadastrar ? erroDoCelular(novoCelular) : ''}
              placeholder="(DDD) 9XXXX-XXXX"
              modoDeEntrada="tel"
              autoCompletar="off"
              limite={20}
              obrigatorio
            />
            <Botao larguraTotal aoClicar={usarNovoCliente}>
              Usar este cliente
            </Botao>
            <button
              type="button"
              onClick={() => setCadastrando(false)}
              className="min-h-12 font-semibold text-principal underline underline-offset-4"
            >
              Voltar para a busca
            </button>
          </div>
        ) : (
          <>
            <CampoTexto
              id="campo-busca-cliente"
              rotulo="Buscar por nome ou celular"
              tipo="search"
              valor={busca}
              aoMudar={setBusca}
              autoCompletar="off"
              limite={60}
              acao={<Search className="mr-4 size-5 text-texto-suave" aria-hidden="true" />}
            />
            {busca.trim() && (
              <ul className="flex flex-col gap-2" aria-label="Clientes encontrados">
                {encontrados.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => escolherCliente(item)}
                      className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 border-borda bg-superficie px-3 text-left"
                    >
                      <span className="font-semibold">{item.nome}</span>
                      <span className="shrink-0 text-texto-suave">{formatarCelular(item.telefone)}</span>
                    </button>
                  </li>
                ))}
                {encontrados.length === 0 && <li className="text-texto-suave">Nenhum cliente encontrado.</li>}
              </ul>
            )}
            <Botao variante="secundario" larguraTotal aoClicar={comecarCadastro}>
              <UserPlus className="size-5" aria-hidden="true" />
              Cadastrar novo cliente
            </Botao>
          </>
        )}
        {avisoDoCliente && <p className="text-texto-suave">{avisoDoCliente}</p>}
      </Secao>

      <Secao id="secao-servicos" numero="2" titulo="Serviços" erro={mostrarErro('servicos')}>
        <CampoTexto
          id="campo-busca-servico"
          rotulo="Buscar serviço"
          tipo="search"
          valor={buscaServico}
          aoMudar={setBuscaServico}
          autoCompletar="off"
          limite={40}
          acao={<Search className="mr-4 size-5 text-texto-suave" aria-hidden="true" />}
        />
        <ul className="flex flex-col gap-2">
          {servicosVisiveis.map((servico) => (
            <li key={servico.id}>
              <LinhaDeServico
                servico={servico}
                item={resumo.itens.find((item) => item.servico.id === servico.id) || null}
                profissionalId={profissionalId}
                aoTocar={() => tocarNoServico(servico)}
              />
            </li>
          ))}
          {servicosVisiveis.length === 0 && <li className="text-texto-suave">Nenhum serviço com esse nome.</li>}
        </ul>
        {resumo.quantidade > 0 && (
          <p className="font-semibold" aria-live="polite">
            {textoDaQuantidade(resumo.quantidade)} · {formatarDuracao(resumo.duracaoTotal)} · {textoDoValorTotal(resumo)}
          </p>
        )}
      </Secao>

      <Secao id="secao-profissional" numero="3" titulo="Profissional" erro={mostrarErro('profissional')}>
        {!mostrarEscolhaDeProfissional(papelLogado(), base.profissionais.length) ? (
          <p>{profissionalAtual ? profissionalAtual.nome.split(' ')[0] + ' (você)' : 'Você'}</p>
        ) : possiveis.length === 0 ? (
          <p>Nenhum profissional faz todos esses serviços juntos. Tire um dos serviços.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {possiveis.map((item) => (
              <Chip key={item.id} aoClicar={() => setProfissionalId(item.id)} selecionado={item.id === profissionalId}>
                {item.nome.split(' ')[0]}
                {item.id === idLogado ? ' (você)' : ''}
              </Chip>
            ))}
          </div>
        )}
        {!profissional && profissionalAtual && possiveis.length > 0 && (
          <p className="text-texto-suave">
            {profissionalAtual.nome.split(' ')[0]} não faz{' '}
            {juntarComE(servicosQueFaltam(profissionalAtual, resumo.itens).map((servico) => servico.nome))}. Escolha
            outro profissional.
          </p>
        )}
      </Secao>

      <Secao id="secao-horario" numero="4" titulo="Dia e horário" erro={mostrarErro('horario')}>
        <div className="-mx-4">
          <FileiraRolavel rotulo="Dias" quantidade={dias.length}>
            {dias.map((dia) => (
              <DiaDaFaixa
                key={dia}
                data={dia}
                hoje={hoje}
                aberto={diasAbertos.includes(dia)}
                fechadoTocavel
                selecionado={dia === data}
                aoEscolher={() => escolherDia(dia)}
              />
            ))}
          </FileiraRolavel>
        </div>

        {!podeVerHorarios && (
          <p className="text-texto-suave">Escolha os serviços e o profissional para ver os horários livres.</p>
        )}
        {podeVerHorarios && horarios === null && <Esqueleto classes="h-32 w-full" />}
        {podeVerHorarios && horarios !== null && horarios.length === 0 && (
          <p className="font-semibold">
            {diasAbertos.includes(data)
              ? 'Sem horários livres neste dia. Use um encaixe ou escolha outro dia.'
              : 'Dia fechado. Para marcar mesmo assim, use Outro horário (encaixe).'}
          </p>
        )}
        {podeVerHorarios && horarios !== null && horarios.length > 0 && (
          <GradeDeHorarios
            horarios={horarios}
            minutosEscolhidos={horarioNaLista ? horario.minutos : null}
            aoEscolher={(livre) => {
              setHorario({ data, minutos: livre.minutos, origem: 'lista' })
              setEncaixe(null)
              setHoraDoEncaixe('')
            }}
          />
        )}
        {podeVerHorarios &&
          horarios !== null &&
          horario &&
          horario.origem === 'lista' &&
          horario.data === data &&
          !horarioNaLista && (
            <MensagemErro
              texto={'O horário ' + formatarMinutos(horario.minutos) + ' não está livre para esses serviços. Escolha outro.'}
            />
          )}

        {podeVerHorarios && (
          <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-texto-suave p-3">
            {!mostrarEncaixe ? (
              <button
                type="button"
                onClick={() => setMostrarEncaixe(true)}
                className="flex min-h-12 items-center gap-2 font-semibold text-principal underline underline-offset-4"
              >
                <Clock className="size-5" aria-hidden="true" />
                Outro horário (encaixe)
              </button>
            ) : (
              <>
                <CampoTexto
                  id="campo-encaixe"
                  rotulo="Hora do encaixe"
                  tipo="time"
                  valor={horaDoEncaixe}
                  aoMudar={(valor) => {
                    setHoraDoEncaixe(valor)
                    setEncaixe(null)
                  }}
                  ajuda={'Duração: ' + formatarDuracao(resumo.duracaoTotal) + '. Não pode bater com outro atendimento ou bloqueio.'}
                />
                <Botao variante="secundario" larguraTotal carregando={conferindo} aoClicar={conferirEncaixe}>
                  Conferir encaixe
                </Botao>
                {encaixe && encaixe.chave === chaveDoEncaixe && encaixe.livre && (
                  <p id="resultado-encaixe" role="status" className="flex items-start gap-2 font-semibold text-principal">
                    <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <span>
                      Encaixe livre: {encaixe.faixa}.
                      {encaixe.foraDoExpediente && (
                        <span className="block font-normal text-texto">Fica fora do expediente do profissional.</span>
                      )}
                    </span>
                  </p>
                )}
                {encaixe && encaixe.chave === chaveDoEncaixe && !encaixe.livre && (
                  <MensagemErro id="resultado-encaixe" texto={encaixe.mensagem} />
                )}
              </>
            )}
          </div>
        )}
      </Secao>

      <Secao id="secao-extras" numero="5" titulo="Observação e pagamento">
        <CampoTexto
          id="campo-observacao-salao"
          rotulo="Observação"
          valor={observacao}
          aoMudar={setObservacao}
          ajuda={observacao.length + ' de 200 caracteres'}
          opcional
          multilinha
          limite={200}
        />
        {base.salao.pix_ativo ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">Pagamento</legend>
            {[
              { valor: 'salao', titulo: 'No salão' },
              { valor: 'pix', titulo: 'Pix' },
            ].map((opcao) => (
              <label key={opcao.valor} className="flex min-h-12 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="pagamento-salao"
                  value={opcao.valor}
                  checked={formaPagamento === opcao.valor}
                  onChange={() => setFormaPagamento(opcao.valor)}
                  className="size-6 accent-principal"
                />
                {opcao.titulo}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="flex items-center gap-2">
            <Store className="size-5 text-principal" aria-hidden="true" />
            Pagamento no salão
          </p>
        )}
      </Secao>

      <RodapeFixo>
        <p className="text-center">
          <span className="block truncate font-semibold">
            {cliente ? cliente.nome : 'Sem cliente'} ·{' '}
            {resumo.quantidade > 0 ? resumo.itens.map((item) => item.nome).join(' + ') : 'sem serviços'}
          </span>
          <span className="block text-texto-suave">
            {horarioValido
              ? formatarDataCurta(data) +
                ' · ' +
                formatarMinutos(horario.minutos) +
                ' às ' +
                formatarMinutos(horario.minutos + resumo.duracaoTotal)
              : 'Sem horário escolhido'}
          </span>
        </p>
        {erroGeral && <MensagemErro texto={erroGeral} />}
        <Botao larguraTotal grande carregando={salvando} aoClicar={() => agendar()}>
          {salvando ? 'Agendando...' : 'Agendar'}
        </Botao>
      </RodapeFixo>

      <PainelDeTamanho
        servico={servicoDoPainel}
        variacaoAtualId={itemDoPainel && itemDoPainel.variacao ? itemDoPainel.variacao.id : null}
        profissionalId={profissionalId}
        aoEscolher={escolherTamanho}
        aoRemover={() => {
          setEscolha(escolha.filter((item) => item.servico_id !== servicoDoPainel.id))
          setServicoDoPainel(null)
        }}
        aoFechar={() => setServicoDoPainel(null)}
      />

      <Dialogo
        aberto={perguntarFora}
        titulo={
          !profissional || profissional.id === idLogado
            ? 'Fora do seu horário, marcar mesmo assim?'
            : 'Fora do horário de ' + profissional.nome.split(' ')[0] + ', marcar mesmo assim?'
        }
        aoFechar={() => setPerguntarFora(false)}
      >
        <p className="text-texto-suave">
          {horario && encaixe && encaixe.faixa ? 'O encaixe de ' + encaixe.faixa + ' fica fora do horário de trabalho. ' : ''}
          O cliente não vê esse horário para marcar sozinho.
        </p>
        <div className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal aoClicar={() => setPerguntarFora(false)}>
            Voltar
          </Botao>
          <Botao larguraTotal aoClicar={() => agendar(true)}>
            Marcar mesmo assim
          </Botao>
        </div>
      </Dialogo>

      <Dialogo
        aberto={bloqueio.state === 'blocked'}
        titulo="Descartar agendamento?"
        aoFechar={() => {
          if (bloqueio.state === 'blocked') bloqueio.reset()
        }}
      >
        <p className="text-texto-suave">Os dados preenchidos vão ser perdidos.</p>
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

export default NovoAgendamento
