function RodapeFixo({ children }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg flex-col gap-2 px-4 py-3">{children}</div>
    </div>
  )
}

export default RodapeFixo
