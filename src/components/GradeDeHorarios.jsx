import { Check } from 'lucide-react'

const periodos = [
  { nome: 'Manhã', de: 0, ate: 12 * 60 },
  { nome: 'Tarde', de: 12 * 60, ate: 18 * 60 },
  { nome: 'Noite', de: 18 * 60, ate: 24 * 60 },
]

function BotaoDeHorario({ horario, selecionado, aoEscolher }) {
  const cores = selecionado
    ? 'border-principal bg-principal text-sobre-principal'
    : 'border-texto-suave bg-superficie text-texto'

  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={selecionado}
      data-horario-escolhido={selecionado}
      className={`flex min-h-12 items-center justify-center gap-1 rounded-xl border-2 font-semibold ${cores}`}
    >
      {selecionado && <Check className="size-4" aria-hidden="true" />}
      {horario.hora}
    </button>
  )
}

function GradeDeHorarios({ horarios, minutosEscolhidos, aoEscolher }) {
  return periodos.map((periodo) => {
    const doPeriodo = horarios.filter((horario) => horario.minutos >= periodo.de && horario.minutos < periodo.ate)
    if (doPeriodo.length === 0) return null
    return (
      <div key={periodo.nome} className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{periodo.nome}</h3>
        <div className="grid grid-cols-4 gap-2">
          {doPeriodo.map((horario) => (
            <BotaoDeHorario
              key={horario.minutos}
              horario={horario}
              selecionado={minutosEscolhidos === horario.minutos}
              aoEscolher={() => aoEscolher(horario)}
            />
          ))}
        </div>
      </div>
    )
  })
}

export default GradeDeHorarios
