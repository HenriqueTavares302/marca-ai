const tiposConhecidos = ['agendamentos', 'bloqueios', 'horarios', 'clientes', 'servicos', 'equipe', 'salao']
const escondidaPorMuitoTempo = 60000

export function assinarCanalDoSalao({ cliente, salaoId, aoAvisar, documento = null, agora = () => Date.now() }) {
  let caiu = false
  let escondidaDesde = null

  const canal = cliente
    .channel('salao:' + salaoId, { config: { private: true } })
    .on('broadcast', { event: 'mudou' }, (mensagem) => {
      const tipo = mensagem && mensagem.payload ? mensagem.payload.tipo : null
      aoAvisar(tiposConhecidos.includes(tipo) ? tipo : 'agendamentos')
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (caiu) aoAvisar('reconectou')
        caiu = false
      } else {
        caiu = true
      }
    })

  function aoMudarVisibilidade() {
    if (documento.visibilityState === 'hidden') {
      escondidaDesde = agora()
      return
    }
    if (escondidaDesde !== null && agora() - escondidaDesde > escondidaPorMuitoTempo) aoAvisar('voltou')
    escondidaDesde = null
  }

  if (documento) documento.addEventListener('visibilitychange', aoMudarVisibilidade)

  return () => {
    if (documento) documento.removeEventListener('visibilitychange', aoMudarVisibilidade)
    cliente.removeChannel(canal)
  }
}
