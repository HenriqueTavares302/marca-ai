import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CalendarPlus, LockKeyhole, MessageCircle, Pencil, Phone, UserX } from 'lucide-react'
import Aviso from '../../components/Aviso.jsx'
import Botao from '../../components/Botao.jsx'
import Card from '../../components/Card.jsx'
import ChipDeStatus from '../../components/ChipDeStatus.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import PainelDoAtendimento from '../../components/PainelDoAtendimento.jsx'
import { buscarFichaDoCliente, buscarSalao, removerDadosDoCliente } from '../../data/consultas.js'
import { textoDoValor, valorDoAgendamento } from '../../utils/agenda.js'
import { formatarCelular } from '../../utils/cliente.js'
import { formatarDataCurta, formatarPreco, linkDoWhatsapp } from '../../utils/formatos.js'
import { partesEmSaoPaulo } from '../../utils/fuso.js'

const estiloDoLink =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-principal bg-superficie px-4 font-semibold text-principal [&>svg]:shrink-0'

function ItemDoAgendamento({ agendamento, aoAbrir }) {
  const inicio = partesEmSaoPaulo(agendamento.inicio)
  const servicos = agendamento.servicos
    .map((item) => (item.variacao ? item.servico.nome + ' · ' + item.variacao.nome : item.servico.nome))
    .join(' + ')
  return (
    <button
      type="button"
      onClick={aoAbrir}
      className={`flex w-full flex-col gap-1 rounded-2xl border-2 p-3 text-left ${
        agendamento.status === 'cancelado' ? 'border-dashed border-texto-suave bg-fundo' : 'border-borda bg-superficie'
      }`}
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {formatarDataCurta(inicio.data)} · {inicio.hora}
        </span>
        <ChipDeStatus valor={agendamento.status} />
      </span>
      <span>{servicos}</span>
      <span className="text-texto-suave">
        com {agendamento.profissional.nome.split(' ')[0]} · {textoDoValor(valorDoAgendamento(agendamento))}
      </span>
      {agendamento.observacoes && (
        <span className="line-clamp-2 text-texto-suave">Obs.: {agendamento.observacoes}</span>
      )}
    </button>
  )
}

function Numero({ titulo, valor, detalhe }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-borda bg-superficie p-2 text-center">
      <span className="text-xl font-semibold">{valor}</span>
      <span className="text-texto-suave">{titulo}</span>
      {detalhe && <span className="text-texto-suave">{detalhe}</span>}
    </div>
  )
}

