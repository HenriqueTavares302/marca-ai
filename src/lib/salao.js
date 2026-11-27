const formatoDoSlug = /^[a-z0-9]+(-[a-z0-9]+)*$/

export function slugDoSalao() {
  const slug = String(import.meta.env.VITE_SALAO_SLUG || '').trim()
  return formatoDoSlug.test(slug) ? slug : null
}
