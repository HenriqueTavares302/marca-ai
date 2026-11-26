const passosDoAgendamento = ['Profissional', 'Data e horário', 'Seus dados', 'Confirmação']

function IndicadorDePassos({ passo }) {
  const total = passosDoAgendamento.length

  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">
        Passo {passo} de {total} · {passosDoAgendamento[passo - 1]}
      </p>
      <div className="flex gap-1.5" aria-hidden="true">
        {passosDoAgendamento.map((nome, indice) => (
          <span
            key={nome}
            className={`h-1.5 flex-1 rounded-full ${indice < passo ? 'bg-principal' : 'bg-borda'}`}
          />
        ))}
      </div>
    </div>
  )
}

export default IndicadorDePassos
