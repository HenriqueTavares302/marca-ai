function numeroOuNulo(valor) {
  if (valor === null || valor === undefined) return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

function lista(valor) {
  return Array.isArray(valor) ? valor : []
}

function porOrdem(a, b) {
  return (a.ordem ?? 0) - (b.ordem ?? 0) || a.id - b.id
}

export function traduzirVitrine(resposta) {
  if (!resposta || typeof resposta !== 'object' || !resposta.salao) return null

  const categorias = lista(resposta.categorias).slice().sort(porOrdem)
  const nomeDaCategoria = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]))
  const salao = resposta.salao

  return {
    salao: {
      id: salao.id,
      nome: salao.nome,
      descricao: salao.descricao ?? null,
      foto_capa_url: salao.foto_capa_url ?? null,
      endereco: salao.endereco ?? null,
      telefone: salao.telefone ?? null,
      whatsapp: salao.whatsapp ?? null,
      intervalo_minutos: numeroOuNulo(salao.intervalo_minutos),
      antecedencia_minima_minutos: numeroOuNulo(salao.antecedencia_minima_minutos),
      cancelamento_minimo_minutos: numeroOuNulo(salao.cancelamento_minimo_minutos),
      pix_ativo: salao.pix_ativo === true,
      fuso_horario: salao.fuso_horario || 'America/Sao_Paulo',
    },
    profissionais: lista(resposta.profissionais).map((profissional) => ({
      id: profissional.id,
      nome: profissional.nome,
      foto_url: profissional.foto_url ?? null,
      ativo: true,
    })),
    categorias: categorias.map((categoria) => categoria.nome),
    servicos: lista(resposta.servicos)
      .map((servico) => ({
        id: servico.id,
        nome: servico.nome,
        categoria: nomeDaCategoria.get(servico.categoria_id) ?? null,
        descricao: servico.descricao ?? null,
        foto_url: servico.foto_url ?? null,
        duracao_min: numeroOuNulo(servico.duracao_min),
        preco: numeroOuNulo(servico.preco),
        tipo_preco: servico.tipo_preco,
        ativo: true,
        ordem: servico.ordem ?? 0,
      }))
      .sort(porOrdem),
    servico_variacoes: lista(resposta.variacoes)
      .map((variacao) => ({
        id: variacao.id,
        servico_id: variacao.servico_id,
        nome: variacao.nome,
        preco: numeroOuNulo(variacao.preco),
        duracao_min: numeroOuNulo(variacao.duracao_min),
        ordem: variacao.ordem ?? 0,
      }))
      .sort((a, b) => a.servico_id - b.servico_id || porOrdem(a, b)),
    profissional_servicos: lista(resposta.profissional_servicos).map((ligacao) => ({
      profissional_id: ligacao.profissional_id,
      servico_id: ligacao.servico_id,
      preco: numeroOuNulo(ligacao.preco),
    })),
    profissional_variacoes: lista(resposta.profissional_variacoes).map((ligacao) => ({
      profissional_id: ligacao.profissional_id,
      variacao_id: ligacao.variacao_id,
      preco: numeroOuNulo(ligacao.preco),
    })),
    horarios_trabalho: lista(resposta.horarios_trabalho).map((horario) => ({
      profissional_id: horario.profissional_id,
      dia_semana: horario.dia_semana,
      inicio: horario.inicio,
      fim: horario.fim,
    })),
  }
}
