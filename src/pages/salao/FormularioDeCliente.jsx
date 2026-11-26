import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Card from '../../components/Card.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import RodapeFixo from '../../components/RodapeFixo.jsx'
import { buscarFichaDoCliente, conferirCliente, salvarCliente } from '../../data/consultas.js'
import { formatarCelular } from '../../utils/cliente.js'

function FormularioDeCliente() {
  const params = useParams()
  const navegar = useNavigate()
  const editando = params.id !== undefined
  const id = editando ? Number(params.id) : null
  const [carregado, setCarregado] = useState(!editando)
  const [existe, setExiste] = useState(true)
  const [formulario, setFormulario] = useState({ nome: '', celular: '', observacoes: '' })
  const [inicial, setInicial] = useState(JSON.stringify({ nome: '', celular: '', observacoes: '' }))
  const [erros, setErros] = useState({})
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')
  const saindoDeProposito = useRef(false)

  useEffect(() => {
    if (!editando) return
    async function carregar() {
      const ficha = Number.isInteger(id) ? await buscarFichaDoCliente(id) : null
      if (!ficha) {
        setExiste(false)
      } else {
        const dados = {
          nome: ficha.cliente.nome,
          celular: formatarCelular(ficha.cliente.telefone),
          observacoes: ficha.cliente.observacoes || '',
        }
        setFormulario(dados)
        setInicial(JSON.stringify(dados))
      }
      setCarregado(true)
    }
    carregar()
  }, [editando, id])

  useEffect(() => {
    if (!tentouSalvar) return
    let atual = true
    async function conferir() {
      const encontrados = await conferirCliente({ id, ...formulario })
      if (atual) setErros(encontrados)
    }
    conferir()
    return () => {
      atual = false
    }
  }, [tentouSalvar, formulario, id])

  const sujo = JSON.stringify(formulario) !== inicial

  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) =>
      sujo && !saindoDeProposito.current && currentLocation.pathname !== nextLocation.pathname,
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

  function mudar(campo, valor) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }))
  }

  async function salvar() {
    setTentouSalvar(true)
    setErroGeral('')
    const encontrados = await conferirCliente({ id, ...formulario })
    setErros(encontrados)
    const campo = ['nome', 'celular', 'observacoes'].find((chave) => encontrados[chave])
    if (campo) {
      const elemento = document.getElementById('campo-cliente-' + campo)
      elemento.scrollIntoView({ block: 'center' })
      elemento.focus({ preventScroll: true })
      return
    }

    setSalvando(true)
    const resultado = await salvarCliente({ id, ...formulario })
    setSalvando(false)
    if (resultado.erro) {
      if (resultado.erros) setErros(resultado.erros)
      setErroGeral(
        resultado.erro === 'invalido' ? 'Confira os campos marcados.' : 'Não conseguimos salvar. Tente de novo.',
      )
      return
    }
    saindoDeProposito.current = true
    navegar('/salao/clientes/' + resultado.cliente.id, {
      replace: true,
      state: { aviso: editando ? 'Dados salvos.' : 'Cliente cadastrado.' },
    })
  }

  if (!carregado) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando
        </p>
        <Esqueleto classes="h-12 w-full" />
        <Esqueleto classes="h-12 w-full" />
        <Esqueleto classes="h-24 w-full" />
      </>
    )
  }

  if (!existe) {
    return (
      <Card>
        <p className="font-semibold">Cliente não encontrado.</p>
        <Botao para="/salao/clientes" variante="secundario">
          Ver clientes
        </Botao>
      </Card>
    )
  }

  const mostrar = (campo) => (tentouSalvar ? erros[campo] || '' : '')

  return (
    <>
      <CampoTexto
        id="campo-cliente-nome"
        rotulo="Nome"
        valor={formulario.nome}
        aoMudar={(valor) => mudar('nome', valor)}
        erro={mostrar('nome')}
        autoCompletar="off"
        limite={80}
        obrigatorio
      />
      <CampoTexto
        id="campo-cliente-celular"
        rotulo="Celular / WhatsApp"
        tipo="tel"
        valor={formulario.celular}
        aoMudar={(valor) => mudar('celular', formatarCelular(valor))}
        erro={mostrar('celular')}
        placeholder="(DDD) 9XXXX-XXXX"
        modoDeEntrada="tel"
        autoCompletar="off"
        limite={20}
        obrigatorio
      />
      <CampoTexto
        id="campo-cliente-observacoes"
        rotulo="Observações"
        valor={formulario.observacoes}
        aoMudar={(valor) => mudar('observacoes', valor)}
        erro={mostrar('observacoes')}
        ajuda={formulario.observacoes.length + ' de 500 caracteres. Ex.: alergias, cor usada, preferências.'}
        opcional
        multilinha
        limite={500}
      />
      <p className="flex items-start gap-2 text-texto-suave">
        <LockKeyhole className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        As observações só aparecem na área do salão. O cliente nunca vê.
      </p>

      <RodapeFixo>
        {erroGeral && <MensagemErro texto={erroGeral} />}
        <Botao larguraTotal grande carregando={salvando} aoClicar={salvar}>
          {salvando ? 'Salvando...' : editando ? 'Salvar dados' : 'Cadastrar cliente'}
        </Botao>
      </RodapeFixo>

      <Dialogo
        aberto={bloqueio.state === 'blocked'}
        titulo="Sair sem salvar?"
        aoFechar={() => {
          if (bloqueio.state === 'blocked') bloqueio.reset()
        }}
      >
        <p className="text-texto-suave">O que você mudou vai ser perdido.</p>
        <div className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal aoClicar={() => bloqueio.reset()}>
            Continuar editando
          </Botao>
          <Botao variante="perigo" larguraTotal aoClicar={() => bloqueio.proceed()}>
            Sair sem salvar
          </Botao>
        </div>
      </Dialogo>
    </>
  )
}

export default FormularioDeCliente
