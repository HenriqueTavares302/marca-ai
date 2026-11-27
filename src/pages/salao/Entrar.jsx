import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import CampoSenha from '../../components/CampoSenha.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import TelaDeAcesso from '../../components/TelaDeAcesso.jsx'
import { caminhoDeVoltaSeguro, entrar, erroDaSenha, erroDoEmail, profissionalLogado } from '../../utils/sessao.js'

const mensagensDeErro = {
  credenciais: 'E-mail ou senha incorretos.',
  sem_acesso: 'Este e-mail não tem acesso à área do salão.',
  muitas_tentativas: 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  sem_configuracao: 'O login ainda não está configurado neste endereço.',
}

function Entrar() {
  const navegar = useNavigate()
  const location = useLocation()
  const voltarPara = caminhoDeVoltaSeguro(location.state && location.state.voltarPara)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [tocados, setTocados] = useState({ email: false, senha: false })
  const [tentouEntrar, setTentouEntrar] = useState(false)
  const [entrando, setEntrando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')

  if (profissionalLogado() !== null) {
    return <Navigate to={voltarPara} replace />
  }

  const erroEmail = erroDoEmail(email)
  const erroSenha = senha.length === 0 ? 'Digite sua senha.' : ''
  const erroEmailVisivel = tocados.email || tentouEntrar ? erroEmail : ''
  const erroSenhaVisivel = tocados.senha || tentouEntrar ? erroSenha : ''

  function limparSenha() {
    setSenha('')
    setTentouEntrar(false)
    setTocados({ email: true, senha: false })
  }

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
    if (erroDaSenha(senha)) {
      limparSenha()
      setErroGeral(mensagensDeErro.credenciais)
      return
    }

    setEntrando(true)
    const resultado = await entrar(email.trim(), senha)
    if (resultado.erro) {
      limparSenha()
      setEntrando(false)
      setErroGeral(mensagensDeErro[resultado.erro] || 'Não conseguimos entrar agora. Confira a internet e tente de novo.')
      return
    }
    navegar(voltarPara, { replace: true })
  }

  return (
    <TelaDeAcesso titulo="Entrar como profissional" voltarPara="/" textoDoVoltar="Voltar para a vitrine">
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

        <CampoSenha
          id="campo-senha"
          rotulo="Senha"
          valor={senha}
          aoMudar={setSenha}
          aoSair={() => setTocados({ ...tocados, senha: true })}
          erro={erroSenhaVisivel}
          autoCompletar="current-password"
        />

        <Link
          to="/salao/esqueci-senha"
          className="flex min-h-12 items-center self-end font-semibold text-principal underline underline-offset-4"
        >
          Esqueci minha senha
        </Link>

        {erroGeral && (
          <div role="alert">
            <MensagemErro texto={erroGeral} />
          </div>
        )}

        <Botao tipo="submit" larguraTotal grande carregando={entrando}>
          {!entrando && <LogIn className="size-5" aria-hidden="true" />}
          {entrando ? 'Entrando...' : 'Entrar'}
        </Botao>
      </form>

      <p className="text-center text-texto-suave">
        Ainda não tem acesso? Peça ao dono do salão para convidar você.
      </p>
    </TelaDeAcesso>
  )
}

export default Entrar
