create index bloqueios_por_periodo on public.bloqueios
  using gist (profissional_id, tstzrange(inicio, fim));


create function privado.dentro_do_expediente(p_salao_id uuid, p_profissional_id bigint, p_inicio timestamptz, p_fim timestamptz)
returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1
    from public.salao s
    join public.horarios_trabalho h on h.salao_id = s.id and h.profissional_id = p_profissional_id
    where s.id = p_salao_id
      and h.dia_semana = extract(dow from p_inicio at time zone s.fuso_horario)
      and (p_fim at time zone s.fuso_horario)::date = (p_inicio at time zone s.fuso_horario)::date
      and h.inicio <= (p_inicio at time zone s.fuso_horario)::time
      and (p_fim at time zone s.fuso_horario)::time <= h.fim
  )
$$;

create function privado.cabe_na_grade(p_salao_id uuid, p_profissional_id bigint, p_inicio timestamptz, p_fim timestamptz)
returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1
    from public.salao s
    join public.horarios_trabalho h on h.salao_id = s.id and h.profissional_id = p_profissional_id
    where s.id = p_salao_id
      and date_trunc('minute', p_inicio at time zone s.fuso_horario) = p_inicio at time zone s.fuso_horario
      and h.dia_semana = extract(dow from p_inicio at time zone s.fuso_horario)
      and (p_fim at time zone s.fuso_horario)::date = (p_inicio at time zone s.fuso_horario)::date
      and h.inicio <= (p_inicio at time zone s.fuso_horario)::time
      and (p_fim at time zone s.fuso_horario)::time <= h.fim
      and (extract(epoch from ((p_inicio at time zone s.fuso_horario)::time - h.inicio)) / 60)::integer % s.intervalo_minutos = 0
  )
$$;

create function privado.sem_conflito(p_profissional_id bigint, p_inicio timestamptz, p_fim timestamptz, p_ignorar_agendamento_id bigint)
returns boolean
language sql stable set search_path = '' as $$
  select not exists (
      select 1 from public.bloqueios b
      where b.profissional_id = p_profissional_id
        and tstzrange(b.inicio, b.fim) && tstzrange(p_inicio, p_fim)
    )
    and not exists (
      select 1 from public.agendamentos a
      where a.profissional_id = p_profissional_id
        and a.status <> 'cancelado'
        and tstzrange(a.inicio, a.fim) && tstzrange(p_inicio, p_fim)
        and a.id is distinct from p_ignorar_agendamento_id
    )
$$;

create function privado.grade_do_dia(p_salao_id uuid, p_profissional_id bigint, p_dia date, p_duracao_min integer)
returns setof timestamptz
language sql stable set search_path = '' as $$
  select (p_dia + h.inicio + make_interval(mins => n * s.intervalo_minutos)) at time zone s.fuso_horario
  from public.salao s
  join public.horarios_trabalho h on h.salao_id = s.id and h.profissional_id = p_profissional_id
  cross join lateral generate_series(
    0,
    floor(((extract(epoch from (h.fim - h.inicio)) / 60) - p_duracao_min) / s.intervalo_minutos)::integer
  ) as n
  where s.id = p_salao_id
    and h.dia_semana = extract(dow from p_dia)
$$;

create function privado.dia_inteiro_bloqueado(p_salao_id uuid, p_profissional_id bigint, p_dia date)
returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1
    from public.salao s
    join public.bloqueios b on b.profissional_id = p_profissional_id
    where s.id = p_salao_id
      and b.inicio <= (p_dia::timestamp at time zone s.fuso_horario)
      and b.fim >= ((p_dia + 1)::timestamp at time zone s.fuso_horario)
  )
$$;

create function privado.livres(
  p_salao_id uuid,
  p_profissionais bigint[],
  p_duracao_min integer,
  p_dia date,
  p_ignorar_agendamento_id bigint,
  p_minimo timestamptz,
  p_maximo timestamptz
) returns table (inicio timestamptz, profissional_id bigint)
language sql stable set search_path = '' as $$
  select distinct on (g.inicio) g.inicio, c.profissional_id
  from unnest(p_profissionais) with ordinality as c (profissional_id, ordem)
  cross join lateral privado.grade_do_dia(p_salao_id, c.profissional_id, p_dia, p_duracao_min) as g (inicio)
  where g.inicio >= p_minimo
    and g.inicio <= p_maximo
    and privado.sem_conflito(c.profissional_id, g.inicio, g.inicio + make_interval(mins => p_duracao_min), p_ignorar_agendamento_id)
  order by g.inicio, c.ordem
$$;

