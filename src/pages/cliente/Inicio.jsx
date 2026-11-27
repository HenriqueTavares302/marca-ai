import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, CalendarPlus, Clock, Lock, MapPin, MessageCircle } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import CapaDoSalao from '../../components/CapaDoSalao.jsx'
import Card from '../../components/Card.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import PrecoDoServico from '../../components/PrecoDoServico.jsx'
import { buscarSalao, listarHorarioDoSalao, listarServicosPopulares } from '../../data/consultas.js'
import { codigoDoProblema } from '../../data/supabase/erros.js'
import { formatarDuracao, linkDoMapa, linkDoWhatsapp } from '../../utils/formatos.js'
import { partesEmSaoPaulo } from '../../utils/fuso.js'
import { precoParaMostrar } from '../../utils/precos.js'
import { agruparHorariosDaSemana, situacaoDoSalao } from '../../utils/horarios.js'
import { profissionalLogado } from '../../utils/sessao.js'

function StatusDoSalao({ semana, agora }) {
  const situacao = situacaoDoSalao(semana, agora)
  const corDoPonto = situacao.aberto ? 'bg-principal' : 'bg-texto-suave'

  return (
    <p className="flex flex-wrap items-center gap-x-2">
      <span className={`size-2.5 rounded-full ${corDoPonto}`} aria-hidden="true" />
      <span className="font-semibold">{situacao.texto}</span>
      <span className="text-texto-suave">· {situacao.detalhe}</span>
    </p>
  )
}

function Inicio() {
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const [salao, setSalao] = useState(null)
  const [semana, setSemana] = useState([])
  const [populares, setPopulares] = useState([])
  const [agora, setAgora] = useState(() => new Date())

  useEffect(() => {
    async function carregar() {
      try {
        const [dadosDoSalao, horarios, servicos] = await Promise.all([
          buscarSalao(),
          listarHorarioDoSalao(),
          listarServicosPopulares(4),
        ])
        setSalao(dadosDoSalao)
        setSemana(horarios)
        setPopulares(servicos)
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
    const relogio = setInterval(() => setAgora(new Date()), 60000)
    return () => clearInterval(relogio)
  }, [])

  const diaDeHoje = partesEmSaoPaulo(agora).diaSemana

  const rodape = (
    <footer className="flex justify-center">
      <Link
        to={profissionalLogado() === null ? '/salao/entrar' : '/salao'}
        className="flex min-h-12 items-center gap-2 px-4 text-texto-suave underline underline-offset-4"
      >
        <Lock className="size-4" aria-hidden="true" />
        Entrar como profissional
      </Link>
    </footer>
  )

  if (erro) {
    return (
      <>
        <ErroAoCarregar codigo={erro} aoTentarDeNovo={tentarDeNovo} tentando={carregando} />
        {rodape}
      </>
    )
  }

  return (
    <>
      <p className="sr-only" role="status">
        {carregando ? 'Carregando informações do salão' : ''}
      </p>
      <CapaDoSalao
        nome={salao && salao.nome}
        descricao={salao && salao.descricao}
        fotoUrl={salao && salao.foto_capa_url}
        carregando={carregando}
      />

      <section className="flex flex-col gap-3" aria-label="Agendamento">
        {carregando ? <Esqueleto classes="h-6 w-64" /> : <StatusDoSalao semana={semana} agora={agora} />}
        <Botao para="/servicos" larguraTotal grande>
          <CalendarPlus className="size-6" aria-hidden="true" />
          Agendar horário
        </Botao>
        <Botao para="/meus-agendamentos" variante="secundario" larguraTotal>
          <CalendarCheck className="size-5" aria-hidden="true" />
          Meus agendamentos
        </Botao>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Mais pedidos</h2>
        <Card>
          <ul className="divide-y divide-borda">
            {carregando
              ? [1, 2, 3, 4].map((numero) => (
                  <li key={numero} className="flex items-center justify-between gap-3 py-3">
                    <span className="flex flex-col gap-2">
                      <Esqueleto classes="h-5 w-36" />
                      <Esqueleto classes="h-4 w-16" />
                    </span>
                    <Esqueleto classes="h-5 w-20" />
                  </li>
                ))
              : populares.map((servico) => (
                  <li key={servico.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-semibold">{servico.nome}</p>
                      <p className="flex items-center gap-1 text-texto-suave">
                        <Clock className="size-4" aria-hidden="true" />
                        {formatarDuracao(servico.duracao_min)}
                      </p>
                    </div>
                    <PrecoDoServico {...precoParaMostrar(servico)} />
                  </li>
                ))}
            {!carregando && populares.length === 0 && (
              <li className="py-3 text-texto-suave">O salão ainda não cadastrou serviços.</li>
            )}
          </ul>
          <Link
            to="/servicos"
            className="flex min-h-12 items-center justify-center gap-2 font-semibold text-principal"
          >
            Ver todos os serviços
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Onde estamos</h2>
        <Card>
          {carregando ? (
            <Esqueleto classes="h-12 w-full" />
          ) : (
            <>
              {salao.endereco && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-1 size-5 shrink-0 text-destaque" aria-hidden="true" />
                  {salao.endereco}
                </p>
              )}
              <div className="mt-2 flex flex-col gap-3">
                {salao.endereco && (
                  <Botao linkExterno={linkDoMapa(salao.endereco)} variante="secundario" larguraTotal>
                    <MapPin className="size-5" aria-hidden="true" />
                    Abrir no mapa
                  </Botao>
                )}
                {salao.whatsapp && (
                  <Botao
                    linkExterno={linkDoWhatsapp(salao.whatsapp, 'Olá! Vim pelo app do ' + salao.nome + '.')}
                    variante="secundario"
                    larguraTotal
                  >
                    <MessageCircle className="size-5" aria-hidden="true" />
                    Chamar no WhatsApp
                  </Botao>
                )}
              </div>
            </>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Horários</h2>
        <Card>
          {carregando ? (
            <Esqueleto classes="h-24 w-full" />
          ) : (
            <dl className="divide-y divide-borda">
              {agruparHorariosDaSemana(semana).map((grupo) => {
                const ehHoje = grupo.dias.includes(diaDeHoje)
                return (
                  <div key={grupo.nome} className={`flex justify-between gap-3 py-2 ${ehHoje ? 'font-semibold' : ''}`}>
                    <dt>
                      {grupo.nome}
                      {ehHoje && <span className="ml-2 text-principal">(hoje)</span>}
                    </dt>
                    <dd className={`text-right ${grupo.horario === 'Fechado' ? 'text-texto-suave' : ''}`}>{grupo.horario}</dd>
                  </div>
                )
              })}
            </dl>
          )}
        </Card>
      </section>

      {rodape}
    </>
  )
}

export default Inicio
