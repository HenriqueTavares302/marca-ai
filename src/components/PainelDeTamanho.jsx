import { useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'
import Botao from './Botao.jsx'
import { formatarDuracao, formatarPreco } from '../utils/formatos.js'

function PainelDeTamanho({ servico, variacaoAtualId, aoEscolher, aoRemover, aoFechar }) {
  const dialogo = useRef(null)

  useEffect(() => {
    const elemento = dialogo.current
    if (servico && !elemento.open) elemento.showModal()
    if (!servico && elemento.open) elemento.close()
  }, [servico])

  function fecharAoTocarFora(evento) {
    if (evento.target === dialogo.current) aoFechar()
  }

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      onClick={fecharAoTocarFora}
      aria-labelledby="titulo-do-painel"
      className="mx-auto mt-auto mb-0 max-h-[85vh] w-full max-w-lg rounded-t-3xl bg-superficie p-0 text-texto backdrop:bg-capa/60"
    >
      {servico && (
        <div className="flex flex-col gap-4 px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <span className="mx-auto h-1.5 w-12 rounded-full bg-borda" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="titulo-do-painel" className="text-2xl font-semibold">
                {servico.nome}
              </h2>
              <p className="text-texto-suave">Escolha o tamanho do cabelo</p>
            </div>
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="flex size-12 shrink-0 items-center justify-center rounded-full"
            >
              <X className="size-6" aria-hidden="true" />
            </button>
          </div>

          <ul className="flex flex-col gap-3">
            {servico.variacoes.map((variacao) => {
              const escolhida = variacao.id === variacaoAtualId
              const corDaBorda = escolhida ? 'border-principal' : 'border-borda'

              return (
                <li key={variacao.id}>
                  <button
                    type="button"
                    onClick={() => aoEscolher(variacao)}
                    aria-pressed={escolhida}
                    className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border-2 bg-superficie px-4 py-3 text-left ${corDaBorda}`}
                  >
                    <span>
                      <span className="flex items-center gap-2 text-lg font-semibold">
                        {variacao.nome}
                        {escolhida && (
                          <span className="inline-flex items-center gap-1 text-principal">
                            <Check className="size-5" aria-hidden="true" />
                            Escolhido
                          </span>
                        )}
                      </span>
                      <span className="block text-texto-suave">{formatarDuracao(variacao.duracao_min)}</span>
                    </span>
                    <span className="text-right font-semibold">
                      {servico.tipo_preco === 'a_partir' && (
                        <span className="block font-normal text-texto-suave">a partir de</span>
                      )}
                      {formatarPreco(variacao.preco)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          {variacaoAtualId && (
            <Botao variante="secundario" larguraTotal aoClicar={aoRemover}>
              Tirar da escolha
            </Botao>
          )}
        </div>
      )}
    </dialog>
  )
}

export default PainelDeTamanho
