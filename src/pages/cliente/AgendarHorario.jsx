import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowRight, Info, RotateCcw } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import Card from '../../components/Card.jsx'
import DiaDaFaixa from '../../components/DiaDaFaixa.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import FileiraRolavel from '../../components/FileiraRolavel.jsx'
import GradeDeHorarios from '../../components/GradeDeHorarios.jsx'
import IndicadorDePassos from '../../components/IndicadorDePassos.jsx'
import ResumoDosServicos from '../../components/ResumoDosServicos.jsx'
import RodapeFixo from '../../components/RodapeFixo.jsx'
import SemServicosEscolhidos from '../../components/SemServicosEscolhidos.jsx'
import {
  listarDatasAbertas,
  listarHorariosLivres,
  listarProfissionaisComServicos,
  listarServicosComVariacoes,
} from '../../data/consultas.js'
import {
  carregarEscolha,
  carregarHorario,
  carregarRemarcacao,
  carregarProfissional,
  faixaDosProfissionais,
  profissionaisQueFazemTudo,
  resumirEscolha,
  salvarHorario,
  salvarProfissional,
  textoDaFaixa,
  textoDoValorTotal,
} from '../../utils/agendamento.js'
import { formatarDataCurta, formatarDataLonga } from '../../utils/formatos.js'
import { hojeEmSaoPaulo, partesEmSaoPaulo, somarDias } from '../../utils/fuso.js'
import { formatarMinutos } from '../../utils/horariosLivres.js'
import { mostrarHorarioEscolhido, rolarFaixaParaODia } from '../../utils/rolagem.js'

const quantidadeDeDias = 21

async function buscarDiaComVaga(dias, aPartirDe, dados) {
  for (let indice = aPartirDe; indice < dias.length; indice++) {
    const data = dias[indice]
    if (!dados.diasAbertos.includes(data)) continue
    const livres = await listarHorariosLivres(
      data,
      dados.profissionalId,
      dados.duracao,
      dados.servicoIds,
      dados.ignorarAgendamentoId,
    )
    if (livres.length > 0) return data
  }
  return null
}

function AvisoDeRemarcacao({ inicioAnterior }) {
  const anterior = partesEmSaoPaulo(inicioAnterior)
  return (
    <p className="flex items-start gap-2 rounded-2xl border-2 border-principal bg-superficie p-3">
      <RotateCcw className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
      <span>
        Remarcando o horário de <span className="font-semibold">{formatarDataCurta(anterior.data)} · {anterior.hora}</span>.
        Escolha o novo dia e horário.
      </span>
    </p>
  )
}

