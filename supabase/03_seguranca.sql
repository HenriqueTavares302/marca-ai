create extension if not exists pgcrypto with schema extensions;
create schema if not exists privado;

alter table public.profissionais
  add constraint profissionais_user_id_unico unique (user_id);

alter table public.clientes
  add column criado_por_profissional_id bigint,
  add constraint clientes_criado_por_fkey
    foreign key (salao_id, criado_por_profissional_id) references public.profissionais (salao_id, id);

create index on public.clientes (salao_id, criado_por_profissional_id);

alter table public.agendamentos
  add column codigo_hash bytea unique;


create function privado.meu_profissional() returns bigint
language sql stable security definer set search_path = '' as $$
  select p.id from public.profissionais p where p.user_id = auth.uid() and p.ativo
$$;

create function privado.meu_salao() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.salao_id from public.profissionais p where p.user_id = auth.uid() and p.ativo
$$;

create function privado.sou_dono() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profissionais p where p.user_id = auth.uid() and p.ativo and p.papel = 'dono'
  )
$$;

create function privado.atendi_cliente(p_cliente_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profissionais p
    join public.agendamentos a on a.profissional_id = p.id
    where p.user_id = auth.uid() and p.ativo and a.cliente_id = p_cliente_id
  )
$$;

create function privado.vejo_cliente(p_cliente_id bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profissionais p
    join public.clientes c on c.salao_id = p.salao_id
    where p.user_id = auth.uid()
      and p.ativo
      and c.id = p_cliente_id
      and (
        p.papel = 'dono'
        or c.criado_por_profissional_id = p.id
        or exists (
          select 1 from public.agendamentos a where a.cliente_id = c.id and a.profissional_id = p.id
        )
      )
  )
$$;


create function privado.marcar_quem_cadastrou() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    new.criado_por_profissional_id := privado.meu_profissional();
  end if;
  return new;
end;
$$;

create trigger marcar_quem_cadastrou
  before insert on public.clientes
  for each row execute function privado.marcar_quem_cadastrou();

create function privado.manter_um_dono() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.papel = 'dono' and old.ativo and (new.papel <> 'dono' or not new.ativo) and not exists (
    select 1 from public.profissionais p
    where p.salao_id = old.salao_id and p.id <> old.id and p.papel = 'dono' and p.ativo
  ) then
    raise exception 'ultimo_dono';
  end if;
  return new;
end;
$$;

create trigger manter_um_dono
  before update on public.profissionais
  for each row execute function privado.manter_um_dono();


create function privado.calcular_itens(p_salao_id uuid, p_profissional_id bigint, p_itens jsonb)
returns table (servico_id bigint, variacao_id bigint, preco numeric, duracao_min integer)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_item jsonb;
  v_servico public.servicos;
  v_variacao public.servico_variacoes;
  v_preco_proprio numeric;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array'
    or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 10 then
    raise exception 'servicos_invalidos';
  end if;

  if (select count(distinct e.value ->> 'servico_id') from jsonb_array_elements(p_itens) e)
    <> jsonb_array_length(p_itens) then
    raise exception 'servicos_invalidos';
  end if;

  for v_item in select e.value from jsonb_array_elements(p_itens) e loop
    select s.* into v_servico
    from public.servicos s
    where s.salao_id = p_salao_id and s.id = (v_item ->> 'servico_id')::bigint and s.ativo;
    if not found then
      raise exception 'servicos_invalidos';
    end if;

    select ps.preco into v_preco_proprio
    from public.profissional_servicos ps
    join public.profissionais p on p.id = ps.profissional_id
    where ps.profissional_id = p_profissional_id and ps.servico_id = v_servico.id
      and p.salao_id = p_salao_id and p.ativo;
    if not found then
      raise exception 'profissional_nao_faz_o_servico';
    end if;

    if exists (select 1 from public.servico_variacoes sv where sv.servico_id = v_servico.id and sv.ativa) then
      select sv.* into v_variacao
      from public.servico_variacoes sv
      where sv.servico_id = v_servico.id and sv.id = (v_item ->> 'variacao_id')::bigint and sv.ativa;
      if not found then
        raise exception 'tamanho_invalido';
      end if;
      servico_id := v_servico.id;
      variacao_id := v_variacao.id;
      duracao_min := v_variacao.duracao_min;
      preco := coalesce(
        (select pv.preco from public.profissional_variacoes pv
         where pv.profissional_id = p_profissional_id and pv.variacao_id = v_variacao.id),
        v_variacao.preco
      );
    else
      if v_item ->> 'variacao_id' is not null then
        raise exception 'tamanho_invalido';
      end if;
      servico_id := v_servico.id;
      variacao_id := null;
      duracao_min := v_servico.duracao_min;
      preco := case when v_servico.tipo_preco = 'consulta' then null else coalesce(v_preco_proprio, v_servico.preco) end;
    end if;
    return next;
  end loop;
