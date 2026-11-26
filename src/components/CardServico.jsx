import { Check, Clock, Droplets, Palette, Plus, Ruler, Scissors, Sparkles, Wind } from 'lucide-react'
import PrecoDoServico from './PrecoDoServico.jsx'
import { formatarDuracao } from '../utils/formatos.js'
import { precoParaMostrar } from '../utils/precos.js'

const iconesPorCategoria = {
  Corte: Scissors,
  Coloração: Palette,
  Escova: Wind,
  Tratamento: Droplets,
  Barba: Sparkles,
}

function textoDaDuracao(servico, variacao) {
  if (variacao) return formatarDuracao(variacao.duracao_min)
  if (servico.variacoes.length === 0) return formatarDuracao(servico.duracao_min)
  const duracoes = servico.variacoes.map((item) => item.duracao_min)
  return formatarDuracao(Math.min(...duracoes)) + ' a ' + formatarDuracao(Math.max(...duracoes))
}

function Acao({ selecionado, temVariacoes }) {
  if (selecionado) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border-2 border-principal bg-principal px-3 py-0.5 font-semibold text-sobre-principal">
        <Check className="size-4" aria-hidden="true" />
        Adicionado
      </span>
    )
  }

  const Icone = temVariacoes ? Ruler : Plus
  return (
    <span className="inline-flex items-center gap-1 rounded-full border-2 border-principal px-3 py-0.5 font-semibold text-principal">
      <Icone className="size-4" aria-hidden="true" />
      {temVariacoes ? 'Escolher tamanho' : 'Adicionar'}
    </span>
  )
}

function CardServico({ servico, itemEscolhido, aoTocar }) {
  const selecionado = Boolean(itemEscolhido)
  const variacao = itemEscolhido ? itemEscolhido.variacao : null
  const temVariacoes = servico.variacoes.length > 0
  const nome = variacao ? servico.nome + ' · ' + variacao.nome : servico.nome
  const mostrar = precoParaMostrar(servico, variacao)
  const Icone = iconesPorCategoria[servico.categoria] || Scissors
  const corDaBorda = selecionado ? 'border-principal' : 'border-borda'

  return (
    <button
      type="button"
      onClick={aoTocar}
      aria-pressed={temVariacoes ? undefined : selecionado}
      aria-haspopup={temVariacoes ? 'dialog' : undefined}
      className={`flex w-full gap-3 rounded-2xl border-2 bg-superficie p-3 text-left ${corDaBorda}`}
    >
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-capa text-destaque">
        {servico.foto_url ? (
          <img src={servico.foto_url} alt="" className="size-full object-cover" />
        ) : (
          <Icone className="size-7" aria-hidden="true" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-3">
          <span className="font-semibold">{nome}</span>
          <PrecoDoServico tipoPreco={mostrar.tipoPreco} preco={mostrar.preco} />
        </span>
        <span className="line-clamp-2 text-texto-suave">{servico.descricao}</span>
        <span className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-texto-suave">
            <Clock className="size-4" aria-hidden="true" />
            {textoDaDuracao(servico, variacao)}
          </span>
          <Acao selecionado={selecionado} temVariacoes={temVariacoes} />
        </span>
      </span>
    </button>
  )
}

export default CardServico
