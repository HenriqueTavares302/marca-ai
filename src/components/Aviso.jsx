import { useEffect } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'

function CaixaDoAviso({ aviso, aoFechar }) {
  const ehErro = aviso.tipo === 'erro'
  const Icone = ehErro ? CircleAlert : CircleCheck
  const corDoIcone = ehErro ? 'text-perigo' : 'text-principal'
  const corDaBorda = ehErro ? 'border-perigo' : 'border-principal'

  return (
    <div
      className={`fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-md items-center gap-3 rounded-2xl border-2 bg-superficie py-2 pr-2 pl-4 text-texto shadow-lg ${corDaBorda}`}
    >
      <Icone className={`size-6 shrink-0 ${corDoIcone}`} aria-hidden="true" />
      <p className="flex-1">
        <span className="font-semibold">{ehErro ? 'Erro: ' : 'Pronto: '}</span>
        {aviso.mensagem}
      </p>
      <button
        type="button"
        onClick={aoFechar}
        aria-label="Fechar aviso"
        className="flex size-12 shrink-0 items-center justify-center rounded-full"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}

function Aviso({ aviso, definirAviso, duracao = 5000 }) {
  useEffect(() => {
    if (!aviso || aviso.tipo === 'erro') return
    const temporizador = setTimeout(() => definirAviso(null), duracao)
    return () => clearTimeout(temporizador)
  }, [aviso, definirAviso, duracao])

  function fechar() {
    definirAviso(null)
  }

  const avisoDeSucesso = aviso && aviso.tipo !== 'erro' ? aviso : null
  const avisoDeErro = aviso && aviso.tipo === 'erro' ? aviso : null

  return (
    <>
      <div role="status" aria-live="polite">
        {avisoDeSucesso && <CaixaDoAviso key={avisoDeSucesso.id} aviso={avisoDeSucesso} aoFechar={fechar} />}
      </div>
      <div role="alert" aria-live="assertive">
        {avisoDeErro && <CaixaDoAviso key={avisoDeErro.id} aviso={avisoDeErro} aoFechar={fechar} />}
      </div>
    </>
  )
}

export default Aviso
