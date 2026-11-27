import { ErroDosDados } from './erros.js'
import { buscarVitrine } from './vitrine.js'
import {
  categoriasComServicos,
  horarioDoSalao,
  profissionaisComServicos,
  servicosComVariacoes,
  servicosPopulares,
} from './catalogo.js'

async function lerVitrine() {
  const resultado = await buscarVitrine()
  if (resultado.erro) throw new ErroDosDados(resultado.erro)
  return resultado.dados
}

export async function buscarSalao() {
  return (await lerVitrine()).salao
}

export async function listarServicosComVariacoes() {
  return servicosComVariacoes(await lerVitrine())
}

export async function listarCategorias() {
  return categoriasComServicos(await lerVitrine())
}

export async function listarServicosPopulares(quantidade) {
  return servicosPopulares(await lerVitrine(), quantidade)
}

export async function listarHorarioDoSalao() {
  return horarioDoSalao(await lerVitrine())
}

export async function listarProfissionaisComServicos() {
  return profissionaisComServicos(await lerVitrine())
}

export async function buscarProfissional(id) {
  return (await lerVitrine()).profissionais.find((profissional) => profissional.id === id) || null
}