create function privado.candidatos(p_salao_id uuid, p_profissional_id bigint, p_itens jsonb)
returns table (profissional_id bigint, nome text, duracao_min integer, valor_total numeric, tem_valor_a_combinar boolean)
language plpgsql stable set search_path = '' as $$
#variable_conflict use_column
declare
  v_candidato record;
  v_ultimo_erro text;
  v_achou boolean := false;
begin
  for v_candidato in
    select p.id, p.nome from public.profissionais p
    where p.salao_id = p_salao_id and p.ativo
      and (p_profissional_id is null or p.id = p_profissional_id)
    order by p.id
  loop
    begin
      select v_candidato.id, v_candidato.nome, sum(c.duracao_min)::integer, sum(c.preco), bool_or(c.preco is null)
      into profissional_id, nome, duracao_min, valor_total, tem_valor_a_combinar
      from privado.calcular_itens(p_salao_id, v_candidato.id, p_itens) c;
      v_achou := true;
      return next;
    exception when raise_exception then
      v_ultimo_erro := sqlerrm;
      if p_profissional_id is not null then
        raise;
      end if;
    end;
  end loop;

  if not v_achou then
    raise exception '%', coalesce(v_ultimo_erro, 'profissional_invalido');
  end if;
end;
$$;

create function privado.montar_horarios(
  p_salao_id uuid,
  p_profissional_id bigint,
  p_itens jsonb,
  p_dia date,
  p_ignorar_agendamento_id bigint,
  p_duracao_fixa integer,
  p_minimo timestamptz,
  p_maximo timestamptz
) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_fuso text;
  v_candidatos jsonb;
  v_duracao integer;
begin
  if p_dia is null then
    raise exception 'data_invalida';
  end if;
  select s.fuso_horario into v_fuso from public.salao s where s.id = p_salao_id;

  select jsonb_agg(to_jsonb(c) order by c.profissional_id), max(c.duracao_min)
  into v_candidatos, v_duracao
  from privado.candidatos(p_salao_id, p_profissional_id, p_itens) c;
  v_duracao := coalesce(p_duracao_fixa, v_duracao);

  return jsonb_build_object(
    'duracao_min', v_duracao,
    'horarios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'inicio', l.inicio,
        'hora', to_char(l.inicio at time zone v_fuso, 'HH24:MI'),
        'profissional', jsonb_build_object('id', c.value -> 'profissional_id', 'nome', c.value -> 'nome'),
        'valor_total', c.value -> 'valor_total',
        'tem_valor_a_combinar', c.value -> 'tem_valor_a_combinar'
      ) order by l.inicio), '[]'::jsonb)
      from privado.livres(
        p_salao_id,
        (select array_agg((e.value ->> 'profissional_id')::bigint order by (e.value ->> 'profissional_id')::bigint)
         from jsonb_array_elements(v_candidatos) e),
        v_duracao, p_dia, p_ignorar_agendamento_id, p_minimo, p_maximo
      ) l
      join jsonb_array_elements(v_candidatos) c on (c.value ->> 'profissional_id')::bigint = l.profissional_id
    )
  );
end;
$$;

create function privado.montar_dias(
  p_salao_id uuid,
  p_profissional_id bigint,
  p_itens jsonb,
  p_de date,
  p_ate date,
  p_ignorar_agendamento_id bigint,
  p_duracao_fixa integer,
  p_minimo timestamptz,
  p_maximo timestamptz
) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_fuso text;
  v_profissionais bigint[];
  v_duracao integer;
  v_hoje date;
  v_ultimo_dia date;
begin
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 30 then
    raise exception 'periodo_invalido';
  end if;
  select s.fuso_horario into v_fuso from public.salao s where s.id = p_salao_id;
  v_hoje := (now() at time zone v_fuso)::date;
  v_ultimo_dia := (p_maximo at time zone v_fuso)::date;

  select array_agg(c.profissional_id order by c.profissional_id), max(c.duracao_min)
  into v_profissionais, v_duracao
  from privado.candidatos(p_salao_id, p_profissional_id, p_itens) c;
  v_duracao := coalesce(p_duracao_fixa, v_duracao);

  return (
    select jsonb_agg(jsonb_build_object(
      'data', d.dia,
      'aberto', d.aberto,
      'tem_horario_livre', d.aberto and exists (
        select 1 from privado.livres(p_salao_id, v_profissionais, v_duracao, d.dia, p_ignorar_agendamento_id, p_minimo, p_maximo)
      )
    ) order by d.dia)
    from (
      select dia::date as dia,
        dia::date between v_hoje and v_ultimo_dia and exists (
          select 1 from unnest(v_profissionais) as p (id)
          where exists (
              select 1 from public.horarios_trabalho h
              where h.profissional_id = p.id and h.dia_semana = extract(dow from dia::date)
            )
            and not privado.dia_inteiro_bloqueado(p_salao_id, p.id, dia::date)
        ) as aberto
      from generate_series(p_de, p_ate, interval '1 day') as dia
    ) d
  );
