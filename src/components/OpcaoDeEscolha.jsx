function OpcaoDeEscolha({ nome, valor, marcado, aoMarcar, titulo, explicacao, tipo = 'radio' }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl py-2">
      <input
        type={tipo}
        name={nome}
        value={valor}
        checked={marcado}
        onChange={aoMarcar}
        className="mt-0.5 size-6 shrink-0 accent-principal"
      />
      <span className="flex flex-col">
        <span className="font-medium">{titulo}</span>
        {explicacao && <span className="text-texto-suave">{explicacao}</span>}
      </span>
    </label>
  )
}

export default OpcaoDeEscolha
