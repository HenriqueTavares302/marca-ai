import { useEffect, useRef, useState } from 'react'
import { Link, useBlocker } from 'react-router-dom'
import { CircleAlert, Copy, Plus, Trash2 } from 'lucide-react'
import AgendamentosAfetados from '../../components/AgendamentosAfetados.jsx'
import Aviso from '../../components/Aviso.jsx'
import Botao from '../../components/Botao.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Chip from '../../components/Chip.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import OpcaoDeEscolha from '../../components/OpcaoDeEscolha.jsx'
import RodapeFixo from '../../components/RodapeFixo.jsx'
import {
  buscarSalao,
  conferirHorariosDoProfissional,
  listarHorariosDoProfissional,
  listarProfissionaisAtivos,
  salvarHorariosDoProfissional,
} from '../../data/consultas.js'
import { codigoDoProblema } from '../../data/supabase/erros.js'
import {
  diasDoProfissional,
  errosDosHorarios,
  limiteDeIntervalos,
  nomesDosDias,
  ordemDaSemana,
} from '../../utils/expediente.js'
import { juntarComE } from '../../utils/agendamento.js'
import { mostrarEscolhaDeProfissional, papelLogado, profissionalLogado } from '../../utils/sessao.js'

function textoDosIntervalos(dia) {
  if (!dia.atende) return 'Não atende'
  return dia.intervalos.map((intervalo) => intervalo.inicio + '–' + intervalo.fim).join(' e ')
}

function semChaves(dias) {
  return JSON.stringify(
    dias.map((dia) => ({
      atende: dia.atende,
      intervalos: dia.atende ? dia.intervalos.map((intervalo) => [intervalo.inicio, intervalo.fim]) : [],
    })),
  )
}

