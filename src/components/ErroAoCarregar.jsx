import { CloudOff, RotateCw, WifiOff } from 'lucide-react'
import Botao from './Botao.jsx'
import { mensagemDoErro } from '../data/supabase/erros.js'

function ErroAoCarregar({ codigo, aoTentarDeNovo, tentando = false }) {
  const Icone = codigo === 'sem_internet' ? WifiOff : CloudOff

  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border-2 border-borda bg-superficie p-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-capa text-destaque">
        <Icone className="size-6" aria-hidden="true" />
      </span>
      <p className="font-semibold">Não conseguimos carregar</p>
      <p className="text-texto-suave">{mensagemDoErro(codigo)}</p>
      {aoTentarDeNovo && (
        <Botao variante="secundario" aoClicar={aoTentarDeNovo} carregando={tentando}>
          {!tentando && <RotateCw className="size-5" aria-hidden="true" />}
          Tentar de novo
        </Botao>
      )}
    </div>
  )
}

export default ErroAoCarregar
