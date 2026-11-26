import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, Plus, Search } from 'lucide-react'
import Aviso from '../../components/Aviso.jsx'
import Botao from '../../components/Botao.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Chip from '../../components/Chip.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import { alterarOrdemServico, listarServicosDoSalao } from '../../data/consultas.js'
import { semAcento } from '../../utils/cliente.js'
import { formatarDuracao, formatarPrecoDoServico } from '../../utils/formatos.js'

function textoDaDuracao(servico) {
  if (servico.variacoes.length === 0) return formatarDuracao(servico.duracao_min)
  const duracoes = servico.variacoes.map((variacao) => variacao.duracao_min)
  return formatarDuracao(Math.min(...duracoes)) + ' a ' + formatarDuracao(Math.max(...duracoes))
}

function BotaoDeOrdem({ id, rotulo, desabilitado, aoClicar, children }) {
  return (
    <button
      type="button"
      id={id}
      onClick={aoClicar}
      disabled={desabilitado}
      aria-label={rotulo}
      className="flex size-12 items-center justify-center rounded-xl border-2 border-texto-suave bg-superficie text-texto disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function ItemDoServico({ servico, primeiro, ultimo, mostrarOrdem, aoMover }) {
  return (
    <div
      className={`flex items-stretch gap-2 rounded-2xl border-2 bg-superficie p-2 ${
        servico.ativo ? 'border-borda' : 'border-dashed border-texto-suave'
      }`}
    >
      <Link
        to={'/salao/servicos/' + servico.id}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-semibold">{servico.nome}</span>
          <span className="text-texto-suave">
            {textoDaDuracao(servico)} · {formatarPrecoDoServico(servico)}
          </span>
          {servico.variacoes.length > 0 && (
            <span className="text-texto-suave">
              {servico.variacoes.map((variacao) => variacao.nome).join(', ')}
            </span>
          )}
          <span>
            {servico.ativo ? (
              <Chip variante="principal" icone={Eye}>
                Ativo
              </Chip>
            ) : (
              <Chip icone={EyeOff}>Inativo</Chip>
            )}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden="true" />
        <span className="sr-only">, editar</span>
      </Link>
      {mostrarOrdem && (
        <div className="flex flex-col justify-center gap-2">
          <BotaoDeOrdem
            id={'subir-' + servico.id}
            rotulo={'Subir ' + servico.nome}
            desabilitado={primeiro}
            aoClicar={() => aoMover(servico, 'subir')}
          >
            <ChevronUp className="size-6" aria-hidden="true" />
          </BotaoDeOrdem>
          <BotaoDeOrdem
            id={'descer-' + servico.id}
            rotulo={'Descer ' + servico.nome}
            desabilitado={ultimo}
            aoClicar={() => aoMover(servico, 'descer')}
          >
            <ChevronDown className="size-6" aria-hidden="true" />
          </BotaoDeOrdem>
        </div>
      )}
    </div>
  )
}

function Servicos() {
  const location = useLocation()
  const [dados, setDados] = useState(null)
  const [busca, setBusca] = useState('')
  const [anuncio, setAnuncio] = useState('')
  const [aviso, setAviso] = useState(() =>
    location.state && typeof location.state.aviso === 'string'
      ? { id: Date.now(), tipo: 'sucesso', mensagem: location.state.aviso }
      : null,
  )

  useEffect(() => {
    async function carregar() {
      setDados(await listarServicosDoSalao())
    }
    carregar()
  }, [])

  async function mover(servico, direcao) {
    const resultado = await alterarOrdemServico(servico.id, direcao)
    if (resultado.erro) {
      if (resultado.erro === 'nao_salvou') {
        setAviso({ id: Date.now(), tipo: 'erro', mensagem: 'Não conseguimos mudar a ordem. Tente de novo.' })
      }
      return
    }
    setDados(await listarServicosDoSalao())
    setAnuncio(
      servico.nome +
        (direcao === 'subir' ? ' subiu' : ' desceu') +
        ' para a posição ' +
        resultado.posicao +
        ' de ' +
        resultado.total +
        ' em ' +
        servico.categoria +
        '.',
    )
    const chegouNaPonta = direcao === 'subir' ? resultado.posicao === 1 : resultado.posicao === resultado.total
    const proximoFoco = chegouNaPonta ? (direcao === 'subir' ? 'descer-' : 'subir-') : direcao + '-'
    requestAnimationFrame(() => {
      const botao = document.getElementById(proximoFoco + servico.id)
      if (botao) botao.focus()
    })
  }

  if (!dados) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando serviços
        </p>
        <Esqueleto classes="h-12 w-full" />
        <Esqueleto classes="h-28 w-full" />
        <Esqueleto classes="h-28 w-full" />
      </>
    )
  }

  const termo = semAcento(busca).trim()
  const buscando = termo.length > 0
  const grupos = dados.categorias
    .map((categoria) => {
      const daCategoria = dados.servicos.filter((servico) => servico.categoria === categoria)
      return {
        categoria,
        todos: daCategoria,
        visiveis: daCategoria.filter(
          (servico) => !buscando || semAcento(servico.nome).includes(termo) || semAcento(categoria).includes(termo),
        ),
      }
    })
    .filter((grupo) => grupo.visiveis.length > 0)
  const quantidadeDeInativos = dados.servicos.filter((servico) => !servico.ativo).length

  return (
    <>
      <p className="text-texto-suave">
        Este é o cardápio que o cliente vê. Toque num serviço para editar.
        {quantidadeDeInativos > 0 &&
          ' ' + quantidadeDeInativos + (quantidadeDeInativos === 1 ? ' inativo fica' : ' inativos ficam') + ' escondido do cliente.'}
      </p>

      <CampoTexto
        id="campo-busca-servico-salao"
        rotulo="Buscar serviço"
        tipo="search"
        valor={busca}
        aoMudar={setBusca}
        autoCompletar="off"
        limite={40}
        ajuda={buscando ? 'Limpe a busca para mudar a ordem.' : undefined}
        acao={<Search className="mr-4 size-5 text-texto-suave" aria-hidden="true" />}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {anuncio}
      </p>

      {grupos.length === 0 && (
        <p className="text-texto-suave">{buscando ? 'Nenhum serviço com esse nome.' : 'Nenhum serviço cadastrado ainda.'}</p>
      )}

      {grupos.map((grupo) => (
        <section key={grupo.categoria} className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">{grupo.categoria}</h2>
          <ul className="flex flex-col gap-3">
            {grupo.visiveis.map((servico) => (
              <li key={servico.id}>
                <ItemDoServico
                  servico={servico}
                  primeiro={grupo.todos[0].id === servico.id}
                  ultimo={grupo.todos[grupo.todos.length - 1].id === servico.id}
                  mostrarOrdem={!buscando && grupo.todos.length > 1}
                  aoMover={mover}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="h-20" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-borda bg-superficie">
        <div className="mx-auto max-w-lg px-4 py-3">
          <Botao para="/salao/servicos/novo" larguraTotal grande>
            <Plus className="size-6" aria-hidden="true" />
            Novo serviço
          </Botao>
        </div>
      </div>

      <Aviso aviso={aviso} definirAviso={setAviso} alto />
    </>
  )
}

export default Servicos