end;
$$;

create function privado.validar_horario(
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
  v_inicio_local timestamp;
  v_fim_local timestamp;
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

    v_inicio_local := p_inicio at time zone v_salao.fuso_horario;
    v_fim_local := p_fim at time zone v_salao.fuso_horario;
    if date_trunc('minute', v_inicio_local) <> v_inicio_local or not exists (
      select 1 from public.horarios_trabalho h
      where h.profissional_id = p_profissional_id
        and h.dia_semana = extract(dow from v_inicio_local)
        and v_fim_local::date = v_inicio_local::date
        and h.inicio <= v_inicio_local::time
        and v_fim_local::time <= h.fim
        and (extract(epoch from (v_inicio_local::time - h.inicio)) / 60)::integer % v_salao.intervalo_minutos = 0
    ) then
      raise exception 'fora_do_expediente';
    end if;
  end if;

  if exists (
    select 1 from public.bloqueios b
    where b.profissional_id = p_profissional_id and b.inicio < p_fim and p_inicio < b.fim
  ) then
    raise exception 'horario_bloqueado';
  end if;

  if exists (
    select 1 from public.agendamentos a
    where a.profissional_id = p_profissional_id
      and a.status <> 'cancelado'
      and a.id is distinct from p_ignorar_agendamento_id
      and a.inicio < p_fim and p_inicio < a.fim
  ) then
    raise exception 'horario_ocupado';
  end if;
end;
$$;

create function privado.agendamento_para_o_cliente(p_agendamento_id bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id,
    'inicio', a.inicio,
    'fim', a.fim,
    'status', a.status,
    'valor_total', a.valor_total,
    'forma_pagamento', a.forma_pagamento,
    'pago', a.pago,
    'pode_alterar', a.status = 'agendado' and a.inicio - now() >= make_interval(mins => s.cancelamento_minimo_minutos),
    'profissional', jsonb_build_object('id', p.id, 'nome', p.nome, 'foto_url', p.foto_url),
    'servicos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'servico_id', i.servico_id,
        'nome', sv.nome,
        'variacao_id', i.variacao_id,
        'variacao', v.nome,
        'preco', i.preco,
        'duracao_min', i.duracao_min
      ) order by i.id), '[]'::jsonb)
      from public.agendamento_servicos i
      join public.servicos sv on sv.id = i.servico_id
      left join public.servico_variacoes v on v.id = i.variacao_id
      where i.agendamento_id = a.id
    )
  )
  from public.agendamentos a
  join public.salao s on s.id = a.salao_id
  join public.profissionais p on p.id = a.profissional_id
  where a.id = p_agendamento_id
$$;

