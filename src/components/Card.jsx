function Card({ children }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-borda bg-superficie p-4">
      {children}
    </div>
  )
}

export default Card
