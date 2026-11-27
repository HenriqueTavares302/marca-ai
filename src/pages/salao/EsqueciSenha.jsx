import { useState } from 'react'
import { MailCheck, Send } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import CampoTexto from '../../components/CampoTexto.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import TelaDeAcesso from '../../components/TelaDeAcesso.jsx'
import { erroDoEmail, pedirLinkDeSenha } from '../../utils/sessao.js'

const mensagensDeErro = {
  muitas_tentativas: 'Já enviamos vários links agora há pouco. Espere alguns minutos e tente de novo.',
  sem_configuracao: 'O login ainda não está configurado neste endereço.',
}

function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [tocado, setTocado] = useState(false)
  const [tentou, setTentou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erroGeral, setErroGeral] = useState('')

  const erroEmail = erroDoEmail(email)
  const erroEmailVisivel = tocado || tentou ? erroEmail : ''

  async function aoEnviar(evento) {
    evento.preventDefault()
    if (enviando) return
    setTentou(true)
    setErroGeral('')
    if (erroEmail) {
      document.getElementById('campo-email').focus()
      return
    }
    setEnviando(true)
    const resultado = await pedirLinkDeSenha(email.trim())
    setEnviando(false)
    if (resultado.erro) {
      setErroGeral(mensagensDeErro[resultado.erro] || 'Não conseguimos enviar agora. Confira a internet e tente de novo.')
      return
    }
    setEnviado(true)
  }

  return (
    <TelaDeAcesso titulo="Esqueci minha senha" voltarPara="/salao/entrar" textoDoVoltar="Voltar para entrar">
      {enviado ? (
        <div role="status" className="flex flex-col gap-4 rounded-2xl border-2 border-borda bg-superficie p-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-capa text-destaque">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
          <p className="font-semibold">Confira seu e-mail</p>
          <p>
            Se <span className="font-semibold break-all">{email.trim()}</span> tiver acesso à área do salão, enviamos um
            link para criar uma senha nova.
          </p>
          <p className="text-texto-suave">O link vale por 1 hora. Se não chegar em alguns minutos, olhe também o spam.</p>
          <Botao para="/salao/entrar" larguraTotal>
            Voltar para entrar
          </Botao>
        </div>
      ) : (
        <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
          <p className="text-texto-suave">Digite o e-mail que você usa para entrar. Vamos mandar um link para criar uma senha nova.</p>
          <CampoTexto
            id="campo-email"
            rotulo="E-mail"
            tipo="email"
            valor={email}
            aoMudar={setEmail}
            aoSair={() => setTocado(true)}
            erro={erroEmailVisivel}
            placeholder="nome@exemplo.com"
            obrigatorio
            modoDeEntrada="email"
            autoCompletar="username"
            limite={120}
          />

          {erroGeral && (
            <div role="alert">
              <MensagemErro texto={erroGeral} />
            </div>
          )}

          <Botao tipo="submit" larguraTotal grande carregando={enviando}>
            {!enviando && <Send className="size-5" aria-hidden="true" />}
            {enviando ? 'Enviando...' : 'Enviar link'}
          </Botao>
        </form>
      )}
    </TelaDeAcesso>
  )
}

export default EsqueciSenha