create function privado.escolher_profissional(
  p_salao_id uuid,
  p_profissional_id bigint,
  p_itens jsonb,
  p_inicio timestamptz,
  p_ignorar_agendamento_id bigint,
  p_pelo_salao boolean
) returns table (profissional_id bigint, itens jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_candidato bigint;
  v_itens jsonb;
  v_duracao integer;
  v_ultimo_erro text;
begin
  for v_candidato in
    select p.id from public.profissionais p
    where p.salao_id = p_salao_id and p.ativo
      and (p_profissional_id is null or p.id = p_profissional_id)
    order by p.id
  loop
    begin
      select jsonb_agg(to_jsonb(c)), sum(c.duracao_min) into v_itens, v_duracao
      from privado.calcular_itens(p_salao_id, v_candidato, p_itens) c;
      perform privado.validar_horario(
        p_salao_id, v_candidato, p_inicio, p_inicio + make_interval(mins => v_duracao),
        p_ignorar_agendamento_id, p_pelo_salao
      );
      profissional_id := v_candidato;
      itens := v_itens;
      return next;
      return;
    exception when raise_exception then
      v_ultimo_erro := sqlerrm;
    end;
  end loop;

  if p_profissional_id is null then
    raise exception 'sem_profissional_livre';
  end if;
  raise exception '%', coalesce(v_ultimo_erro, 'profissional_invalido');
end;
$$;

create function privado.gravar_itens(p_salao_id uuid, p_agendamento_id bigint, p_itens jsonb) returns numeric
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.agendamento_servicos (salao_id, agendamento_id, servico_id, variacao_id, preco, duracao_min)
  select p_salao_id, p_agendamento_id, (e.value ->> 'servico_id')::bigint, (e.value ->> 'variacao_id')::bigint,
    (e.value ->> 'preco')::numeric, (e.value ->> 'duracao_min')::integer
  from jsonb_array_elements(p_itens) e;

  return (
    select sum((e.value ->> 'preco')::numeric) from jsonb_array_elements(p_itens) e
  );
end;
$$;


create function public.vitrine(p_slug text) returns jsonb
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
    )
  );
end;
$$;