end;
$$;

create function privado.agendamento_para_remarcar(p_salao_id uuid, p_agendamento_id bigint, p_codigo text)
returns table (id bigint, itens jsonb, duracao_min integer)
language sql stable set search_path = '' as $$
  select a.id,
    (select jsonb_agg(jsonb_build_object('servico_id', i.servico_id, 'variacao_id', i.variacao_id) order by i.id)
     from public.agendamento_servicos i where i.agendamento_id = a.id),
    (extract(epoch from (a.fim - a.inicio)) / 60)::integer
  from public.agendamentos a
  where a.id = p_agendamento_id
    and a.salao_id = p_salao_id
    and a.status = 'agendado'
    and a.codigo_hash = extensions.digest(coalesce(p_codigo, ''), 'sha256')
$$;


create or replace function privado.validar_horario(
  p_salao_id uuid,
  p_profissional_id bigint,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_ignorar_agendamento_id bigint,
  p_pelo_salao boolean
) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_salao public.salao;
begin
  select s.* into v_salao from public.salao s where s.id = p_salao_id;

  if not exists (
    select 1 from public.profissionais p
    where p.id = p_profissional_id and p.salao_id = p_salao_id and p.ativo
  ) then
    raise exception 'profissional_invalido';
  end if;

  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'horario_invalido';
  end if;

  if not p_pelo_salao then
    if p_inicio < now() + make_interval(mins => v_salao.antecedencia_minima_minutos) then
      raise exception 'antecedencia_minima';
    end if;
    if p_inicio > now() + interval '90 days' then
      raise exception 'muito_distante';
    end if;
    if not privado.cabe_na_grade(p_salao_id, p_profissional_id, p_inicio, p_fim) then
      raise exception 'fora_do_expediente';
    end if;
  end if;

  if exists (
    select 1 from public.bloqueios b
    where b.profissional_id = p_profissional_id and tstzrange(b.inicio, b.fim) && tstzrange(p_inicio, p_fim)
  ) then
    raise exception 'horario_bloqueado';
  end if;

  if not privado.sem_conflito(p_profissional_id, p_inicio, p_fim, p_ignorar_agendamento_id) then
    raise exception 'horario_ocupado';
  end if;
end;
$$;


