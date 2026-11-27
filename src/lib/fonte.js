export function fonteDeDados() {
  return import.meta.env.VITE_FONTE_DE_DADOS === 'supabase' ? 'supabase' : 'exemplo'
}