create function public.criar_agendamento(
  p_slug text,
  p_itens jsonb,
  p_profissional_id bigint,
  p_inicio timestamptz,
  p_nome text,
  p_telefone text,
  p_observacoes text default null,
  p_forma_pagamento text default 'salao'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_salao public.salao;
  v_nome text := btrim(p_nome);
  v_observacoes text := nullif(btrim(p_observacoes), '');
  v_escolha record;
  v_duracao integer;
  v_cliente_id bigint;
  v_agendamento_id bigint;
  v_codigo text;
  v_valor numeric;
begin
  select s.* into v_salao from public.salao s where s.slug = p_slug;
  if not found then
    raise exception 'salao_nao_encontrado';
  end if;

  if v_nome is null or char_length(v_nome) not between 2 and 80 then
    raise exception 'nome_invalido';
  end if;
  if p_telefone is null or p_telefone !~ '^[0-9]{10,11}$' then
    raise exception 'telefone_invalido';
  end if;
  if char_length(v_observacoes) > 200 then
    raise exception 'observacoes_invalidas';
  end if;
  if coalesce(p_forma_pagamento, '') not in ('salao', 'pix') or (p_forma_pagamento = 'pix' and not v_salao.pix_ativo) then
    raise exception 'forma_de_pagamento_invalida';
  end if;

  if (
    select count(*) from public.agendamentos a
    join public.clientes c on c.id = a.cliente_id
    where c.salao_id = v_salao.id and c.telefone = p_telefone
      and a.status = 'agendado' and a.inicio > now()
  ) >= 3 then
    raise exception 'limite_de_agendamentos';
  end if;

  select e.* into v_escolha
  from privado.escolher_profissional(v_salao.id, p_profissional_id, p_itens, p_inicio, null, false) e;

  select sum((e.value ->> 'duracao_min')::integer) into v_duracao from jsonb_array_elements(v_escolha.itens) e;

  insert into public.clientes (salao_id, nome, telefone)
  values (v_salao.id, v_nome, p_telefone)
  on conflict (salao_id, telefone) do nothing
  returning id into v_cliente_id;
  if v_cliente_id is null then
    select c.id into v_cliente_id from public.clientes c where c.salao_id = v_salao.id and c.telefone = p_telefone;
  end if;

  v_codigo := encode(extensions.gen_random_bytes(32), 'hex');

  begin
    insert into public.agendamentos (
      salao_id, cliente_id, profissional_id, inicio, fim, forma_pagamento, observacoes, codigo_hash
    ) values (
      v_salao.id, v_cliente_id, v_escolha.profissional_id, p_inicio, p_inicio + make_interval(mins => v_duracao),
      p_forma_pagamento, v_observacoes, extensions.digest(v_codigo, 'sha256')
    )
    returning id into v_agendamento_id;
  exception when exclusion_violation then
    raise exception 'horario_ocupado';
  end;

  v_valor := privado.gravar_itens(v_salao.id, v_agendamento_id, v_escolha.itens);
  update public.agendamentos a set valor_total = v_valor where a.id = v_agendamento_id;

  return privado.agendamento_para_o_cliente(v_agendamento_id)
    || jsonb_build_object('codigo', v_codigo, 'cliente', jsonb_build_object('nome', v_nome, 'telefone', p_telefone));
end;
$$;

create function public.meus_agendamentos(p_codigos text[]) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_codigos is null or cardinality(p_codigos) = 0 then
    return '[]'::jsonb;
  end if;
  if cardinality(p_codigos) > 100 then
    raise exception 'codigos_demais';
  end if;

  return (
    select coalesce(jsonb_agg(privado.agendamento_para_o_cliente(a.id) order by a.inicio), '[]'::jsonb)
    from public.agendamentos a
    where a.codigo_hash in (select extensions.digest(c, 'sha256') from unnest(p_codigos) c)
  );
end;
$$;

create function public.cancelar_agendamento(p_agendamento_id bigint, p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_agendamento public.agendamentos;
  v_salao public.salao;
begin
  select a.* into v_agendamento
  from public.agendamentos a
  where a.id = p_agendamento_id and a.codigo_hash = extensions.digest(coalesce(p_codigo, ''), 'sha256')
  for update;
  if not found then
    raise exception 'nao_encontrado';
  end if;

  select s.* into v_salao from public.salao s where s.id = v_agendamento.salao_id;
  if v_agendamento.status <> 'agendado'
    or v_agendamento.inicio - now() < make_interval(mins => v_salao.cancelamento_minimo_minutos) then
    raise exception 'fora_do_prazo';
  end if;

  update public.agendamentos a set status = 'cancelado' where a.id = v_agendamento.id;
  return privado.agendamento_para_o_cliente(v_agendamento.id);
end;
$$;

create function public.remarcar_agendamento(
  p_agendamento_id bigint,
  p_codigo text,
  p_inicio timestamptz,
  p_profissional_id bigint
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_agendamento public.agendamentos;
  v_salao public.salao;
  v_itens jsonb;
  v_escolha record;
  v_duracao interval;
  v_valor numeric;
begin
  select a.* into v_agendamento
  from public.agendamentos a
  where a.id = p_agendamento_id and a.codigo_hash = extensions.digest(coalesce(p_codigo, ''), 'sha256')
  for update;
  if not found then
    raise exception 'nao_encontrado';
  end if;

  select s.* into v_salao from public.salao s where s.id = v_agendamento.salao_id;
  if v_agendamento.status <> 'agendado'
    or v_agendamento.inicio - now() < make_interval(mins => v_salao.cancelamento_minimo_minutos) then
    raise exception 'fora_do_prazo';
  end if;

  select jsonb_agg(jsonb_build_object('servico_id', i.servico_id, 'variacao_id', i.variacao_id) order by i.id)
  into v_itens
  from public.agendamento_servicos i
  where i.agendamento_id = v_agendamento.id;

  v_duracao := v_agendamento.fim - v_agendamento.inicio;

  select e.* into v_escolha
  from privado.escolher_profissional(v_salao.id, p_profissional_id, v_itens, p_inicio, v_agendamento.id, false) e;

  perform privado.validar_horario(
    v_salao.id, v_escolha.profissional_id, p_inicio, p_inicio + v_duracao, v_agendamento.id, false
  );

  if v_escolha.profissional_id <> v_agendamento.profissional_id then
    update public.agendamento_servicos i
    set preco = (e.value ->> 'preco')::numeric
    from jsonb_array_elements(v_escolha.itens) e
    where i.agendamento_id = v_agendamento.id
      and i.servico_id = (e.value ->> 'servico_id')::bigint;

    select sum(i.preco) into v_valor from public.agendamento_servicos i where i.agendamento_id = v_agendamento.id;
  else
    v_valor := v_agendamento.valor_total;
  end if;

  begin
    update public.agendamentos a
    set profissional_id = v_escolha.profissional_id,
        inicio = p_inicio,
        fim = p_inicio + v_duracao,
        valor_total = v_valor
    where a.id = v_agendamento.id;
  exception when exclusion_violation then
    raise exception 'horario_ocupado';
  end;

  return privado.agendamento_para_o_cliente(v_agendamento.id);
end;
$$;


create function public.salao_criar_agendamento(
  p_itens jsonb,
  p_profissional_id bigint,
  p_inicio timestamptz,
  p_cliente_id bigint default null,
  p_nome text default null,
  p_telefone text default null,
  p_observacoes text default null,
  p_forma_pagamento text default 'salao'
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_eu bigint := privado.meu_profissional();
  v_salao_id uuid := privado.meu_salao();
  v_nome text := btrim(p_nome);
  v_observacoes text := nullif(btrim(p_observacoes), '');
  v_escolha record;
  v_duracao integer;
  v_cliente_id bigint;
  v_agendamento_id bigint;
  v_valor numeric;
begin
  if v_eu is null then
    raise exception 'sem_permissao';
  end if;
  if p_profissional_id is null or (p_profissional_id <> v_eu and not privado.sou_dono()) then
    raise exception 'sem_permissao';
  end if;
  if char_length(v_observacoes) > 200 then
    raise exception 'observacoes_invalidas';
  end if;
  if coalesce(p_forma_pagamento, '') not in ('salao', 'pix') then
    raise exception 'forma_de_pagamento_invalida';
  end if;

  if p_cliente_id is not null then
    if not privado.vejo_cliente(p_cliente_id) then
      raise exception 'cliente_nao_encontrado';
    end if;
    v_cliente_id := p_cliente_id;
  else
    if v_nome is null or char_length(v_nome) not between 2 and 80 then
      raise exception 'nome_invalido';
    end if;
    if p_telefone is null or p_telefone !~ '^[0-9]{10,11}$' then
      raise exception 'telefone_invalido';
    end if;
    insert into public.clientes (salao_id, nome, telefone, criado_por_profissional_id)
    values (v_salao_id, v_nome, p_telefone, v_eu)
    on conflict (salao_id, telefone) do nothing
    returning id into v_cliente_id;
    if v_cliente_id is null then
      select c.id into v_cliente_id from public.clientes c where c.salao_id = v_salao_id and c.telefone = p_telefone;
    end if;
  end if;

  select e.* into v_escolha
  from privado.escolher_profissional(v_salao_id, p_profissional_id, p_itens, p_inicio, null, true) e;

  select sum((e.value ->> 'duracao_min')::integer) into v_duracao from jsonb_array_elements(v_escolha.itens) e;

  begin
    insert into public.agendamentos (salao_id, cliente_id, profissional_id, inicio, fim, forma_pagamento, observacoes)
    values (
      v_salao_id, v_cliente_id, v_escolha.profissional_id, p_inicio, p_inicio + make_interval(mins => v_duracao),
      p_forma_pagamento, v_observacoes
    )
    returning id into v_agendamento_id;
  exception when exclusion_violation then
    raise exception 'horario_ocupado';
  end;

  v_valor := privado.gravar_itens(v_salao_id, v_agendamento_id, v_escolha.itens);
  update public.agendamentos a set valor_total = v_valor where a.id = v_agendamento_id;
  return v_agendamento_id;
end;
$$;

create function public.mudar_status_agendamento(
  p_agendamento_id bigint,
  p_status text,
  p_valor numeric default null,
  p_forma_recebida text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_agendamento public.agendamentos;
begin
  select a.* into v_agendamento
  from public.agendamentos a
  where a.id = p_agendamento_id
    and a.salao_id = privado.meu_salao()
    and (a.profissional_id = privado.meu_profissional() or privado.sou_dono())
  for update;
  if not found then
    raise exception 'nao_encontrado';
  end if;

  if not (
    (v_agendamento.status = 'agendado' and p_status in ('concluido', 'faltou', 'cancelado'))
    or (v_agendamento.status in ('concluido', 'faltou') and p_status = 'agendado')
  ) then
    raise exception 'mudanca_invalida';
  end if;

  if p_status = 'concluido' then
    if p_valor is null or p_valor < 0 or p_valor > 100000
      or coalesce(p_forma_recebida, '') not in ('dinheiro', 'pix', 'debito', 'credito') then
      raise exception 'recebimento_invalido';
    end if;
    update public.agendamentos a
    set status = 'concluido', valor_total = round(p_valor, 2), forma_recebida = p_forma_recebida
    where a.id = v_agendamento.id;
  elsif p_status = 'agendado' then
    update public.agendamentos a
    set status = 'agendado',
        forma_recebida = null,
        valor_total = (select sum(i.preco) from public.agendamento_servicos i where i.agendamento_id = a.id)
    where a.id = v_agendamento.id;
  else
    update public.agendamentos a set status = p_status where a.id = v_agendamento.id;
  end if;
end;
$$;

create function public.remover_dados_do_cliente(p_cliente_id bigint) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_salao_id uuid := privado.meu_salao();
begin
  if not privado.sou_dono() then
    raise exception 'sem_permissao';
  end if;
  if not exists (select 1 from public.clientes c where c.id = p_cliente_id and c.salao_id = v_salao_id) then
    raise exception 'cliente_nao_encontrado';
  end if;

  if exists (
    select 1 from public.agendamentos a
    where a.cliente_id = p_cliente_id and a.status = 'agendado' and a.inicio > now()
  ) then
    raise exception 'tem_agendamento_futuro';
  end if;

  if exists (select 1 from public.agendamentos a where a.cliente_id = p_cliente_id) then
    update public.clientes c
    set nome = 'Cliente removido', telefone = null, email = null, observacoes = null, user_id = null
    where c.id = p_cliente_id;
    return 'anonimizado';
  end if;

  delete from public.clientes c where c.id = p_cliente_id;
  return 'apagado';
end;
$$;


create policy "equipe le o salao" on public.salao for select to authenticated
  using (id = (select privado.meu_salao()));
create policy "dono altera o salao" on public.salao for update to authenticated
  using (id = (select privado.meu_salao()) and (select privado.sou_dono()))
  with check (id = (select privado.meu_salao()));

create policy "equipe le os profissionais" on public.profissionais for select to authenticated
  using (salao_id = (select privado.meu_salao()));
create policy "dono cadastra profissionais" on public.profissionais for insert to authenticated
  with check (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));
create policy "dono altera profissionais" on public.profissionais for update to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()))
  with check (salao_id = (select privado.meu_salao()));

create policy "equipe le" on public.categorias for select to authenticated
  using (salao_id = (select privado.meu_salao()));
create policy "dono cria" on public.categorias for insert to authenticated
  with check (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));
create policy "dono altera" on public.categorias for update to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()))
  with check (salao_id = (select privado.meu_salao()));