function FichaDoCliente() {
  const params = useParams()
  const id = Number(params.id)
  const location = useLocation()
  const navegar = useNavigate()
  const [ficha, setFicha] = useState(undefined)
  const [salao, setSalao] = useState(null)
  const [versao, setVersao] = useState(0)
  const [abertoId, setAbertoId] = useState(null)
  const [removendo, setRemovendo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(() =>
    location.state && typeof location.state.aviso === 'string'
      ? { id: Date.now(), tipo: 'sucesso', mensagem: location.state.aviso }
      : null,
  )

  useEffect(() => {
    async function carregar() {
      const [dados, dadosDoSalao] = await Promise.all([
        Number.isInteger(id) ? buscarFichaDoCliente(id) : null,
        buscarSalao(),
      ])
      setFicha(dados)
      setSalao(dadosDoSalao)
    }
    carregar()
  }, [id, versao])

  if (ficha === undefined) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando cliente
        </p>
        <Esqueleto classes="h-32 w-full" />
        <Esqueleto classes="h-20 w-full" />
        <Esqueleto classes="h-24 w-full" />
      </>
    )
  }

  if (ficha === null) {
    return (
      <Card>
        <p className="font-semibold">Cliente não encontrado.</p>
        <p className="text-texto-suave">Os dados podem ter sido removidos.</p>
        <Botao para="/salao/clientes" variante="secundario">
          Ver clientes
        </Botao>
      </Card>
    )
  }

  const { cliente, proximos, historico, numeros } = ficha
  const primeiroNome = cliente.nome.split(' ')[0]
  const todos = [...proximos, ...historico]
  const aberto = todos.find((agendamento) => agendamento.id === abertoId) || null
  const mensagem = 'Olá, ' + primeiroNome + '! Aqui é do ' + (salao ? salao.nome : 'salão') + '. '

  function aoMudarStatus(resultado) {
    setAviso({ id: Date.now(), tipo: resultado.erro ? 'erro' : 'sucesso', mensagem: resultado.mensagem })
    if (!resultado.erro && resultado.status === 'cancelado') setAbertoId(null)
    setVersao((atual) => atual + 1)
  }

  async function remover() {
    setOcupado(true)
    const resultado = await removerDadosDoCliente(cliente.id)
    setOcupado(false)
    if (resultado.erro) {
      setRemovendo(false)
      setAviso({
        id: Date.now(),
        tipo: 'erro',
        mensagem:
          resultado.erro === 'tem_futuros'
            ? 'Cancele os agendamentos futuros antes de remover os dados.'
            : 'Não conseguimos remover os dados. Tente de novo.',
      })
      setVersao((atual) => atual + 1)
      return
    }
    navegar('/salao/clientes', {
      replace: true,
      state: {
        aviso: resultado.anonimizado
          ? 'Dados removidos. O histórico ficou como "Cliente removido".'
          : 'Cadastro apagado.',
      },
    })
  }

  return (
    <>
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{cliente.nome}</h2>
          <p className="text-texto-suave">{formatarCelular(cliente.telefone)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a href={'tel:+55' + cliente.telefone} className={estiloDoLink}>
            <Phone className="size-5" aria-hidden="true" />
            Ligar
          </a>
          <Botao variante="secundario" linkExterno={linkDoWhatsapp('55' + cliente.telefone, mensagem)}>
            <MessageCircle className="size-5" aria-hidden="true" />
            WhatsApp
          </Botao>
        </div>
        <Botao para={'/salao/novo?cliente=' + cliente.id} larguraTotal>
          <CalendarPlus className="size-5" aria-hidden="true" />
          Novo agendamento
        </Botao>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border-2 border-borda bg-superficie p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Observações</h2>
          <span className="flex items-center gap-1 text-texto-suave">
            <LockKeyhole className="size-4" aria-hidden="true" />
            Só o salão vê
          </span>
        </div>
        <p className={cliente.observacoes ? 'whitespace-pre-line' : 'text-texto-suave'}>
          {cliente.observacoes || 'Nenhuma observação.'}
        </p>
        <Botao para={'/salao/clientes/' + cliente.id + '/editar'} variante="secundario" larguraTotal>
          <Pencil className="size-5" aria-hidden="true" />
          Editar dados
        </Botao>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Números</h2>
        <div className="grid grid-cols-3 gap-2">
          <Numero titulo={numeros.concluidos === 1 ? 'concluído' : 'concluídos'} valor={numeros.concluidos} />
          <Numero titulo={numeros.faltas === 1 ? 'falta' : 'faltas'} valor={numeros.faltas} />
          <Numero
            titulo="gasto"
            valor={formatarPreco(numeros.totalGasto)}
            detalhe={numeros.temValorACombinar ? '+ a combinar' : ''}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Próximos agendamentos</h2>
        {proximos.length === 0 ? (
          <p className="text-texto-suave">Nenhum agendamento marcado.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {proximos.map((agendamento) => (
              <li key={agendamento.id}>
                <ItemDoAgendamento agendamento={agendamento} aoAbrir={() => setAbertoId(agendamento.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Histórico</h2>
        {historico.length === 0 ? (
          <p className="text-texto-suave">Ainda não há atendimentos.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {historico.map((agendamento) => (
              <li key={agendamento.id}>
                <ItemDoAgendamento agendamento={agendamento} aoAbrir={() => setAbertoId(agendamento.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Privacidade</h2>
        <p className="text-texto-suave">
          Se o cliente pedir, você pode remover os dados pessoais do app.
        </p>
        <Botao variante="secundario" larguraTotal aoClicar={() => setRemovendo(true)}>
          <UserX className="size-5" aria-hidden="true" />
          Remover dados do cliente
        </Botao>
      </section>

      <PainelDoAtendimento
        agendamento={aberto}
        salao={salao}
        aoFechar={() => setAbertoId(null)}
        aoMudar={aoMudarStatus}
      />

      <Dialogo
        aberto={removendo}
        titulo={proximos.length > 0 ? 'Cancele os agendamentos antes' : 'Remover dados de ' + primeiroNome + '?'}
        aoFechar={() => setRemovendo(false)}
      >
        {proximos.length > 0 ? (
          <>
            <p>
              {primeiroNome} tem{' '}
              <strong>{proximos.length === 1 ? '1 agendamento futuro' : proximos.length + ' agendamentos futuros'}</strong>.
              Os dados só podem ser removidos depois que eles forem cancelados.
            </p>
            <p className="text-texto-suave">
              Toque em cada um em Próximos agendamentos e escolha Cancelar atendimento. Se quiser, avise pelo WhatsApp
              antes.
            </p>
            <Botao larguraTotal aoClicar={() => setRemovendo(false)}>
              Entendi
            </Botao>
          </>
        ) : (
          <>
            {historico.length > 0 ? (
              <p>
                O nome vira <strong>Cliente removido</strong> e o celular e as observações são apagados.{' '}
                {historico.length === 1 ? 'O agendamento fica' : 'Os ' + historico.length + ' agendamentos ficam'} no
                histórico do salão, sem os dados pessoais.
              </p>
            ) : (
              <p>O cadastro de {cliente.nome} é apagado por completo, porque não tem nenhum agendamento.</p>
            )}
            <p className="text-texto-suave">Não dá para desfazer.</p>
            <div className="flex flex-col gap-2">
              <Botao variante="secundario" larguraTotal aoClicar={() => setRemovendo(false)}>
                Manter dados
              </Botao>
              <Botao variante="perigo" larguraTotal carregando={ocupado} aoClicar={remover}>
                <UserX className="size-5" aria-hidden="true" />
                Remover dados
              </Botao>
            </div>
          </>
        )}
      </Dialogo>

      <Aviso aviso={aviso} definirAviso={setAviso} alto />
    </>
  )
}

export default FichaDoCliente
