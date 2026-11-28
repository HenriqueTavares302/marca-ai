import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import Card from '../../components/Card.jsx'
import Chip from '../../components/Chip.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import { buscarResumo, listarProfissionaisAtivos } from '../../data/consultas.js'
import { codigoDoProblema } from '../../data/supabase/erros.js'
import { formatarPreco } from '../../utils/formatos.js'
import { hojeEmSaoPaulo } from '../../utils/fuso.js'
import { andarNoPeriodo, tiposDePeriodo } from '../../utils/resumo.js'
import { mostrarEscolhaDeProfissional, papelLogado, profissionalLogado } from '../../utils/sessao.js'

function plural(quantidade, singular, pluralDaPalavra) {
  return quantidade + ' ' + (quantidade === 1 ? singular : pluralDaPalavra)
}

function CardDeNumero({ titulo, valor, detalhe, largo = false }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl border-2 border-borda bg-superficie p-3 ${largo ? 'col-span-2' : ''}`}
    >
      <span className="text-texto-suave">{titulo}</span>
      <span className={`font-semibold ${largo ? 'text-3xl' : 'text-2xl'}`}>{valor}</span>
      {detalhe && <span className="text-texto-suave">{detalhe}</span>}
    </div>
  )
}

function Barra({ nome, valor, maximo, texto }) {
  const largura = maximo > 0 ? Math.max(4, Math.round((valor / maximo) * 100)) : 0
  return (
    <li className="flex flex-col gap-1">
      <span className="font-medium">{nome}</span>
      <span className="flex items-center gap-3">
        <span className="h-4 flex-1 overflow-hidden rounded-full bg-borda" aria-hidden="true">
          <span className="block h-full rounded-full bg-principal" style={{ width: largura + '%' }} />
        </span>
        <span className="shrink-0 text-right font-semibold">{texto}</span>
      </span>
    </li>
  )
}

function Resumo() {
  const idLogado = profissionalLogado()
  const [params] = useSearchParams()
  const [hoje] = useState(hojeEmSaoPaulo)
  const [tipo, setTipo] = useState('dia')
  const [data, setData] = useState(() => {
    const pedida = params.get('data')
    return /^\d{4}-\d{2}-\d{2}$/.test(pedida || '') ? pedida : hojeEmSaoPaulo()
  })
  const [soEu, setSoEu] = useState(true)
  const [resumo, setResumo] = useState(null)
  const [ativos, setAtivos] = useState(null)
  const [erro, setErro] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const podeVerTodos = papelLogado() === 'dono' && (ativos === null || mostrarEscolhaDeProfissional('dono', ativos.length))
  const filtro = soEu || !podeVerTodos ? idLogado : null
  const chave = tipo + '|' + data + '|' + filtro

  useEffect(() => {
    async function carregarAtivos() {
      try {
        setAtivos(await listarProfissionaisAtivos())
      } catch {
        setAtivos([])
      }
    }
    carregarAtivos()
  }, [])

  useEffect(() => {
    let atual = true
    async function carregar() {
      try {
        const dados = await buscarResumo(tipo, data, filtro)
        if (atual) {
          setResumo({ ...dados, chave: tipo + '|' + data + '|' + filtro })
          setErro(null)
        }
      } catch (problema) {
        if (atual) setErro(codigoDoProblema(problema))
      }
    }
    carregar()
    return () => {
      atual = false
    }
  }, [tipo, data, filtro, tentativa])

  const carregado = resumo && resumo.chave === chave
  const noPeriodoAtual = carregado && hoje >= resumo.periodo.inicio && hoje <= resumo.periodo.fim

  function escolherTipo(novo) {
    setTipo(novo)
    setData(hoje)
  }

  const nomeDoPeriodo = { dia: 'dia', semana: 'semana', mes: 'mês' }[tipo]
  const maiorQuantidade = carregado && resumo.servicos.length > 0 ? resumo.servicos[0].quantidade : 0
  const maiorForma = carregado ? Math.max(0, ...resumo.formas.map((forma) => forma.total)) : 0

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
          {tiposDePeriodo.map((opcao) => (
            <Chip key={opcao.valor} selecionado={tipo === opcao.valor} aoClicar={() => escolherTipo(opcao.valor)}>
              {opcao.rotulo}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setData((atual) => andarNoPeriodo(tipo, atual, -1))}
            aria-label={'Período anterior (' + nomeDoPeriodo + ')'}
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-texto-suave bg-superficie"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <h2 className="min-w-0 flex-1 text-center text-lg leading-tight font-semibold" aria-live="polite">
            {carregado ? resumo.periodo.titulo : ' '}
          </h2>
          <button
            type="button"
            onClick={() => setData((atual) => andarNoPeriodo(tipo, atual, 1))}
            aria-label={'Próximo período (' + nomeDoPeriodo + ')'}
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-texto-suave bg-superficie"
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </div>
        {carregado && !noPeriodoAtual && (
          <button
            type="button"
            onClick={() => setData(hoje)}
            className="flex min-h-12 items-center justify-center gap-1 self-center px-2 font-semibold text-principal underline underline-offset-4"
          >
            <RotateCcw className="size-5" aria-hidden="true" />
            Voltar para o período atual
          </button>
        )}

        {podeVerTodos && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Profissionais">
            <Chip aoClicar={() => setSoEu(true)} selecionado={soEu}>
              Só eu
            </Chip>
            <Chip aoClicar={() => setSoEu(false)} selecionado={!soEu}>
              Todos
            </Chip>
          </div>
        )}
        {erro && (
          <ErroAoCarregar
            codigo={erro}
            aoTentarDeNovo={() => {
              setErro(null)
              setTentativa(tentativa + 1)
            }}
          />
        )}
      </div>

      <p className="sr-only" role="status">
        {carregado ? '' : 'Carregando resumo'}
      </p>

      {!carregado && (
        <div className="grid grid-cols-2 gap-3">
          <Esqueleto classes="col-span-2 h-24" />
          <Esqueleto classes="h-24" />
          <Esqueleto classes="h-24" />
        </div>
      )}

      {carregado && resumo.vazio && (
        <Card>
          <p className="font-semibold">Nenhum agendamento neste período.</p>
          <p className="text-texto-suave">
            Não há atendimentos, faltas nem cancelamentos {soEu ? 'seus ' : ''}em {resumo.periodo.titulo.toLowerCase()}.
            Use as setas para ver outro período.
          </p>
        </Card>
      )}

      {carregado && !resumo.vazio && (
        <>
          <section className="grid grid-cols-2 gap-3" aria-label="Números do período">
            <CardDeNumero
              largo
              titulo="Faturamento"
              valor={formatarPreco(resumo.faturamento)}
              detalhe={'soma de ' + plural(resumo.concluidos, 'atendimento concluído', 'atendimentos concluídos')}
            />
            <CardDeNumero titulo="Concluídos" valor={resumo.concluidos} />
            <CardDeNumero
              titulo="Ticket médio"
              valor={resumo.concluidos > 0 ? formatarPreco(resumo.ticketMedio) : '—'}
            />
            <CardDeNumero
              titulo="Faltas"
              valor={resumo.faltas}
              detalhe={
                resumo.concluidos + resumo.faltas > 0
                  ? resumo.percentualDeFaltas + '% dos que deviam acontecer'
                  : 'nenhum atendimento passou'
              }
            />
            <CardDeNumero titulo="Cancelamentos" valor={resumo.cancelamentos} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold">Previsto</h2>
            <Card>
              {resumo.previstos > 0 ? (
                <>
                  <p className="text-xl font-semibold">{resumo.valorPrevisto}</p>
                  <p className="text-texto-suave">
                    {plural(resumo.previstos, 'agendamento ainda marcado', 'agendamentos ainda marcados')} neste período.
                  </p>
                </>
              ) : (
                <p className="text-texto-suave">Nenhum agendamento ainda marcado neste período.</p>
              )}
            </Card>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold">Serviços mais pedidos</h2>
            {resumo.servicos.length === 0 ? (
              <p className="text-texto-suave">Nenhum atendimento concluído neste período.</p>
            ) : (
              <>
                <ul className="flex flex-col gap-3">
                  {resumo.servicos.map((servico) => (
                    <Barra
                      key={servico.nome}
                      nome={servico.nome}
                      valor={servico.quantidade}
                      maximo={maiorQuantidade}
                      texto={servico.quantidade + '× · ' + formatarPreco(servico.valor)}
                    />
                  ))}
                </ul>
                <p className="text-texto-suave">Entre os atendimentos concluídos, com o valor cobrado.</p>
              </>
            )}
          </section>

          {!soEu && (
            <section className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold">Por profissional</h2>
              <ul className="grid grid-cols-2 gap-3">
                {resumo.porProfissional.map((profissional) => (
                  <li key={profissional.id} className="flex flex-col gap-1 rounded-2xl border-2 border-borda bg-superficie p-3">
                    <span className="font-semibold">{profissional.nome.split(' ')[0]}</span>
                    <span className="text-xl font-semibold">{formatarPreco(profissional.faturamento)}</span>
                    <span className="text-texto-suave">
                      {plural(profissional.concluidos, 'atendimento', 'atendimentos')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold">Formas recebidas</h2>
            <ul className="flex flex-col gap-3">
              {resumo.formas.map((forma) => (
                <Barra
                  key={forma.forma}
                  nome={forma.rotulo}
                  valor={forma.total}
                  maximo={maiorForma}
                  texto={formatarPreco(forma.total)}
                />
              ))}
            </ul>
            {resumo.formas.some((forma) => forma.forma === 'nao_informado') && (
              <p className="text-texto-suave">"Não informado" são atendimentos concluídos antes deste controle.</p>
            )}
          </section>
        </>
      )}
    </>
  )
}

export default Resumo