create policy "dono apaga" on public.categorias for delete to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));

create policy "equipe le" on public.servicos for select to authenticated
  using (salao_id = (select privado.meu_salao()));
create policy "dono cria" on public.servicos for insert to authenticated
  with check (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));
create policy "dono altera" on public.servicos for update to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()))
  with check (salao_id = (select privado.meu_salao()));
create policy "dono apaga" on public.servicos for delete to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));

create policy "equipe le" on public.servico_variacoes for select to authenticated
  using (salao_id = (select privado.meu_salao()));
create policy "dono cria" on public.servico_variacoes for insert to authenticated
  with check (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));
create policy "dono altera" on public.servico_variacoes for update to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()))
  with check (salao_id = (select privado.meu_salao()));
create policy "dono apaga" on public.servico_variacoes for delete to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));

create policy "equipe le" on public.profissional_servicos for select to authenticated
  using (salao_id = (select privado.meu_salao()));
create policy "dono cria" on public.profissional_servicos for insert to authenticated
  with check (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));
create policy "dono altera" on public.profissional_servicos for update to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()))
  with check (salao_id = (select privado.meu_salao()));
create policy "dono apaga" on public.profissional_servicos for delete to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));

create policy "equipe le" on public.profissional_variacoes for select to authenticated
  using (salao_id = (select privado.meu_salao()));
