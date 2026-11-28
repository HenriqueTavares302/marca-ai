export function criarAgrupador(
  executar,
  {
    espera = 1000,
    maximo = 3000,
    agora = () => Date.now(),
    agendar = (funcao, ms) => setTimeout(funcao, ms),
    desagendar = (marca) => clearTimeout(marca),
  } = {},
) {
  let tipos = []
  let primeiro = null
  let marcado = null

  function disparar() {
    const juntos = tipos
    tipos = []
    primeiro = null
    marcado = null
    executar(juntos)
  }

  return {
    avisar(tipo) {
      if (!tipos.includes(tipo)) tipos.push(tipo)
      if (primeiro === null) primeiro = agora()
      if (marcado !== null) desagendar(marcado)
      marcado = agendar(disparar, Math.max(0, Math.min(espera, primeiro + maximo - agora())))
    },
    parar() {
      if (marcado !== null) desagendar(marcado)
      tipos = []
      primeiro = null
      marcado = null
    },
  }
}
