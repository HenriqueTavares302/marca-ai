import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ErroAoCarregar from './ErroAoCarregar.jsx'
import Esqueleto from './Esqueleto.jsx'
import PainelInferior from './PainelInferior.jsx'
import { codigoDoProblema } from '../data/supabase/erros.js'
import {
  datasParaBuscar,
  diaTocavel,
  mesDaData,
  palavraDaSituacao,
  podeAvancarMes,
  podeVoltarMes,
  rotuloDoDia,
  semanasDoMes,
  situacaoDoDia,
  somarMeses,
  tituloDoMes,
} from '../utils/calendarioDoMes.js'
import { formatarDataCurta, numeroDoDia } from '../utils/formatos.js'

const diasDaSemana = [
  ['D', 'domingo'],
  ['S', 'segunda'],
  ['T', 'terça'],
  ['Q', 'quarta'],
  ['Q', 'quinta'],
  ['S', 'sexta'],
  ['S', 'sábado'],
]

function CasaDoDia({ data, hoje, situacao, selecionado, balcao, aoEscolher }) {
  const palavra = palavraDaSituacao(situacao)
  const conteudo = (
    <>
      <span aria-hidden="true" className={`text-lg leading-6 ${situacao === 'livre' ? 'font-semibold' : ''}`}>
        {numeroDoDia(data)}
      </span>
      <span aria-hidden="true" className="h-4 text-[11px] leading-4 font-semibold tracking-tight">
        {palavra}
      </span>
    </>
  )
  const marcaDeHoje = data === hoje ? 'underline decoration-2 underline-offset-4' : ''

  if (!diaTocavel(situacao, balcao)) {
    return (
      <span
        id={'calendario-' + data}
        className={`flex min-h-14 w-full flex-col items-center justify-center rounded-xl text-texto-suave ${marcaDeHoje}`}
      >
        {conteudo}
        <span className="sr-only">{rotuloDoDia(data, hoje, situacao)}</span>
      </span>
    )
  }

  const cores = selecionado
    ? 'border-principal bg-principal text-sobre-principal'
    : situacao === 'livre'
      ? 'border-texto-suave bg-superficie text-texto'
      : 'border-dashed border-texto-suave bg-superficie text-texto-suave'

  return (
    <button
      id={'calendario-' + data}
      type="button"
      onClick={aoEscolher}
      aria-pressed={selecionado}
      aria-label={rotuloDoDia(data, hoje, situacao)}
      className={`flex min-h-14 w-full flex-col items-center justify-center rounded-xl border-2 ${cores} ${marcaDeHoje}`}
    >
      {conteudo}
    </button>
  )
}

function CalendarioDoMes({ aberto, aoFechar, hoje, limite, dataSelecionada, balcao = false, chaveDosDias, carregarDias, aoEscolher }) {
  const [mes, setMes] = useState(() => mesDaData(dataSelecionada || hoje))
  const [dias, setDias] = useState(null)
  const [erro, setErro] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const [estavaAberto, setEstavaAberto] = useState(aberto)
  const carregarAtual = useRef(carregarDias)

  if (aberto !== estavaAberto) {
    setEstavaAberto(aberto)
    if (aberto) setMes(mesDaData(dataSelecionada || hoje))
  }

  useEffect(() => {
    carregarAtual.current = carregarDias
  })

  useEffect(() => {
    if (!aberto) return
    let atual = true
    async function carregar() {
      setDias(null)
      setErro(null)
      try {
        const resposta = await carregarAtual.current(datasParaBuscar(mes, hoje, limite))
        if (atual) setDias(resposta)
      } catch (problema) {
        if (atual) setErro(codigoDoProblema(problema))
      }
    }
    carregar()
    return () => {
      atual = false
    }
  }, [aberto, mes, hoje, limite, chaveDosDias, tentativa])

  return (
    <PainelInferior aberto={aberto} titulo="Escolha o dia" aoFechar={aoFechar}>
      <div className="-mx-1 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMes(somarMeses(mes, -1))}
            disabled={!podeVoltarMes(mes, hoje)}
            aria-label="Mês anterior"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-texto-suave disabled:border-borda disabled:text-borda"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <p className="text-xl font-semibold" aria-live="polite">
            {tituloDoMes(mes)}
          </p>
          <button
            type="button"
            onClick={() => setMes(somarMeses(mes, 1))}
            disabled={!podeAvancarMes(mes, limite)}
            aria-label="Próximo mês"
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-texto-suave disabled:border-borda disabled:text-borda"
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </div>

        {erro && <ErroAoCarregar codigo={erro} aoTentarDeNovo={() => setTentativa(tentativa + 1)} />}

        {!erro && dias === null && (
          <>
            <p className="sr-only" role="status">
              Carregando os dias
            </p>
            <Esqueleto classes="h-72 w-full" />
          </>
        )}

        {!erro && dias !== null && (
          <table className="w-full table-fixed border-separate border-spacing-0">
            <caption className="sr-only">{tituloDoMes(mes)}</caption>
            <thead>
              <tr>
                {diasDaSemana.map(([letra, nome]) => (
                  <th key={nome} scope="col" className="pb-1 font-semibold text-texto-suave">
                    <span aria-hidden="true">{letra}</span>
                    <span className="sr-only">{nome}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {semanasDoMes(mes).map((semana) => (
                <tr key={semana.find(Boolean)}>
                  {semana.map((data, indice) => (
                    <td key={data || 'vazio-' + indice} className="p-0">
                      {data && (
                        <CasaDoDia
                          data={data}
                          hoje={hoje}
                          situacao={situacaoDoDia(data, hoje, limite, dias)}
                          selecionado={data === dataSelecionada}
                          balcao={balcao}
                          aoEscolher={() => aoEscolher(data, situacaoDoDia(data, hoje, limite, dias))}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="text-texto-suave">
          {balcao ? 'Dá para marcar até ' : 'Dá para agendar até '}
          {formatarDataCurta(limite)}.
          {balcao && ' Dias fechados e lotados podem ser escolhidos para um encaixe.'}
        </p>
      </div>
    </PainelInferior>
  )
}

export default CalendarioDoMes
