import { useEffect, useState } from 'react'
import { CalendarDays, CircleCheck, CircleX, Clock, House, Scissors, Star, User } from 'lucide-react'
import Aviso from '../components/Aviso.jsx'
import BarraInferior from '../components/BarraInferior.jsx'
import Botao from '../components/Botao.jsx'
import BotaoTema from '../components/BotaoTema.jsx'
import Cabecalho from '../components/Cabecalho.jsx'
import CampoTexto from '../components/CampoTexto.jsx'
import Card from '../components/Card.jsx'
import Chip from '../components/Chip.jsx'
import Seletor from '../components/Seletor.jsx'
import { agendamentosDoDia, buscarSalao, listarServicosPorCategoria } from '../data/consultas.js'

const textoDoStatus = {
  agendado: 'Agendado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  faltou: 'Faltou',
}

const varianteDoStatus = {
  agendado: 'principal',
  concluido: 'neutro',
  cancelado: 'perigo',
  faltou: 'perigo',
}

function formatarHora(dataIso) {
  return new Date(dataIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const itensDaBarra = [
  { caminho: '/', rotulo: 'Início', icone: House, exato: true },
  { caminho: '/servicos', rotulo: 'Serviços', icone: Scissors },
  { caminho: '/agendar', rotulo: 'Agendar', icone: CalendarDays },
  { caminho: '/componentes', rotulo: 'Teste', icone: User },
]

const categorias = ['Corte', 'Coloração', 'Escova', 'Tratamento']

const profissionais = [
  { valor: 'carlos', rotulo: 'Carlos' },
  { valor: 'ana', rotulo: 'Ana' },
  { valor: 'qualquer', rotulo: 'Qualquer profissional' },
]

function Secao({ titulo, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{titulo}</h2>
      {children}
    </section>
  )
}

function Componentes() {
  const [carregando, setCarregando] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [profissional, setProfissional] = useState('')
  const [categoria, setCategoria] = useState('Corte')
  const [aviso, setAviso] = useState(null)
  const [nomeDoSalao, setNomeDoSalao] = useState('')
  const [gruposDeServicos, setGruposDeServicos] = useState([])
  const [agendamentosDeHoje, setAgendamentosDeHoje] = useState([])

  useEffect(() => {
    async function carregarDados() {
      const salao = await buscarSalao()
      setNomeDoSalao(salao.nome)
      setGruposDeServicos(await listarServicosPorCategoria())
      setAgendamentosDeHoje(await agendamentosDoDia(new Date()))
    }
    carregarDados()
  }, [])

  const totalDeServicos = gruposDeServicos.reduce((total, grupo) => total + grupo.servicos.length, 0)

  function simularCarregamento() {
    setCarregando(true)
    setTimeout(() => setCarregando(false), 2000)
  }

  function mostrarAviso(tipo, mensagem) {
    setAviso({ id: Date.now(), tipo, mensagem })
  }

  return (
    <div className="min-h-screen pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <Cabecalho titulo="Componentes" aoVoltar={() => mostrarAviso('sucesso', 'Botão voltar clicado.')} acao={<BotaoTema />} />

      <main className="mx-auto flex max-w-lg flex-col gap-8 p-4">
        <p className="text-texto-suave">
          Página temporária para testar os componentes. Use o botão do topo para trocar entre o modo claro e o escuro.
        </p>

        <Secao titulo="Botões">
          <div className="flex flex-wrap gap-3">
            <Botao>Principal</Botao>
            <Botao variante="secundario">Secundário</Botao>
            <Botao variante="perigo">Perigo</Botao>
          </div>
          <div className="flex flex-wrap gap-3">
            <Botao desabilitado>Desabilitado</Botao>
            <Botao variante="secundario" desabilitado>
              Desabilitado
            </Botao>
            <Botao carregando={carregando} aoClicar={simularCarregamento}>
              {carregando ? 'Salvando...' : 'Clique para carregar'}
            </Botao>
          </div>
          <Botao larguraTotal>Agendar horário</Botao>
        </Secao>

        <Secao titulo="Cards">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">Corte masculino</h3>
              <Chip variante="principal" icone={Star}>
                Mais pedido
              </Chip>
            </div>
            <p className="text-texto-suave">Com lavagem e finalização.</p>
            <p className="flex items-center gap-2 text-texto-suave">
              <Clock className="size-5" aria-hidden="true" />
              40 min
            </p>
            <p className="text-lg font-semibold">R$ 45,00</p>
          </Card>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">Sáb, 29 de nov · 14:00</h3>
              <Chip variante="principal" icone={CircleCheck}>
                Confirmado
              </Chip>
            </div>
            <p>Coloração com Ana</p>
            <p className="text-texto-suave">Cabelo médio · a partir de R$ 120,00</p>
          </Card>
        </Secao>

        <Secao titulo="Campos">
          <CampoTexto
            rotulo="Seu nome"
            valor={nome}
            aoMudar={setNome}
            placeholder="Como podemos te chamar?"
            ajuda="Aparece só para o salão."
          />
          <CampoTexto
            rotulo="Celular"
            tipo="tel"
            valor={telefone}
            aoMudar={setTelefone}
            placeholder="(00) 90000-0000"
            erro={telefone.length > 0 && telefone.length < 10 ? 'Digite o celular com DDD.' : ''}
            ajuda="Digite pelo menos 10 números para ver o erro sumir."
          />
          <Seletor
            rotulo="Profissional"
            valor={profissional}
            aoMudar={setProfissional}
            opcoes={profissionais}
            ajuda="Escolha quem vai te atender."
          />
          <Seletor
            rotulo="Tamanho do cabelo"
            valor=""
            aoMudar={() => {}}
            opcoes={[
              { valor: 'curto', rotulo: 'Curto' },
              { valor: 'medio', rotulo: 'Médio' },
              { valor: 'longo', rotulo: 'Longo' },
            ]}
            erro="Escolha o tamanho para ver o preço."
          />
        </Secao>

        <Secao titulo="Chips">
          <div className="flex flex-wrap gap-2">
            {categorias.map((item) => (
              <Chip key={item} aoClicar={() => setCategoria(item)} selecionado={item === categoria}>
                {item}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip variante="principal" icone={CircleCheck}>
              Confirmado
            </Chip>
            <Chip variante="neutro" icone={Clock}>
              Pendente
            </Chip>
            <Chip variante="perigo" icone={CircleX}>
              Cancelado
            </Chip>
          </div>
        </Secao>

        <Secao titulo="Avisos">
          <div className="flex flex-wrap gap-3">
            <Botao variante="secundario" aoClicar={() => mostrarAviso('sucesso', 'Horário agendado.')}>
              Mostrar sucesso
            </Botao>
            <Botao variante="secundario" aoClicar={() => mostrarAviso('erro', 'Esse horário acabou de ser ocupado. Escolha outro.')}>
              Mostrar erro
            </Botao>
          </div>
        </Secao>

        <Secao titulo="Dados de exemplo">
          <Card>
            <p className="font-semibold">{nomeDoSalao}</p>
            <p>
              {totalDeServicos} serviços em {gruposDeServicos.length} categorias:{' '}
              {gruposDeServicos.map((grupo) => grupo.categoria).join(', ')}.
            </p>
            <p>{agendamentosDeHoje.length} agendamentos hoje:</p>
            <ul className="flex flex-col gap-2">
              {agendamentosDeHoje.map((agendamento) => (
                <li key={agendamento.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{formatarHora(agendamento.inicio)}</span>
                  <span>
                    {agendamento.cliente.nome} com {agendamento.profissional.nome.split(' ')[0]}
                  </span>
                  <Chip variante={varianteDoStatus[agendamento.status]}>{textoDoStatus[agendamento.status]}</Chip>
                </li>
              ))}
            </ul>
          </Card>
        </Secao>

        <Secao titulo="Barra inferior">
          <p className="text-texto-suave">Fica fixa embaixo da tela. O item "Teste" está ativo porque é esta página; os outros levam para a área do cliente.</p>
        </Secao>
      </main>

      <Aviso aviso={aviso} definirAviso={setAviso} />

      <BarraInferior itens={itensDaBarra} />
    </div>
  )
}

export default Componentes
