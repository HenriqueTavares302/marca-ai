import BotaoTema from '../components/BotaoTema.jsx'

function Inicio() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-3xl text-destaque" aria-hidden="true">✦</span>
      <h1 className="text-4xl font-semibold text-principal">Marca Aí</h1>
      <p className="text-lg">Seu horário no salão, em poucos toques.</p>
      <p className="text-texto-suave">Em construção</p>
      <BotaoTema />
    </main>
  )
}

export default Inicio