function AgendarHorario() {
  const [dados, setDados] = useState(null)
  const [dataSelecionada, setDataSelecionada] = useState(null)
  const [horarios, setHorarios] = useState(null)
  const [escolhido, setEscolhido] = useState(null)
  const [aviso, setAviso] = useState('')
  const [semVagaNaFaixa, setSemVagaNaFaixa] = useState(false)
  const location = useLocation()
  const avisoRecebido = useRef(location.state && location.state.aviso ? location.state.aviso : '')

  useEffect(() => {
    async function carregar() {
      const [servicos, profissionais] = await Promise.all([listarServicosComVariacoes(), listarProfissionaisComServicos()])
      const resumo = resumirEscolha(carregarEscolha(), servicos)
      if (resumo.quantidade === 0) {
        setDados({ resumo })
        return
      }

      const possiveis = profissionaisQueFazemTudo(profissionais, resumo.itens)
      const idSalvo = carregarProfissional()
      const profissional = possiveis.find((item) => item.id === idSalvo) || null
      if (idSalvo !== null && !profissional) salvarProfissional(null)

      const hoje = hojeEmSaoPaulo()
      const dias = Array.from({ length: quantidadeDeDias }, (_, indice) => somarDias(hoje, indice))
      const profissionalId = profissional ? profissional.id : null
      const servicoIds = resumo.itens.map((item) => item.servico.id)
      const diasAbertos = await listarDatasAbertas(profissionalId, servicoIds, dias)
      const remarcacao = carregarRemarcacao()
      const novosDados = {
        resumo,
        escolha: carregarEscolha(),
        servicos,
        hoje,
        dias,
        possiveis,
        profissionalId,
        servicoIds,
        diasAbertos,
        duracao: resumo.duracaoTotal,
        nomeDoProfissional: profissional ? profissional.nome : 'Qualquer profissional',
        nomes: Object.fromEntries(profissionais.map((item) => [item.id, item.nome])),
        remarcacao,
        ignorarAgendamentoId: remarcacao ? remarcacao.agendamentoId : null,
      }

      let dataInicial = null
      const salvo = carregarHorario()
      if (salvo && possiveis.length > 0) {
        const livres = await listarHorariosLivres(
          salvo.data,
          profissionalId,
          resumo.duracaoTotal,
          servicoIds,
          novosDados.ignorarAgendamentoId,
        )
        const aindaLivre = dias.includes(salvo.data) && livres.find((horario) => horario.minutos === salvo.minutos)
        if (aindaLivre) {
          const atualizado = { data: salvo.data, minutos: salvo.minutos, profissionalId: aindaLivre.profissionalId }
          salvarHorario(atualizado)
          setEscolhido(atualizado)
          dataInicial = salvo.data
        } else {
          salvarHorario(null)
          setAviso(
            avisoRecebido.current ||
            'O horário escolhido antes (' +
              formatarDataCurta(salvo.data) +
              ' · ' +
              formatarMinutos(salvo.minutos) +
              ') não serve mais para os serviços ou o profissional escolhidos. Escolha outro.',
          )
        }
      }

      if (!dataInicial && possiveis.length > 0) {
        dataInicial = await buscarDiaComVaga(dias, 0, novosDados)
      }
      if (!dataInicial) {
        dataInicial = dias.find((data) => diasAbertos.includes(data)) || dias[0]
      }

      setDados(novosDados)
      setDataSelecionada(dataInicial)
    }
    carregar()
  }, [])

  useEffect(() => {
    if (!dados || !dataSelecionada || !dados.possiveis || dados.possiveis.length === 0) return
    let atual = true
    async function carregarHorarios() {
      setHorarios(null)
      const livres = await listarHorariosLivres(
        dataSelecionada,
        dados.profissionalId,
        dados.duracao,
        dados.servicoIds,
        dados.ignorarAgendamentoId,
      )
      if (atual) setHorarios(livres)
    }
    carregarHorarios()
    rolarFaixaParaODia(dataSelecionada)
    return () => {
      atual = false
    }
  }, [dados, dataSelecionada])

  useEffect(() => {
    if (!escolhido) return
    const espera = setTimeout(() => {
      mostrarHorarioEscolhido()
    }, 150)
    return () => clearTimeout(espera)
  }, [escolhido])

  function escolherHorario(horario) {
    const novo = { data: dataSelecionada, minutos: horario.minutos, profissionalId: horario.profissionalId }
    setEscolhido(novo)
    salvarHorario(novo)
  }

  async function verProximoDiaComVaga() {
    const indice = dados.dias.indexOf(dataSelecionada)
    const proximo = await buscarDiaComVaga(dados.dias, indice + 1, dados)
    if (proximo) {
      setSemVagaNaFaixa(false)
      setDataSelecionada(proximo)
    } else {
      setSemVagaNaFaixa(true)
    }
  }

  if (!dados) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando horários
        </p>
        <Esqueleto classes="h-12 w-full" />
        <Esqueleto classes="h-20 w-full" />
        <Esqueleto classes="h-40 w-full" />
      </>
    )
  }

  if (dados.resumo.quantidade === 0) {
    return <SemServicosEscolhidos />
  }

  if (dados.possiveis.length === 0) {
    return (
      <>
        <IndicadorDePassos passo={2} />
        <Card>
          <p className="font-semibold">Nenhum profissional faz todos esses serviços juntos.</p>
          <p className="text-texto-suave">Volte e tire um dos serviços para ver os horários.</p>
        </Card>
        <RodapeFixo>
          <Botao para="/servicos" larguraTotal grande>
            Alterar serviços
          </Botao>
        </RodapeFixo>
      </>
    )
  }

  const escolhidoNesteDia = escolhido && escolhido.data === dataSelecionada ? escolhido : null
  const faixa = faixaDosProfissionais(dados.escolha, dados.servicos, dados.possiveis)
  const idDoTotal = escolhido ? escolhido.profissionalId : dados.profissionalId
  const textoDoTotal = idDoTotal
    ? textoDoValorTotal(resumirEscolha(dados.escolha, dados.servicos, idDoTotal))
    : textoDaFaixa(faixa)
  const totalMudaComOProfissional = !dados.profissionalId && faixa.temValor && faixa.menor !== faixa.maior

  return (
    <>
      {dados.remarcacao ? <AvisoDeRemarcacao inicioAnterior={dados.remarcacao.inicioAnterior} /> : <IndicadorDePassos passo={2} />}
      <ResumoDosServicos
        resumo={dados.resumo}
        nomeDoProfissional={dados.nomeDoProfissional}
        textoDoValor={dados.remarcacao ? undefined : textoDoTotal}
      />

      {aviso && (
        <p role="status" className="flex items-start gap-2 rounded-2xl border-2 border-principal bg-superficie p-3">
          <Info className="mt-0.5 size-5 shrink-0 text-principal" aria-hidden="true" />
          {aviso}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Escolha o dia</h2>
        <div className="-mx-4">
          <FileiraRolavel rotulo="Dias" quantidade={dados.dias.length}>
            {dados.dias.map((data) => (
              <DiaDaFaixa
                key={data}
                data={data}
                hoje={dados.hoje}
                aberto={dados.diasAbertos.includes(data)}
                selecionado={data === dataSelecionada}
                aoEscolher={() => {
                  setSemVagaNaFaixa(false)
                  setDataSelecionada(data)
                }}
              />
            ))}
          </FileiraRolavel>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-live="polite">
        <h2 className="text-2xl font-semibold">{formatarDataLonga(dataSelecionada)}</h2>

        {horarios === null && <Esqueleto classes="h-32 w-full" />}

        {horarios !== null && horarios.length === 0 && (
          <Card>
            <p className="font-semibold">Sem horários livres neste dia.</p>
            {semVagaNaFaixa ? (
              <p className="text-texto-suave">
                Não encontramos vagas nos próximos {quantidadeDeDias} dias. Fale com o salão pelo WhatsApp.
              </p>
            ) : (
              <Botao variante="secundario" larguraTotal aoClicar={verProximoDiaComVaga}>
                Ver o próximo dia com vaga
                <ArrowRight className="size-5" aria-hidden="true" />
              </Botao>
            )}
          </Card>
        )}

        {horarios !== null && horarios.length > 0 && (
          <GradeDeHorarios
            horarios={horarios}
            minutosEscolhidos={escolhidoNesteDia ? escolhidoNesteDia.minutos : null}
            aoEscolher={escolherHorario}
          />
        )}
      </section>

      <RodapeFixo>
        {escolhido ? (
          <>
            <p className="text-center">
              <span className="font-semibold">
                {formatarDataCurta(escolhido.data)} · {formatarMinutos(escolhido.minutos)} às{' '}
                {formatarMinutos(escolhido.minutos + dados.duracao)}
              </span>
              <span className="block text-texto-suave" aria-live="polite">
                com {dados.nomes[escolhido.profissionalId]}
                {!dados.remarcacao && <> · {textoDoTotal}</>}
              </span>
              {totalMudaComOProfissional && !dados.remarcacao && (
                <span className="block text-texto-suave">O total muda conforme o profissional do horário.</span>
              )}
            </p>
            <Botao para={dados.remarcacao ? '/agendar/confirmacao' : '/agendar/dados'} larguraTotal grande>
              Continuar
              <ArrowRight className="size-5" aria-hidden="true" />
            </Botao>
          </>
        ) : (
          <p className="flex min-h-14 items-center justify-center text-center text-texto-suave">
            Escolha um horário para continuar.
          </p>
        )}
      </RodapeFixo>
    </>
  )
}

export default AgendarHorario