create policy "dono cria" on public.profissional_variacoes for insert to authenticated
  with check (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));
create policy "dono altera" on public.profissional_variacoes for update to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()))
  with check (salao_id = (select privado.meu_salao()));
create policy "dono apaga" on public.profissional_variacoes for delete to authenticated
  using (salao_id = (select privado.meu_salao()) and (select privado.sou_dono()));

create policy "dono tudo, profissional os proprios" on public.horarios_trabalho for all to authenticated
  using (
    salao_id = (select privado.meu_salao())
    and ((select privado.sou_dono()) or profissional_id = (select privado.meu_profissional()))
  )
  with check (
    salao_id = (select privado.meu_salao())
    and ((select privado.sou_dono()) or profissional_id = (select privado.meu_profissional()))
  );

create policy "dono tudo, profissional os proprios" on public.bloqueios for all to authenticated
  using (
    salao_id = (select privado.meu_salao())
    and ((select privado.sou_dono()) or profissional_id = (select privado.meu_profissional()))
  )
  with check (
    salao_id = (select privado.meu_salao())
    and ((select privado.sou_dono()) or profissional_id = (select privado.meu_profissional()))
  );

create policy "equipe le os clientes que pode ver" on public.clientes for select to authenticated
  using (
    salao_id = (select privado.meu_salao())
    and (
      (select privado.sou_dono())
      or criado_por_profissional_id = (select privado.meu_profissional())
      or privado.atendi_cliente(id)
    )
  );
