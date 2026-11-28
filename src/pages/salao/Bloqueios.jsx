import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CalendarOff, Plus, Trash2 } from 'lucide-react'
import AgendamentosAfetados from '../../components/AgendamentosAfetados.jsx'
import Aviso from '../../components/Aviso.jsx'
import Botao from '../../components/Botao.jsx'
import Card from '../../components/Card.jsx'
import Dialogo from '../../components/Dialogo.jsx'
import ErroAoCarregar from '../../components/ErroAoCarregar.jsx'
import Esqueleto from '../../components/Esqueleto.jsx'
import {
  buscarSalao,
  conflitosDoBloqueio,
  listarBloqueiosFuturos,
  listarProfissionaisAtivos,
  removerBloqueio,
} from '../../data/consultas.js'
import { codigoDoProblema } from '../../data/supabase/erros.js'
import { descreverBloqueio } from '../../utils/expediente.js'

function Bloqueios() {
  const [erroAoCarregar, setErroAoCarregar] = useState(null)
  const location = useLocation()
  const idCriado = location.state && Number.isInteger(location.state.bloqueioId) ? location.state.bloqueioId : null
  const [dados, setDados] = useState(null)
  const [paraAvisar, setParaAvisar] = useState([])
  const [removendo, setRemovendo] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState(() =>
    location.state && typeof location.state.aviso === 'string'
      ? { id: Date.now(), tipo: 'sucesso', mensagem: location.state.aviso }
      : null,
  )

  useEffect(() => {
    async function carregar() {
      const [bloqueios, profissionais, salao] = await Promise.all([
        listarBloqueiosFuturos(),
        listarProfissionaisAtivos(),
        buscarSalao(),
      ])
      setDados({ bloqueios, profissionais, salao })
      const criado = bloqueios.find((bloqueio) => bloqueio.id === idCriado)
      if (criado) setParaAvisar(await conflitosDoBloqueio(criado.profissional_id, criado.inicio, criado.fim))
    }
    carregar().catch((problema) => setErroAoCarregar(codigoDoProblema(problema)))
  }, [idCriado])

  async function confirmarRemocao() {
    setOcupado(true)
    const resultado = await removerBloqueio(removendo.id)
    setOcupado(false)
    if (resultado.erro) {
      setAviso({ id: Date.now(), tipo: 'erro', mensagem: 'Não conseguimos remover. Tente de novo.' })
      setRemovendo(null)
      return
    }
    const removido = removendo
    setRemovendo(null)
    setDados({ ...dados, bloqueios: await listarBloqueiosFuturos() })
    if (removido.id === idCriado) setParaAvisar([])
    setAviso({ id: Date.now(), tipo: 'sucesso', mensagem: 'Bloqueio removido. Os horários voltaram a ficar livres.' })
    requestAnimationFrame(() => document.getElementById('titulo-bloqueios').focus())
  }

  if (erroAoCarregar) {
    return <ErroAoCarregar codigo={erroAoCarregar} aoTentarDeNovo={() => window.location.reload()} />
  }

  if (!dados) {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando bloqueios
        </p>
        <Esqueleto classes="h-24 w-full" />
        <Esqueleto classes="h-24 w-full" />
      </>
    )
  }

  const grupos = dados.profissionais
    .map((profissional) => ({
      profissional,
      bloqueios: dados.bloqueios.filter((bloqueio) => bloqueio.profissional_id === profissional.id),
    }))
    .filter((grupo) => grupo.bloqueios.length > 0)

  return (
    <>
      <p id="titulo-bloqueios" tabIndex={-1} className="text-texto-suave">
        Folgas, férias e compromissos que ainda vão acontecer. Nesses horários ninguém consegue agendar.
      </p>

      {paraAvisar.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Avise os clientes</h2>
          <p className="text-texto-suave">
            O bloqueio novo bate com {paraAvisar.length === 1 ? '1 agendamento' : paraAvisar.length + ' agendamentos'}.
            Eles não foram cancelados.
          </p>
          <AgendamentosAfetados agendamentos={paraAvisar} nomeDoSalao={dados.salao.nome} />
        </section>
      )}

      {grupos.length === 0 && (
        <Card>
          <p className="font-semibold">Nenhuma folga ou bloqueio marcado.</p>
          <p className="text-texto-suave">Toque em Novo bloqueio para marcar férias, folga ou compromisso.</p>
        </Card>
      )}

      {grupos.map((grupo) => (
        <section key={grupo.profissional.id} className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">{grupo.profissional.nome}</h2>
          <ul className="flex flex-col gap-3">
            {grupo.bloqueios.map((bloqueio) => {
              const descricao = descreverBloqueio(bloqueio)
              return (
                <li
                  key={bloqueio.id}
                  className="flex items-center gap-3 rounded-2xl border-2 border-borda bg-superficie p-3"
                >
                  <CalendarOff className="size-6 shrink-0 text-principal" aria-hidden="true" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{bloqueio.motivo || 'Bloqueio'}</span>
                    <span>{descricao.datas}</span>
                    <span className="text-texto-suave">{descricao.horario}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRemovendo(bloqueio)}
                    aria-label={'Remover ' + (bloqueio.motivo || 'bloqueio') + ', ' + descricao.datas}
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-perigo text-perigo"
                  >
                    <Trash2 className="size-5" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="h-20" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-borda bg-superficie">
        <div className="mx-auto max-w-lg px-4 py-3">
          <Botao para="/salao/configuracoes/bloqueios/novo" larguraTotal grande>
            <Plus className="size-6" aria-hidden="true" />
            Novo bloqueio
          </Botao>
        </div>
      </div>

      <Dialogo aberto={removendo !== null} titulo="Remover bloqueio?" aoFechar={() => setRemovendo(null)}>
        {removendo && (
          <p className="text-texto-suave">
            {removendo.motivo || 'Bloqueio'} de {removendo.profissional ? removendo.profissional.nome.split(' ')[0] : ''} ·{' '}
            {descreverBloqueio(removendo).datas}. Os horários voltam a ficar livres para agendar.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Botao variante="secundario" larguraTotal aoClicar={() => setRemovendo(null)}>
            Manter bloqueio
          </Botao>
          <Botao variante="perigo" larguraTotal carregando={ocupado} aoClicar={confirmarRemocao}>
            <Trash2 className="size-5" aria-hidden="true" />
            Remover
          </Botao>
        </div>
      </Dialogo>

      <Aviso aviso={aviso} definirAviso={setAviso} alto />
    </>
  )
}

export default Bloqueios