create function public.horarios_livres(
  p_slug text,
  p_itens jsonb,
  p_profissional_id bigint,
  p_data date,
  p_remarcar_id bigint default null,
  p_codigo text default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_salao public.salao;
  v_itens jsonb := p_itens;
  v_ignorar bigint;
  v_duracao integer;
begin
  select s.* into v_salao from public.salao s where s.slug = p_slug;
  if not found then
    raise exception 'salao_nao_encontrado';
  end if;

  if p_remarcar_id is not null then
    select r.id, r.itens, r.duracao_min into v_ignorar, v_itens, v_duracao
    from privado.agendamento_para_remarcar(v_salao.id, p_remarcar_id, p_codigo) r;
    if not found then
      raise exception 'nao_encontrado';
    end if;
  end if;

  return privado.montar_horarios(
    v_salao.id, p_profissional_id,
    v_itens,
    p_data,
    v_ignorar,
    v_duracao,
    now() + make_interval(mins => v_salao.antecedencia_minima_minutos),
    now() + interval '90 days'
  );
end;
$$;

create function public.dias_abertos(
  p_slug text,
  p_itens jsonb,
  p_profissional_id bigint,
  p_de date,
  p_ate date,
  p_remarcar_id bigint default null,
  p_codigo text default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_salao public.salao;
  v_itens jsonb := p_itens;
  v_ignorar bigint;
  v_duracao integer;
begin
  select s.* into v_salao from public.salao s where s.slug = p_slug;
  if not found then
    raise exception 'salao_nao_encontrado';
  end if;

  if p_remarcar_id is not null then
    select r.id, r.itens, r.duracao_min into v_ignorar, v_itens, v_duracao
    from privado.agendamento_para_remarcar(v_salao.id, p_remarcar_id, p_codigo) r;
    if not found then
      raise exception 'nao_encontrado';
    end if;
  end if;

  return privado.montar_dias(
    v_salao.id, p_profissional_id,
    v_itens,
    p_de, p_ate,
    v_ignorar,
    v_duracao,
    now() + make_interval(mins => v_salao.antecedencia_minima_minutos),
    now() + interval '90 days'
  );
end;
$$;

create function privado.conferir_permissao_de_agenda(p_profissional_id bigint) returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_eu bigint := privado.meu_profissional();
  v_salao_id uuid := privado.meu_salao();
begin
  if v_eu is null then
    raise exception 'sem_permissao';
  end if;
  if (p_profissional_id is null or p_profissional_id <> v_eu) and not privado.sou_dono() then
    raise exception 'sem_permissao';
  end if;
  if p_profissional_id is not null and not exists (
    select 1 from public.profissionais p where p.id = p_profissional_id and p.salao_id = v_salao_id
  ) then
    raise exception 'profissional_invalido';
  end if;
  return v_salao_id;
end;
$$;

create function public.salao_horarios_livres(p_itens jsonb, p_profissional_id bigint, p_data date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_salao_id uuid := privado.conferir_permissao_de_agenda(p_profissional_id);
begin
  return privado.montar_horarios(
    v_salao_id, p_profissional_id, p_itens, p_data, null, null, now(), now() + interval '1 year'
  );
end;
$$;

create function public.salao_dias_abertos(p_itens jsonb, p_profissional_id bigint, p_de date, p_ate date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_salao_id uuid := privado.conferir_permissao_de_agenda(p_profissional_id);
begin
  return privado.montar_dias(
    v_salao_id, p_profissional_id, p_itens, p_de, p_ate, null, null, now(), now() + interval '1 year'
  );
end;
$$;

create function public.conferir_encaixe(p_profissional_id bigint, p_inicio timestamptz, p_duracao_min integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_salao_id uuid;
  v_fim timestamptz;
  v_conflito jsonb;
begin
  if p_profissional_id is null then
    raise exception 'profissional_invalido';
  end if;
  v_salao_id := privado.conferir_permissao_de_agenda(p_profissional_id);
  if p_inicio is null or p_duracao_min is null or p_duracao_min not between 5 and 720 then
    raise exception 'horario_invalido';
  end if;
  if p_inicio > now() + interval '1 year' then
    raise exception 'muito_distante';
  end if;

  v_fim := p_inicio + make_interval(mins => p_duracao_min);
  if v_fim <= now() then
    return jsonb_build_object('erro', 'ja_passou');
  end if;

  select jsonb_build_object('tipo', 'atendimento', 'nome', c.nome, 'inicio', a.inicio, 'fim', a.fim)
  into v_conflito
  from public.agendamentos a
  join public.clientes c on c.id = a.cliente_id
  where a.profissional_id = p_profissional_id
    and a.status <> 'cancelado'
    and tstzrange(a.inicio, a.fim) && tstzrange(p_inicio, v_fim)
  order by a.inicio
  limit 1;
  if v_conflito is not null then
    return jsonb_build_object('erro', 'conflito', 'conflito', v_conflito);
  end if;

  select jsonb_build_object('tipo', 'bloqueio', 'nome', b.motivo, 'inicio', b.inicio, 'fim', b.fim)
  into v_conflito
  from public.bloqueios b
  where b.profissional_id = p_profissional_id
    and tstzrange(b.inicio, b.fim) && tstzrange(p_inicio, v_fim)
  order by b.inicio
  limit 1;
  if v_conflito is not null then
    return jsonb_build_object('erro', 'conflito', 'conflito', v_conflito);
  end if;

  return jsonb_build_object(
    'livre', true,
    'fora_do_expediente', not privado.dentro_do_expediente(v_salao_id, p_profissional_id, p_inicio, v_fim)
  );
end;
$$;


revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema privado from public, anon, authenticated;

grant execute on function
  privado.meu_profissional(),
  privado.meu_salao(),
  privado.sou_dono(),
  privado.atendi_cliente(bigint),
  privado.vejo_cliente(bigint)
to authenticated;

grant execute on function
  public.vitrine(text),
  public.criar_agendamento(text, jsonb, bigint, timestamptz, text, text, text, text),
  public.meus_agendamentos(text[]),
  public.cancelar_agendamento(bigint, text),
  public.remarcar_agendamento(bigint, text, timestamptz, bigint),
  public.horarios_livres(text, jsonb, bigint, date, bigint, text),
  public.dias_abertos(text, jsonb, bigint, date, date, bigint, text)
to anon, authenticated;

grant execute on function
  public.salao_criar_agendamento(jsonb, bigint, timestamptz, bigint, text, text, text, text),
  public.mudar_status_agendamento(bigint, text, numeric, text),
  public.remover_dados_do_cliente(bigint),
  public.salao_horarios_livres(jsonb, bigint, date),
  public.salao_dias_abertos(jsonb, bigint, date, date),
  public.conferir_encaixe(bigint, timestamptz, integer)
to authenticated;
