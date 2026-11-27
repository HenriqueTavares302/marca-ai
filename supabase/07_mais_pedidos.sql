create or replace function public.vitrine(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_salao public.salao;
begin
  select s.* into v_salao from public.salao s where s.slug = p_slug;
  if not found then
    raise exception 'salao_nao_encontrado';
  end if;

  return jsonb_build_object(
    'salao', jsonb_build_object(
      'id', v_salao.id,
      'nome', v_salao.nome,
      'descricao', v_salao.descricao,
      'foto_capa_url', v_salao.foto_capa_url,
      'endereco', v_salao.endereco,
      'telefone', v_salao.telefone,
      'whatsapp', v_salao.whatsapp,
      'intervalo_minutos', v_salao.intervalo_minutos,
      'antecedencia_minima_minutos', v_salao.antecedencia_minima_minutos,
      'cancelamento_minimo_minutos', v_salao.cancelamento_minimo_minutos,
      'pix_ativo', v_salao.pix_ativo,
      'fuso_horario', v_salao.fuso_horario
    ),
    'profissionais', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'foto_url', p.foto_url) order by p.id), '[]'::jsonb)
      from public.profissionais p
      where p.salao_id = v_salao.id and p.ativo
    ),
    'categorias', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'ordem', c.ordem) order by c.ordem, c.id), '[]'::jsonb)
      from public.categorias c
      where c.salao_id = v_salao.id
    ),
    'servicos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'categoria_id', s.categoria_id, 'nome', s.nome, 'descricao', s.descricao,
        'foto_url', s.foto_url, 'duracao_min', s.duracao_min, 'preco', s.preco,
        'tipo_preco', s.tipo_preco, 'ordem', s.ordem
      ) order by s.ordem, s.id), '[]'::jsonb)
      from public.servicos s
      where s.salao_id = v_salao.id and s.ativo
    ),
    'variacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', v.id, 'servico_id', v.servico_id, 'nome', v.nome, 'preco', v.preco,
        'duracao_min', v.duracao_min, 'ordem', v.ordem
      ) order by v.servico_id, v.ordem, v.id), '[]'::jsonb)
      from public.servico_variacoes v
      join public.servicos s on s.id = v.servico_id
      where v.salao_id = v_salao.id and v.ativa and s.ativo
    ),
    'profissional_servicos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'profissional_id', ps.profissional_id, 'servico_id', ps.servico_id, 'preco', ps.preco
      ) order by ps.profissional_id, ps.servico_id), '[]'::jsonb)
      from public.profissional_servicos ps
      join public.profissionais p on p.id = ps.profissional_id
      join public.servicos s on s.id = ps.servico_id
      where ps.salao_id = v_salao.id and p.ativo and s.ativo
    ),
    'profissional_variacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'profissional_id', pv.profissional_id, 'variacao_id', pv.variacao_id, 'preco', pv.preco
      ) order by pv.profissional_id, pv.variacao_id), '[]'::jsonb)
      from public.profissional_variacoes pv
      join public.profissionais p on p.id = pv.profissional_id
      join public.servico_variacoes v on v.id = pv.variacao_id
      join public.servicos s on s.id = v.servico_id
      where pv.salao_id = v_salao.id and p.ativo and v.ativa and s.ativo
    ),
    'horarios_trabalho', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'profissional_id', h.profissional_id, 'dia_semana', h.dia_semana, 'inicio', h.inicio, 'fim', h.fim
      ) order by h.profissional_id, h.dia_semana, h.inicio), '[]'::jsonb)
      from public.horarios_trabalho h
      join public.profissionais p on p.id = h.profissional_id
      where h.salao_id = v_salao.id and p.ativo
    ),
    'mais_pedidos', (
      select coalesce(jsonb_agg(x.id order by x.posicao), '[]'::jsonb)
      from (
        select s.id, row_number() over (order by coalesce(c.vezes, 0) desc, s.ordem, s.id) as posicao
        from public.servicos s
        left join (
          select i.servico_id, count(*) as vezes
          from public.agendamento_servicos i
          join public.agendamentos a on a.salao_id = i.salao_id and a.id = i.agendamento_id
          where i.salao_id = v_salao.id
            and a.status <> 'cancelado'
            and a.inicio >= now() - interval '90 days'
            and a.inicio < now()
          group by i.servico_id
        ) c on c.servico_id = s.id
        where s.salao_id = v_salao.id and s.ativo
        order by posicao
        limit 4
      ) x
    )
  );
end;
$$;

revoke all on function public.vitrine(text) from public;
grant execute on function public.vitrine(text) to anon, authenticated;