function HorariosDeTrabalho() {
  const [erroAoCarregar, setErroAoCarregar] = useState(null)
  const idLogado = profissionalLogado()
  const [profissionais, setProfissionais] = useState([])
  const [salao, setSalao] = useState(null)
  const [profissionalId, setProfissionalId] = useState(idLogado)
  const [dias, setDias] = useState(null)
  const [inicial, setInicial] = useState('')
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [foraDoHorario, setForaDoHorario] = useState([])
  const [copiandoDe, setCopiandoDe] = useState(null)
  const [diasParaCopiar, setDiasParaCopiar] = useState([])
  const [trocarPara, setTrocarPara] = useState(null)
  const [aviso, setAviso] = useState(null)
  const proximaChave = useRef(1)

  useEffect(() => {
    async function carregarBase() {
      const [lista, dadosDoSalao] = await Promise.all([listarProfissionaisAtivos(), buscarSalao()])
      setProfissionais(lista)
      setSalao(dadosDoSalao)
    }
    carregarBase().catch((problema) => setErroAoCarregar(codigoDoProblema(problema)))
  }, [])

  useEffect(() => {
    let atual = true
    async function carregarDias() {
      setDias(null)
      const linhas = await listarHorariosDoProfissional(profissionalId)
      if (!atual) return
      const novosDias = diasDoProfissional(linhas, profissionalId).map((dia) => ({
        ...dia,
        intervalos: dia.intervalos.map((intervalo) => ({ ...intervalo, chave: proximaChave.current++ })),
      }))
      setDias(novosDias)
      setInicial(semChaves(novosDias))
      setTentouSalvar(false)
    }
    carregarDias().catch((problema) => setErroAoCarregar(codigoDoProblema(problema)))
    return () => {
      atual = false
    }
  }, [profissionalId])

  const validacao = dias ? errosDosHorarios(dias) : { erros: [], temErro: false }

  useEffect(() => {
    if (!dias || validacao.temErro) return
    let atual = true
    async function conferir() {
      const lista = await conferirHorariosDoProfissional(profissionalId, dias)
      if (atual) setForaDoHorario(lista)
    }
    conferir().catch((problema) => setErroAoCarregar(codigoDoProblema(problema)))
    return () => {
      atual = false
    }
  }, [dias, profissionalId, validacao.temErro])

  const sujo = Boolean(dias) && semChaves(dias) !== inicial

  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sujo && currentLocation.pathname !== nextLocation.pathname,
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

  function focarDepois(id) {
    requestAnimationFrame(() => {
      const elemento = document.getElementById(id)
      if (elemento) elemento.focus()
    })
  }

  function mudarDia(indice, mudanca) {
    setDias((atuais) => atuais.map((dia, posicao) => (posicao === indice ? { ...dia, ...mudanca } : dia)))
  }

  function marcarAtende(indice, atende) {
    const dia = dias[indice]
    if (atende && dia.intervalos.length === 0) {
      mudarDia(indice, { atende, intervalos: [{ inicio: '09:00', fim: '18:00', chave: proximaChave.current++ }] })
    } else {
      mudarDia(indice, { atende })
    }
  }

  function mudarIntervalo(indice, chave, campo, valor) {
    const dia = dias[indice]
    mudarDia(indice, {
      intervalos: dia.intervalos.map((intervalo) => (intervalo.chave === chave ? { ...intervalo, [campo]: valor } : intervalo)),
    })
  }

  function adicionarIntervalo(indice) {
    const dia = dias[indice]
    const ultimo = dia.intervalos[dia.intervalos.length - 1]
    const novo = { inicio: ultimo ? ultimo.fim : '09:00', fim: '', chave: proximaChave.current++ }
    mudarDia(indice, { intervalos: [...dia.intervalos, novo] })
    focarDepois('intervalo-' + novo.chave + '-inicio')
  }

  function removerIntervalo(indice, chave) {
    const dia = dias[indice]
    mudarDia(indice, { intervalos: dia.intervalos.filter((intervalo) => intervalo.chave !== chave) })
    focarDepois('adicionar-intervalo-' + indice)
  }

  function abrirCopia(indice) {
    setCopiandoDe(indice)
    setDiasParaCopiar([])
  }

  function copiar() {
    const origem = dias[copiandoDe]
    setDias((atuais) =>
      atuais.map((dia, indice) =>
        diasParaCopiar.includes(indice)
          ? {
              atende: origem.atende,
              intervalos: origem.intervalos.map((intervalo) => ({
                inicio: intervalo.inicio,
                fim: intervalo.fim,
                chave: proximaChave.current++,
              })),
            }
          : dia,
      ),
    )
    const nomes = ordemDaSemana.filter((dia) => diasParaCopiar.includes(dia)).map((dia) => nomesDosDias[dia].toLowerCase())
    setAviso({ id: Date.now(), tipo: 'sucesso', mensagem: 'Copiado para ' + juntarComE(nomes) + '. Falta salvar.' })
    setCopiandoDe(null)
  }

  function primeiroCampoComErro() {
    for (const indice of ordemDaSemana) {
      const erroDoDia = validacao.erros[indice]
      if (erroDoDia.geral) return 'dia-' + indice
      const posicao = erroDoDia.intervalos.findIndex((erro) => erro.inicio || erro.fim)
      if (posicao >= 0) {
        const campo = erroDoDia.intervalos[posicao].inicio ? 'inicio' : 'fim'
        return 'intervalo-' + dias[indice].intervalos[posicao].chave + '-' + campo
      }
    }
    return null
  }

  async function salvar() {
    setTentouSalvar(true)
    const campo = primeiroCampoComErro()
    if (campo) {
      const elemento = document.getElementById(campo)
      elemento.scrollIntoView({ block: 'center' })
      elemento.focus({ preventScroll: true })
      return
    }
    setSalvando(true)
    const resultado = await salvarHorariosDoProfissional(profissionalId, dias)
    setSalvando(false)
    if (resultado.erro) {
      setAviso({ id: Date.now(), tipo: 'erro', mensagem: 'Não conseguimos salvar os horários. Tente de novo.' })
      return
    }
    setInicial(semChaves(dias))
    setForaDoHorario(resultado.foraDoHorario)
    setTentouSalvar(false)
    setAviso({ id: Date.now(), tipo: 'sucesso', mensagem: 'Horários salvos.' })
  }

  function escolherProfissional(id) {
    if (id === profissionalId) return
    if (sujo) {
      setTrocarPara(id)
    } else {
      setProfissionalId(id)
    }
  }

  function descartar() {
    if (bloqueio.state === 'blocked') {
      bloqueio.proceed()
      return
    }
    setProfissionalId(trocarPara)
    setTrocarPara(null)
  }

  function continuarEditando() {
    if (bloqueio.state === 'blocked') bloqueio.reset()
    setTrocarPara(null)
  }

  if (erroAoCarregar) {
    return <ErroAoCarregar codigo={erroAoCarregar} aoTentarDeNovo={() => window.location.reload()} />
  }

  const nomeDoProfissional = (profissionais.find((item) => item.id === profissionalId) || { nome: '' }).nome.split(' ')[0]
  const quantidadeFora = foraDoHorario.length

  return (
    <>
      {mostrarEscolhaDeProfissional(papelLogado(), profissionais.length) && (
        <div className="flex flex-col gap-2">
          <p className="font-medium" id="rotulo-profissional">
            Profissional
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rotulo-profissional">
            {profissionais.map((profissional) => (
              <Chip
                key={profissional.id}
                selecionado={profissional.id === profissionalId}
                aoClicar={() => escolherProfissional(profissional.id)}
              >
                {profissional.nome.split(' ')[0]}
                {profissional.id === idLogado ? ' (você)' : ''}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <p className="text-texto-suave">
        O espaço entre dois intervalos (como o almoço) aparece na agenda como Intervalo e não recebe agendamentos.
      </p>
      <p className="text-texto-suave">
        Para um dia diferente (abrir num domingo ou ficar até mais tarde),{' '}
        <Link to="/salao/configuracoes/horarios-especiais" className="font-semibold text-principal underline underline-offset-4">
          use Horários especiais
        </Link>
        .
      </p>

      {!dias ? (
        <>
          <p className="sr-only" role="status">
            Carregando horários
          </p>
          <Esqueleto classes="h-40 w-full" />
          <Esqueleto classes="h-40 w-full" />
        </>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordemDaSemana.map((indice) => {
            const dia = dias[indice]
            const nomeDoDia = nomesDosDias[indice]
            const erroDoDia = tentouSalvar ? validacao.erros[indice] : null
            return (
              <li key={indice} className="flex flex-col gap-3 rounded-2xl border-2 border-borda bg-superficie p-3">
                <h2 id={'dia-' + indice} tabIndex={-1} className="scroll-mt-24 text-xl font-semibold">
                  {nomeDoDia}
                </h2>
                <div className="flex flex-wrap gap-2" role="group" aria-label={'Atendimento de ' + nomeDoDia.toLowerCase()}>
                  <Chip selecionado={dia.atende} aoClicar={() => marcarAtende(indice, true)}>
                    Atende
                  </Chip>
                  <Chip selecionado={!dia.atende} aoClicar={() => marcarAtende(indice, false)}>
                    Não atende
                  </Chip>
                </div>

                {erroDoDia && erroDoDia.geral && <MensagemErro texto={erroDoDia.geral} />}

                {dia.atende && (
                  <>
                    {dia.intervalos.map((intervalo, posicao) => {
                      const erro = erroDoDia ? erroDoDia.intervalos[posicao] : null
                      const idDoErro = 'erro-intervalo-' + intervalo.chave
                      return (
                        <div key={intervalo.chave} className="flex flex-col gap-1">
                          <div className="flex items-end gap-2">
                            <div className="min-w-0 flex-1">
                              <CampoTexto
                                id={'intervalo-' + intervalo.chave + '-inicio'}
                                rotulo={'Início ' + (posicao + 1)}
                                tipo="time"
                                valor={intervalo.inicio}
                                aoMudar={(valor) => mudarIntervalo(indice, intervalo.chave, 'inicio', valor)}
                                idDoErroExterno={erro && erro.inicio ? idDoErro : undefined}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <CampoTexto
                                id={'intervalo-' + intervalo.chave + '-fim'}
                                rotulo={'Fim ' + (posicao + 1)}
                                tipo="time"
                                valor={intervalo.fim}
                                aoMudar={(valor) => mudarIntervalo(indice, intervalo.chave, 'fim', valor)}
                                idDoErroExterno={erro && erro.fim ? idDoErro : undefined}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removerIntervalo(indice, intervalo.chave)}
                              aria-label={'Remover intervalo ' + (posicao + 1) + ' de ' + nomeDoDia.toLowerCase()}
                              className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-perigo text-perigo"
                            >
                              <Trash2 className="size-5" aria-hidden="true" />
                            </button>
                          </div>
                          {erro && (erro.inicio || erro.fim) && <MensagemErro id={idDoErro} texto={erro.inicio || erro.fim} />}
                        </div>
                      )
                    })}
                    {dia.intervalos.length < limiteDeIntervalos && (
                      <button
                        type="button"
                        id={'adicionar-intervalo-' + indice}
                        onClick={() => adicionarIntervalo(indice)}
                        className="flex min-h-12 items-center gap-2 self-start font-semibold text-principal underline underline-offset-4"
                      >
                        <Plus className="size-5" aria-hidden="true" />
                        Adicionar intervalo
                      </button>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => abrirCopia(indice)}
                  className="flex min-h-12 items-center gap-2 self-start font-semibold text-principal underline underline-offset-4"
                >
                  <Copy className="size-5" aria-hidden="true" />
                  Copiar para outros dias
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {dias && quantidadeFora > 0 && (
        <section id="fora-do-horario" className="flex scroll-mt-24 flex-col gap-2" aria-live="polite">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <CircleAlert className="size-6 shrink-0 text-perigo" aria-hidden="true" />
            {quantidadeFora === 1
              ? '1 agendamento fica fora do novo horário'
              : quantidadeFora + ' agendamentos ficam fora do novo horário'}
          </h2>
          <p className="text-texto-suave">
            Eles não são cancelados sozinhos. Remarque ou avise os clientes de {nomeDoProfissional}.
          </p>
          <AgendamentosAfetados agendamentos={foraDoHorario} nomeDoSalao={salao ? salao.nome : ''} />
        </section>
      )}

      <RodapeFixo>
        {quantidadeFora > 0 && (
          <a href="#fora-do-horario" className="flex min-h-12 items-center justify-center gap-2 font-semibold text-perigo underline underline-offset-4">
            <CircleAlert className="size-5 shrink-0" aria-hidden="true" />
            {quantidadeFora === 1 ? '1 agendamento fica fora' : quantidadeFora + ' agendamentos ficam fora'}
          </a>
        )}
        {tentouSalvar && validacao.temErro && <MensagemErro texto="Confira os horários marcados." />}
        <Botao larguraTotal grande carregando={salvando} desabilitado={!dias} aoClicar={salvar}>
          {salvando ? 'Salvando...' : 'Salvar horários'}
        </Botao>
      </RodapeFixo>

      <Dialogo
        aberto={copiandoDe !== null}
        titulo={copiandoDe !== null ? 'Copiar ' + nomesDosDias[copiandoDe].toLowerCase() : ''}
        aoFechar={() => setCopiandoDe(null)}
      >
        {copiandoDe !== null && dias && (
          <>
            <p>
              <span className="text-texto-suave">Horário: </span>
              <span className="font-semibold">{textoDosIntervalos(dias[copiandoDe])}</span>
            </p>
            <fieldset className="flex flex-col">
              <legend className="mb-1 font-medium">Copiar para</legend>
              {ordemDaSemana
                .filter((dia) => dia !== copiandoDe)
                .map((dia) => (
                  <OpcaoDeEscolha
                    key={dia}
                    tipo="checkbox"
                    nome="dias-para-copiar"
                    valor={dia}
                    marcado={diasParaCopiar.includes(dia)}
                    aoMarcar={() =>
                      setDiasParaCopiar(
                        diasParaCopiar.includes(dia) ? diasParaCopiar.filter((item) => item !== dia) : [...diasParaCopiar, dia],
                      )
                    }
                    titulo={nomesDosDias[dia]}
                    explicacao={textoDosIntervalos(dias[dia])}
                  />
                ))}
            </fieldset>
            <div className="flex flex-col gap-2">
              <Botao variante="secundario" larguraTotal aoClicar={() => setCopiandoDe(null)}>
                Cancelar
              </Botao>
              <Botao larguraTotal desabilitado={diasParaCopiar.length === 0} aoClicar={copiar}>
                <Copy className="size-5" aria-hidden="true" />
                {diasParaCopiar.length === 0
                  ? 'Copiar'
                  : 'Copiar para ' + diasParaCopiar.length + (diasParaCopiar.length === 1 ? ' dia' : ' dias')}
              </Botao>
            </div>
          </>
        )}
      </Dialogo>

      <Dialogo
        aberto={bloqueio.state === 'blocked' || trocarPara !== null}
        titulo="Descartar alterações?"
        aoFechar={continuarEditando}
      >
        <p className="text-texto-suave">As mudanças nos horários de {nomeDoProfissional} ainda não foram salvas.</p>
        <div className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal aoClicar={continuarEditando}>
            Continuar editando
          </Botao>
          <Botao variante="perigo" larguraTotal aoClicar={descartar}>
            Descartar
          </Botao>
        </div>
      </Dialogo>

      <Aviso aviso={aviso} definirAviso={setAviso} alto />
    </>
  )
}

export default HorariosDeTrabalho
