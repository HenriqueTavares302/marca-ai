import { useEffect, useRef, useState } from 'react'
import { CalendarClock, CircleAlert, Plus, Trash2 } from 'lucide-react'
import AgendamentosAfetados from '../../components/AgendamentosAfetados.jsx'
import Aviso from '../../components/Aviso.jsx'
import Botao from '../../components/Botao.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Card from '../../components/Card.jsx'
import Chip from '../../components/Chip.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import {
  apagarHorarioEspecial,
  buscarSalao,
  listarHorariosDoProfissional,
  listarHorariosEspeciais,
  listarProfissionaisAtivos,
  salvarHorarioEspecial,
} from '../../data/consultas.js'
import { codigoDoProblema } from '../../data/supabase/erros.js'
import { limiteDeIntervalos } from '../../utils/expediente.js'
import { formatarDataCurta } from '../../utils/formatos.js'
import { diaDaSemana, hojeEmSaoPaulo } from '../../utils/fuso.js'
import { errosDoHorarioEspecial } from '../../utils/horarioEspecial.js'
import { textoDoHorario } from '../../utils/horarios.js'
import { mostrarEscolhaDeProfissional, papelLogado, profissionalLogado } from '../../utils/sessao.js'

function HorariosEspeciais() {
  const idLogado = profissionalLogado()
  const hoje = hojeEmSaoPaulo()
  const [erroAoCarregar, setErroAoCarregar] = useState(null)
  const [profissionais, setProfissionais] = useState([])
  const [salao, setSalao] = useState(null)
  const [profissionalId, setProfissionalId] = useState(idLogado)
  const [especiais, setEspeciais] = useState(null)
  const [semana, setSemana] = useState([])
  const [versao, setVersao] = useState(0)
  const [data, setData] = useState('')
  const [intervalos, setIntervalos] = useState([{ inicio: '09:00', fim: '13:00', chave: 0 }])
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [apagando, setApagando] = useState(null)
  const [foraDoHorario, setForaDoHorario] = useState([])
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
    async function carregar() {
      const [lista, horarios] = await Promise.all([listarHorariosEspeciais(profissionalId), listarHorariosDoProfissional(profissionalId)])
      if (!atual) return
      setEspeciais(lista)
      setSemana(horarios)
    }
    carregar().catch((problema) => setErroAoCarregar(codigoDoProblema(problema)))
    return () => {
      atual = false
    }
  }, [profissionalId, versao])

  const validacao = errosDoHorarioEspecial({ data, intervalos }, hoje)
  const erros = tentouSalvar ? validacao.erros : null
  const jaTem = especiais ? especiais.find((especial) => especial.data === data) : null

  function horarioNormal(dataEscolhida) {
    const dia = diaDaSemana(dataEscolhida)
    return textoDoHorario(semana.filter((horario) => horario.dia_semana === dia))
  }

  function escolherProfissional(id) {
    if (id === profissionalId) return
    setProfissionalId(id)
    setEspeciais(null)
    setForaDoHorario([])
  }

  function mudarIntervalo(chave, campo, valor) {
    setIntervalos((atuais) => atuais.map((intervalo) => (intervalo.chave === chave ? { ...intervalo, [campo]: valor } : intervalo)))
  }

  function adicionarIntervalo() {
    const ultimo = intervalos[intervalos.length - 1]
    const novo = { inicio: ultimo ? ultimo.fim : '09:00', fim: '', chave: proximaChave.current++ }
    setIntervalos([...intervalos, novo])
    requestAnimationFrame(() => {
      const campo = document.getElementById('especial-' + novo.chave + '-inicio')
      if (campo) campo.focus()
    })
  }

  function removerIntervalo(chave) {
    setIntervalos(intervalos.filter((intervalo) => intervalo.chave !== chave))
  }

  async function salvar() {
    setTentouSalvar(true)
    if (validacao.temErro) {
      const campo = document.getElementById(validacao.erros.data ? 'especial-data' : 'novo-horario-especial')
      if (campo) campo.focus()
      return
    }
    setSalvando(true)
    const resultado = await salvarHorarioEspecial(profissionalId, data, intervalos)
    setSalvando(false)
    if (resultado.erro) {
      setAviso({ id: Date.now(), tipo: 'erro', mensagem: 'Não conseguimos salvar o horário especial. Confira os horários e tente de novo.' })
      return
    }
    setForaDoHorario(resultado.foraDoHorario)
    setAviso({ id: Date.now(), tipo: 'sucesso', mensagem: 'Horário especial de ' + formatarDataCurta(data).toLowerCase() + ' salvo.' })
    setTentouSalvar(false)
    setData('')
    setIntervalos([{ inicio: '09:00', fim: '13:00', chave: proximaChave.current++ }])
    setVersao((atual) => atual + 1)
  }

  async function confirmarApagar() {
    const dataApagada = apagando
    setApagando(null)
    const resultado = await apagarHorarioEspecial(profissionalId, dataApagada)
    if (resultado.erro) {
      setAviso({ id: Date.now(), tipo: 'erro', mensagem: 'Não conseguimos apagar o horário especial. Tente de novo.' })
      return
    }
    setForaDoHorario(resultado.foraDoHorario)
    setAviso({ id: Date.now(), tipo: 'sucesso', mensagem: formatarDataCurta(dataApagada) + ' voltou ao horário da semana.' })
    setVersao((atual) => atual + 1)
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
              <Chip key={profissional.id} selecionado={profissional.id === profissionalId} aoClicar={() => escolherProfissional(profissional.id)}>
                {profissional.nome.split(' ')[0]}
                {profissional.id === idLogado ? ' (você)' : ''}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <p className="text-texto-suave">
        Abra um dia que normalmente é fechado ou mude o horário de um dia só. Nos outros dias vale o horário da semana. Para
        fechar um dia, use Folgas e bloqueios.
      </p>

      {quantidadeFora > 0 && (
        <section className="flex flex-col gap-2" aria-live="polite">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <CircleAlert className="size-6 shrink-0 text-perigo" aria-hidden="true" />
            {quantidadeFora === 1 ? '1 agendamento fica fora do horário' : quantidadeFora + ' agendamentos ficam fora do horário'}
          </h2>
          <p className="text-texto-suave">Eles não são cancelados sozinhos. Remarque ou avise os clientes de {nomeDoProfissional}.</p>
          <AgendamentosAfetados agendamentos={foraDoHorario} nomeDoSalao={salao ? salao.nome : ''} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 id="novo-horario-especial" tabIndex={-1} className="text-xl font-semibold">
          Novo horário especial
        </h2>
        <Card>
          <div className="flex flex-col gap-3">
            <CampoTexto
              id="especial-data"
              rotulo="Dia"
              tipo="date"
              valor={data}
              aoMudar={setData}
              erro={erros ? erros.data : ''}
              ajuda={data && !validacao.erros.data ? 'Normalmente: ' + horarioNormal(data) + '.' : undefined}
            />
            {jaTem && (
              <p className="text-texto-suave">
                Este dia já tem horário especial ({textoDoHorario(jaTem.intervalos)}). Salvar troca pelo novo.
              </p>
            )}
            {erros && erros.geral && <MensagemErro texto={erros.geral} />}
            {intervalos.map((intervalo, posicao) => {
              const erro = erros ? erros.intervalos[posicao] : null
              const idDoErro = 'erro-especial-' + intervalo.chave
              return (
                <div key={intervalo.chave} className="flex flex-col gap-1">
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <CampoTexto
                        id={'especial-' + intervalo.chave + '-inicio'}
                        rotulo={'Início ' + (posicao + 1)}
                        tipo="time"
                        valor={intervalo.inicio}
                        aoMudar={(valor) => mudarIntervalo(intervalo.chave, 'inicio', valor)}
                        idDoErroExterno={erro && erro.inicio ? idDoErro : undefined}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CampoTexto
                        id={'especial-' + intervalo.chave + '-fim'}
                        rotulo={'Fim ' + (posicao + 1)}
                        tipo="time"
                        valor={intervalo.fim}
                        aoMudar={(valor) => mudarIntervalo(intervalo.chave, 'fim', valor)}
                        idDoErroExterno={erro && erro.fim ? idDoErro : undefined}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removerIntervalo(intervalo.chave)}
                      aria-label={'Remover intervalo ' + (posicao + 1)}
                      className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-perigo text-perigo"
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                    </button>
                  </div>
                  {erro && (erro.inicio || erro.fim) && <MensagemErro id={idDoErro} texto={erro.inicio || erro.fim} />}
                </div>
              )
            })}
            {intervalos.length < limiteDeIntervalos && (
              <button
                type="button"
                onClick={adicionarIntervalo}
                className="flex min-h-12 items-center gap-2 self-start font-semibold text-principal underline underline-offset-4"
              >
                <Plus className="size-5" aria-hidden="true" />
                Adicionar intervalo
              </button>
            )}
            <Botao larguraTotal carregando={salvando} aoClicar={salvar}>
              <CalendarClock className="size-5" aria-hidden="true" />
              {salvando ? 'Salvando...' : 'Salvar horário especial'}
            </Botao>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Próximos horários especiais</h2>
        {especiais === null ? (
          <>
            <p className="sr-only" role="status">
              Carregando horários especiais
            </p>
            <Esqueleto classes="h-20 w-full" />
          </>
        ) : especiais.length === 0 ? (
          <Card>
            <p className="text-texto-suave">Nenhum horário especial marcado.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {especiais.map((especial) => (
              <li key={especial.data} className="flex items-center gap-3 rounded-2xl border-2 border-borda bg-superficie p-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">
                    {especial.data === hoje ? 'Hoje · ' : ''}
                    {formatarDataCurta(especial.data)}
                  </span>
                  <span>{textoDoHorario(especial.intervalos)}</span>
                  <span className="text-texto-suave">Normalmente: {horarioNormal(especial.data)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setApagando(especial.data)}
                  aria-label={'Apagar o horário especial de ' + formatarDataCurta(especial.data)}
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-perigo text-perigo"
                >
                  <Trash2 className="size-5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialogo
        aberto={apagando !== null}
        titulo={apagando ? 'Apagar o horário especial de ' + formatarDataCurta(apagando).toLowerCase() + '?' : ''}
        aoFechar={() => setApagando(null)}
      >
        {apagando && (
          <>
            <p className="text-texto-suave">O dia volta ao horário da semana: {horarioNormal(apagando)}.</p>
            <div className="flex flex-col gap-2">
              <Botao variante="secundario" larguraTotal aoClicar={() => setApagando(null)}>
                Cancelar
              </Botao>
              <Botao variante="perigo" larguraTotal aoClicar={confirmarApagar}>
                Apagar
              </Botao>
            </div>
          </>
        )}
      </Dialogo>

      <Aviso aviso={aviso} definirAviso={setAviso} alto />
    </>
  )
}

export default HorariosEspeciais
