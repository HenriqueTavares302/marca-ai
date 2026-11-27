import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LinkIcon } from 'lucide-react'
import Botao from '../../components/Botao.jsx'
import CampoSenha from '../../components/CampoSenha.jsx'
import MensagemErro from '../../components/MensagemErro.jsx'
import TelaDeAcesso from '../../components/TelaDeAcesso.jsx'
import { definirNovaSenha, erroDaConfirmacao, erroDaSenha, temSessaoParaNovaSenha } from '../../utils/sessao.js'

const mensagensDeErro = {
  senha_igual: 'A senha nova precisa ser diferente da anterior.',
  senha_fraca: 'Essa senha é fácil de adivinhar. Escolha outra, misturando letras e números.',
  sem_acesso: 'Sua conta foi criada, mas ainda não está ligada a um profissional do salão. Fale com o dono.',
  sem_configuracao: 'O login ainda não está configurado neste endereço.',
}

function NovaSenha() {
  const navegar = useNavigate()
  const [estado, setEstado] = useState('conferindo')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [tocados, setTocados] = useState({ senha: false, confirmacao: false })
  const [tentou, setTentou] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroGeral, setErroGeral] = useState('')

  useEffect(() => {
    let ativo = true
    async function conferir() {
      const temSessao = await temSessaoParaNovaSenha()
      if (ativo) setEstado(temSessao ? 'formulario' : 'sem_link')
    }
    conferir()
    return () => {
      ativo = false
    }
  }, [])

  const erroSenha = erroDaSenha(senha)
  const erroConfirmacao = erroDaConfirmacao(senha, confirmacao)
  const erroSenhaVisivel = tocados.senha || tentou ? erroSenha : ''
  const erroConfirmacaoVisivel = tocados.confirmacao || tentou ? erroConfirmacao : ''

  async function aoEnviar(evento) {
    evento.preventDefault()
    if (salvando) return
    setTentou(true)
    setErroGeral('')
    if (erroSenha) {
      document.getElementById('campo-senha').focus()
      return
    }
    if (erroConfirmacao) {
      document.getElementById('campo-confirmacao').focus()
      return
    }

    setSalvando(true)
    const resultado = await definirNovaSenha(senha)
    if (resultado.erro === 'link_vencido') {
      setEstado('sem_link')
      return
    }
    if (resultado.erro) {
      setSalvando(false)
      setErroGeral(mensagensDeErro[resultado.erro] || 'Não conseguimos salvar agora. Confira a internet e tente de novo.')
      return
    }
    navegar('/salao', { replace: true })
  }

  return (
    <TelaDeAcesso titulo="Criar senha" voltarPara="/salao/entrar" textoDoVoltar="Voltar para entrar">
      {estado === 'conferindo' && (
        <p role="status" className="text-center text-texto-suave">
          Conferindo o link...
        </p>
      )}

      {estado === 'sem_link' && (
        <div role="alert" className="flex flex-col gap-4 rounded-2xl border-2 border-borda bg-superficie p-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-capa text-destaque">
            <LinkIcon className="size-6" aria-hidden="true" />
          </span>
          <p className="font-semibold">Este link venceu ou já foi usado</p>
          <p className="text-texto-suave">Peça um link novo. Ele chega no seu e-mail e vale por 1 hora.</p>
          <Botao para="/salao/esqueci-senha" larguraTotal>
            Pedir outro link
          </Botao>
        </div>
      )}

      {estado === 'formulario' && (
        <form noValidate onSubmit={aoEnviar} className="flex flex-col gap-4">
          <p className="text-texto-suave">Escolha a senha que você vai usar para entrar na área do salão.</p>
          <CampoSenha
            id="campo-senha"
            rotulo="Senha nova"
            valor={senha}
            aoMudar={setSenha}
            aoSair={() => setTocados({ ...tocados, senha: true })}
            erro={erroSenhaVisivel}
            ajuda="Pelo menos 8 caracteres."
            autoCompletar="new-password"
          />
          <CampoSenha
            id="campo-confirmacao"
            rotulo="Repita a senha nova"
            valor={confirmacao}
            aoMudar={setConfirmacao}
            aoSair={() => setTocados({ ...tocados, confirmacao: true })}
            erro={erroConfirmacaoVisivel}
            autoCompletar="new-password"
          />

          {erroGeral && (
            <div role="alert">
              <MensagemErro texto={erroGeral} />
            </div>
          )}

          <Botao tipo="submit" larguraTotal grande carregando={salvando}>
            {!salvando && <KeyRound className="size-5" aria-hidden="true" />}
            {salvando ? 'Salvando...' : 'Salvar senha e entrar'}
          </Botao>
        </form>
      )}
    </TelaDeAcesso>
  )
}

export default NovaSenha
