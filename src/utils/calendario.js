function dataEmUtc(dataIso) {
  return new Date(dataIso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escaparTexto(texto) {
  return String(texto)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function dobrarLinha(linha) {
  const codificador = new TextEncoder()
  const partes = []
  let atual = ''
  let tamanho = 0
  for (const letra of linha) {
    const bytes = codificador.encode(letra).length
    const limite = partes.length === 0 ? 75 : 74
    if (tamanho + bytes > limite) {
      partes.push(atual)
      atual = ''
      tamanho = 0
    }
    atual += letra
    tamanho += bytes
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

export function gerarArquivoDeAgenda({ id, titulo, descricao, local, inicio, fim }) {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Marca Ai//Agendamento//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:agendamento-' + id + '@marca-ai',
    'DTSTAMP:' + dataEmUtc(new Date().toISOString()),
    'DTSTART:' + dataEmUtc(inicio),
    'DTEND:' + dataEmUtc(fim),
    'SUMMARY:' + escaparTexto(titulo),
    'DESCRIPTION:' + escaparTexto(descricao),
    'LOCATION:' + escaparTexto(local),
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:' + escaparTexto(titulo),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return linhas.map(dobrarLinha).join('\r\n') + '\r\n'
}

export function baixarArquivoDeAgenda(conteudo, nomeDoArquivo) {
  const arquivo = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' })
  const endereco = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  link.href = endereco
  link.download = nomeDoArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(endereco), 1000)
}

export function linkDoGoogleAgenda({ titulo, descricao, local, inicio, fim }) {
  const parametros = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo,
    dates: dataEmUtc(inicio) + '/' + dataEmUtc(fim),
    details: descricao,
    location: local,
  })
  return 'https://calendar.google.com/calendar/render?' + parametros.toString()
}
