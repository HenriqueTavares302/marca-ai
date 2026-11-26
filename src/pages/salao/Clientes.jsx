import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Search, UserPlus } from 'lucide-react'
import Aviso from '../../components/Aviso.jsx'
import Botao from '../../components/Botao.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Card from '../../components/Card.jsx'
import Chip from '../../components/Chip.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import { listarClientesDoSalao } from '../../data/consultas.js'
import {
  filtrarClientes,
  formatarCelular,
  ordenarClientes,
  ordensDeClientes,
  textoDaQuantidadeDeAtendimentos,
  textoDoUltimoAtendimento,
} from '../../utils/cliente.js'
import { hojeEmSaoPaulo } from '../../utils/fuso.js'

function Clientes() {
  const location = useLocation()
  const [hoje] = useState(hojeEmSaoPaulo)
  const [clientes, setClientes] = useState(null)
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState('nome')
  const [aviso, setAviso] = useState(() =>
    location.state && typeof location.state.aviso === 'string'
      ? { id: Date.now(), tipo: 'sucesso', mensagem: location.state.aviso }
      : null,
  )

  useEffect(() => {
    async function carregar() {
      setClientes(await listarClientesDoSalao())
    }
    carregar()
  }, [])

  const buscando = busca.trim().length > 0
  const visiveis = clientes ? ordenarClientes(buscando ? filtrarClientes(clientes, busca) : clientes, ordem) : []

  return (
    <>
      <CampoTexto
        id="campo-busca-clientes"
        rotulo="Buscar por nome ou celular"
        tipo="search"
        valor={busca}
        aoMudar={setBusca}
        autoCompletar="off"
        limite={60}
        acao={<Search className="mr-4 size-5 text-texto-suave" aria-hidden="true" />}
      />

      <div className="flex flex-col gap-2">
        <p className="font-medium" id="rotulo-ordem">
          Ordenar por
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rotulo-ordem">
          {ordensDeClientes.map((opcao) => (
            <Chip key={opcao.valor} selecionado={ordem === opcao.valor} aoClicar={() => setOrdem(opcao.valor)}>
              {opcao.rotulo}
            </Chip>
          ))}
        </div>
      </div>

      <p className="text-texto-suave" role="status">
        {!clientes
          ? 'Carregando clientes'
          : buscando
            ? visiveis.length === 1
              ? '1 cliente encontrado'
              : visiveis.length + ' clientes encontrados'
            : visiveis.length === 1
              ? '1 cliente'
              : visiveis.length + ' clientes'}
      </p>

      {!clientes && (
        <div className="flex flex-col gap-3">
          <Esqueleto classes="h-24 w-full" />
          <Esqueleto classes="h-24 w-full" />
          <Esqueleto classes="h-24 w-full" />
        </div>
      )}

      {clientes && visiveis.length === 0 && (
        <Card>
          <p className="font-semibold">{buscando ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>
          <p className="text-texto-suave">
            {buscando ? 'Confira o nome ou tente um pedaço do celular.' : 'Toque em Novo cliente para cadastrar.'}
          </p>
        </Card>
      )}

      {clientes && visiveis.length > 0 && (
        <ul className="flex flex-col gap-3">
          {visiveis.map((cliente) => (
            <li key={cliente.id}>
              <Link
                to={'/salao/clientes/' + cliente.id}
                className="flex min-h-12 items-center gap-3 rounded-2xl border-2 border-borda bg-superficie p-3"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{cliente.nome}</span>
                  <span>{formatarCelular(cliente.telefone)}</span>
                  <span className="text-texto-suave">
                    {textoDoUltimoAtendimento(cliente.ultimo_atendimento, hoje)} ·{' '}
                    {textoDaQuantidadeDeAtendimentos(cliente.atendimentos)}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-texto-suave" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="h-20" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-borda bg-superficie">
        <div className="mx-auto max-w-lg px-4 py-3">
          <Botao para="/salao/clientes/novo" larguraTotal grande>
            <UserPlus className="size-6" aria-hidden="true" />
            Novo cliente
          </Botao>
        </div>
      </div>

      <Aviso aviso={aviso} definirAviso={setAviso} alto />
    </>
  )
}

export default Clientes
