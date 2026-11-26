export function comportamentoDaRolagem() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

export function rolarFaixaParaODia(data) {
  const dia = document.getElementById('dia-' + data)
  if (!dia) return
  const faixa = dia.parentElement
  const centroDoDia = dia.getBoundingClientRect().left + dia.offsetWidth / 2
  const centroDaFaixa = faixa.getBoundingClientRect().left + faixa.clientWidth / 2
  faixa.scrollBy({ left: centroDoDia - centroDaFaixa })
}

export function mostrarAcimaDoRodape(elemento, margem = 12) {
  const rodape = document.getElementById('rodape-fixo')
  if (!elemento || !rodape) return
  const limite = window.innerHeight - rodape.offsetHeight - margem
  const fundo = elemento.getBoundingClientRect().bottom
  if (fundo > limite) {
    window.scrollBy({ top: fundo - limite, behavior: comportamentoDaRolagem() })
  }
}

export function mostrarHorarioEscolhido(margem = 12) {
  mostrarAcimaDoRodape(document.querySelector('[data-horario-escolhido="true"]'), margem)
}