create policy "equipe cadastra clientes" on public.clientes for insert to authenticated
  with check (salao_id = (select privado.meu_salao()));
create policy "equipe altera os clientes que pode ver" on public.clientes for update to authenticated
  using (
    salao_id = (select privado.meu_salao())
    and (
      (select privado.sou_dono())
      or criado_por_profissional_id = (select privado.meu_profissional())
      or privado.atendi_cliente(id)
    )
  )
  with check (salao_id = (select privado.meu_salao()));

create policy "equipe le os agendamentos que pode ver" on public.agendamentos for select to authenticated
  using (
    salao_id = (select privado.meu_salao())
    and (profissional_id = (select privado.meu_profissional()) or privado.vejo_cliente(cliente_id))
  );

create policy "equipe le os itens dos agendamentos que pode ver" on public.agendamento_servicos for select to authenticated
  using (
    salao_id = (select privado.meu_salao())
    and agendamento_id in (select a.id from public.agendamentos a)
  );


revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema privado from public, anon, authenticated;
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema privado revoke execute on functions from anon, authenticated;

grant usage on schema privado to authenticated;
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
  public.remarcar_agendamento(bigint, text, timestamptz, bigint)
to anon, authenticated;

grant execute on function
  public.salao_criar_agendamento(jsonb, bigint, timestamptz, bigint, text, text, text, text),
  public.mudar_status_agendamento(bigint, text, numeric, text),
  public.remover_dados_do_cliente(bigint)
to authenticated;

grant select on table
  public.salao,
  public.profissionais,
  public.categorias,
  public.servicos,
  public.servico_variacoes,
  public.profissional_servicos,
  public.profissional_variacoes,
  public.horarios_trabalho,
  public.bloqueios,
  public.clientes,
  public.agendamentos,
  public.agendamento_servicos
to authenticated;

grant update (
  nome, descricao, foto_capa_url, endereco, telefone, whatsapp,
  intervalo_minutos, antecedencia_minima_minutos, cancelamento_minimo_minutos, pix_ativo
) on public.salao to authenticated;

grant insert (salao_id, nome, telefone, foto_url, papel, ativo) on public.profissionais to authenticated;
grant update (nome, telefone, foto_url, papel, ativo) on public.profissionais to authenticated;

grant insert, update, delete on table
  public.categorias,
  public.servicos,
  public.servico_variacoes,
  public.profissional_servicos,
  public.profissional_variacoes,
  public.horarios_trabalho,
  public.bloqueios
to authenticated;

grant insert (salao_id, nome, telefone, email, observacoes) on public.clientes to authenticated;
grant update (nome, telefone, email, observacoes) on public.clientes to authenticated;
