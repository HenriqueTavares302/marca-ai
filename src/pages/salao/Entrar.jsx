import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, FlaskConical, LogIn } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import BotaoTema from '../../components/BotaoTema.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import { buscarSalao } from '../../data/consultas.js'
import { caminhoDeVoltaSeguro, entrar, erroDaSenha, erroDoEmail, profissionalLogado } from '../../utils/sessao.js'

function Entrar() {
  const navegar = useNavigate()
  const location = useLocation()
  const voltarPara = caminhoDeVoltaSeguro(location.state && location.state.voltarPara)
  const [salao, setSalao] = useState(null)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [tocados, setTocados] = useState({ email: false, senha: false })
  const [tentouEntrar, setTentouEntrar] = useState(false)
  const [entrando, setEntrando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')
  const [explicandoSenha, setExplicandoSenha] = useState(false)

  useEffect(() => {
    document.title = 'Entrar · Marca Aí'
    async function carregar() {
      setSalao(await buscarSalao())
    }
    carregar()
  }, [])

  if (profissionalLogado() !== null) {
    return <Navigate to={voltarPara} replace />
  }

  const erroEmail = erroDoEmail(email)
  const erroSenha = erroDaSenha(senha)
  const erroEmailVisivel = tocados.email || tentouEntrar ? erroEmail : ''
  const erroSenhaVisivel = tocados.senha || tentouEntrar ? erroSenha : ''

  async function aoEnviar(evento) {
    evento.preventDefault()
    if (entrando) return
    setTentouEntrar(true)
    setErroGeral('')
    if (erroEmail) {
      document.getElementById('campo-email').focus()
      return
    }
    if (erroSenha) {
      document.getElementById('campo-senha').focus()
      return
    }

    setEntrando(true)
    const resultado = await entrar(email.trim(), senha)
    setSenha('')
    if (resultado.erro) {
      setEntrando(false)
      setErroGeral('Não conseguimos entrar agora. Tente de novo.')
      return
    }
    navegar(voltarPara, { replace: true })
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 pt-4 pb-10">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex min-h-12 items-center gap-2 font-semibold text-principal underline underline-offset-4"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
            Voltar para a vitrine
          </Link>
          <BotaoTema />
        </div>

        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className="flex size-16 items-center justify-center rounded-full bg-capa text-2xl text-destaque ring-2 ring-destaque ring-offset-2 ring-offset-fundo"
            aria-hidden="true"
          >
            ✦
          </span>
          <p className="text-texto-suave">{salao ? salao.nome : ' '}</p>
          <h1 className="text-3xl font-semibold">Entrar como profissional</h1>
        </div>

        <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
          <CampoTexto
            id="campo-email"
            rotulo="E-mail"
            tipo="email"
            valor={email}
            aoMudar={setEmail}
            aoSair={() => setTocados({ ...tocados, email: true })}
            erro={erroEmailVisivel}
            placeholder="nome@exemplo.com"
            obrigatorio
            modoDeEntrada="email"
            autoCompletar="username"
            limite={120}
          />

          <CampoTexto
            id="campo-senha"
            rotulo="Senha"
            tipo={mostrarSenha ? 'text' : 'password'}
            valor={senha}
            aoMudar={setSenha}
            aoSair={() => setTocados({ ...tocados, senha: true })}
            erro={erroSenhaVisivel}
            obrigatorio
            autoCompletar="current-password"
            limite={128}
            acao={
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                aria-label={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
                aria-pressed={mostrarSenha}
                className="flex size-12 items-center justify-center rounded-xl text-texto-suave"
              >
                {mostrarSenha ? (
                  <EyeOff className="size-5" aria-hidden="true" />
                ) : (
                  <Eye className="size-5" aria-hidden="true" />
                )}
              </button>
            }
          />

          <button
            type="button"
            onClick={() => setExplicandoSenha(true)}
            className="flex min-h-12 items-center self-end font-semibold text-principal underline underline-offset-4"
          >
            Esqueci minha senha
          </button>

          {erroGeral && <MensagemErro texto={erroGeral} />}

          <Botao tipo="submit" larguraTotal grande carregando={entrando}>
            {!entrando && <LogIn className="size-5" aria-hidden="true" />}
            {entrando ? 'Entrando...' : 'Entrar'}
          </Botao>
        </form>

        <p className="flex items-start gap-2 rounded-2xl border-2 border-dashed border-texto-suave p-3 text-texto-suave">
          <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Modo de teste:</span> qualquer e-mail válido e senha com 6 ou mais caracteres
            entram. O login de verdade chega em breve.
          </span>
        </p>
      </div>

      <Dialogo aberto={explicandoSenha} titulo="Esqueci minha senha" aoFechar={() => setExplicandoSenha(false)}>
        <p>A recuperação de senha chega junto com o login de verdade.</p>
        <p className="text-texto-suave">Por enquanto, o app está em modo de teste e qualquer senha com 6 ou mais caracteres entra.</p>
        <Botao larguraTotal aoClicar={() => setExplicandoSenha(false)}>
          Entendi
        </Botao>
      </Dialogo>
    </div>
  )
}

export default Entrar
