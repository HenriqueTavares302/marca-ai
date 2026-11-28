create or replace function public.salvar_servico(p_dados jsonb) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  v_salao_id uuid := privado.meu_salao();
  v_id bigint := nullif(p_dados ->> 'id', '')::bigint;
  v_nome text := btrim(regexp_replace(coalesce(p_dados ->> 'nome', ''), '\s+', ' ', 'g'));
  v_nome_categoria text := btrim(regexp_replace(coalesce(p_dados ->> 'categoria', ''), '\s+', ' ', 'g'));
  v_descricao text := nullif(btrim(coalesce(p_dados ->> 'descricao', '')), '');
  v_variacoes jsonb := coalesce(p_dados -> 'variacoes', '[]'::jsonb);
  v_profissionais bigint[];
  v_precos jsonb := coalesce(p_dados -> 'precos_profissionais', '[]'::jsonb);
  v_com_variacoes boolean;
  v_tipo_preco text;
  v_preco numeric;
  v_duracao integer;
  v_categoria_id bigint;
  v_variacao jsonb;
  v_variacao_id bigint;
  v_indice integer := 0;
  v_ids_da_ordem bigint[] := '{}';
  v_profissional_id bigint;
  v_preco_proprio jsonb;
begin
  if v_salao_id is null or not privado.sou_dono() then
    raise exception 'sem_permissao';
  end if;
  if jsonb_typeof(v_variacoes) <> 'array' or jsonb_array_length(v_variacoes) > 10 then
    raise exception 'servico_invalido';
  end if;
  if v_nome = '' or v_nome_categoria = '' or exists (
    select 1 from jsonb_array_elements(v_variacoes) e
    where btrim(regexp_replace(coalesce(e.value ->> 'nome', ''), '\s+', ' ', 'g')) = ''
  ) then
    raise exception 'servico_invalido';
  end if;

  select coalesce(array_agg(distinct e.value::bigint), '{}')
  into v_profissionais
  from jsonb_array_elements_text(coalesce(p_dados -> 'profissional_ids', '[]'::jsonb)) e;
  if cardinality(v_profissionais) = 0 then
    raise exception 'sem_profissional';
  end if;
  if exists (
    select 1 from unnest(v_profissionais) p(id)
    where not exists (
      select 1 from public.profissionais x where x.id = p.id and x.salao_id = v_salao_id and x.ativo
    )
  ) then
    raise exception 'profissional_invalido';
  end if;

  v_com_variacoes := jsonb_array_length(v_variacoes) > 0;
  if v_com_variacoes then
    v_tipo_preco := 'a_partir';
    select min((e.value ->> 'preco')::numeric), min((e.value ->> 'duracao_min')::integer)
    into v_preco, v_duracao
    from jsonb_array_elements(v_variacoes) e;
  else
    v_tipo_preco := p_dados ->> 'tipo_preco';
    if v_tipo_preco is null or v_tipo_preco not in ('fixo', 'a_partir', 'consulta') then
      raise exception 'servico_invalido';
    end if;
    v_preco := case when v_tipo_preco = 'consulta' then null else (p_dados ->> 'preco')::numeric end;
    v_duracao := (p_dados ->> 'duracao_min')::integer;
  end if;

  select c.id into v_categoria_id
  from public.categorias c
  where c.salao_id = v_salao_id and lower(c.nome) = lower(v_nome_categoria);
  if v_categoria_id is null then
    insert into public.categorias (salao_id, nome, ordem)
    values (
      v_salao_id, v_nome_categoria,
      coalesce((select max(c.ordem) from public.categorias c where c.salao_id = v_salao_id), 0) + 1
    )
    returning id into v_categoria_id;
  end if;

  if v_id is null then
    insert into public.servicos (salao_id, categoria_id, nome, descricao, duracao_min, preco, tipo_preco, ativo, ordem)
    values (
      v_salao_id, v_categoria_id, v_nome, v_descricao, v_duracao, v_preco, v_tipo_preco,
      coalesce((p_dados ->> 'ativo')::boolean, true),
      coalesce((select max(s.ordem) from public.servicos s where s.salao_id = v_salao_id), 0) + 1
    )
    returning id into v_id;
  else
    update public.servicos s
    set categoria_id = v_categoria_id, nome = v_nome, descricao = v_descricao, duracao_min = v_duracao,
        preco = v_preco, tipo_preco = v_tipo_preco, ativo = coalesce((p_dados ->> 'ativo')::boolean, true)
    where s.id = v_id and s.salao_id = v_salao_id;
    if not found then
      raise exception 'nao_encontrado';
    end if;
  end if;

  for v_variacao in select e.value from jsonb_array_elements(v_variacoes) e loop
    v_indice := v_indice + 1;
    v_variacao_id := nullif(v_variacao ->> 'id', '')::bigint;
    if v_variacao_id is not null then
      update public.servico_variacoes v
      set nome = btrim(regexp_replace(v_variacao ->> 'nome', '\s+', ' ', 'g')),
          preco = (v_variacao ->> 'preco')::numeric,
          duracao_min = (v_variacao ->> 'duracao_min')::integer,
          ordem = v_indice,
          ativa = true
      where v.id = v_variacao_id and v.servico_id = v_id and v.salao_id = v_salao_id;
      if not found then
        v_variacao_id := null;
      end if;
    end if;
    if v_variacao_id is null then
      insert into public.servico_variacoes (salao_id, servico_id, nome, preco, duracao_min, ordem)
      values (
        v_salao_id, v_id, btrim(regexp_replace(v_variacao ->> 'nome', '\s+', ' ', 'g')),
        (v_variacao ->> 'preco')::numeric, (v_variacao ->> 'duracao_min')::integer, v_indice
      )
      returning id into v_variacao_id;
    end if;
    v_ids_da_ordem := v_ids_da_ordem || v_variacao_id;
  end loop;

  update public.servico_variacoes v
  set ativa = false
  where v.servico_id = v_id and v.salao_id = v_salao_id and v.id <> all (v_ids_da_ordem)
    and exists (select 1 from public.agendamento_servicos i where i.variacao_id = v.id);
  delete from public.servico_variacoes v
  where v.servico_id = v_id and v.salao_id = v_salao_id and v.id <> all (v_ids_da_ordem)
    and not exists (select 1 from public.agendamento_servicos i where i.variacao_id = v.id);

  delete from public.profissional_servicos ps
  where ps.servico_id = v_id and ps.salao_id = v_salao_id and ps.profissional_id <> all (v_profissionais);
  delete from public.profissional_variacoes pv
  where pv.salao_id = v_salao_id
    and pv.variacao_id in (select v.id from public.servico_variacoes v where v.servico_id = v_id);

  foreach v_profissional_id in array v_profissionais loop
    select e.value into v_preco_proprio
    from jsonb_array_elements(v_precos) e
    where (e.value ->> 'profissional_id')::bigint = v_profissional_id
    limit 1;

    insert into public.profissional_servicos (salao_id, profissional_id, servico_id, preco)
    values (
      v_salao_id, v_profissional_id, v_id,
      case
        when v_tipo_preco = 'consulta' or v_com_variacoes then null
        when jsonb_typeof(v_preco_proprio -> 'preco') = 'number' then (v_preco_proprio ->> 'preco')::numeric
        else null
      end
    )
    on conflict (profissional_id, servico_id) do update set preco = excluded.preco;

    if v_com_variacoes and v_preco_proprio is not null then
      insert into public.profissional_variacoes (salao_id, profissional_id, variacao_id, preco)
      select v_salao_id, v_profissional_id, v_ids_da_ordem[p.posicao], (p.valor #>> '{}')::numeric
      from jsonb_array_elements(coalesce(v_preco_proprio -> 'variacoes', '[]'::jsonb)) with ordinality p(valor, posicao)
      where jsonb_typeof(p.valor) = 'number' and p.posicao <= cardinality(v_ids_da_ordem);
    end if;
  end loop;

  return v_id;
exception
  when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
    raise exception 'servico_invalido';
  when unique_violation then
    raise exception 'servico_repetido';
end;
$$;

create or replace function public.apagar_servico(p_servico_id bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_salao_id uuid := privado.meu_salao();
  v_categoria_id bigint;
begin
  if v_salao_id is null or not privado.sou_dono() then
    raise exception 'sem_permissao';
  end if;
  if exists (select 1 from public.agendamento_servicos i where i.servico_id = p_servico_id) then
    raise exception 'servico_usado';
  end if;

  delete from public.servicos s
  where s.id = p_servico_id and s.salao_id = v_salao_id
  returning s.categoria_id into v_categoria_id;
  if v_categoria_id is null then
    raise exception 'nao_encontrado';
  end if;

  delete from public.categorias c
  where c.id = v_categoria_id
    and not exists (select 1 from public.servicos s where s.categoria_id = v_categoria_id);
end;
$$;

create or replace function public.trocar_ordem_servico(p_servico_id bigint, p_direcao text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_salao_id uuid := privado.meu_salao();
  v_servico public.servicos;
  v_vizinho public.servicos;
  v_posicao integer;
  v_total integer;
begin
  if v_salao_id is null or not privado.sou_dono() then
    raise exception 'sem_permissao';
  end if;
  if p_direcao is null or p_direcao not in ('subir', 'descer') then
    raise exception 'direcao_invalida';
  end if;

  update public.servicos s
  set ordem = n.ordem_nova
  from (
    select x.id, row_number() over (order by x.ordem, x.id) as ordem_nova
    from public.servicos x
    where x.salao_id = v_salao_id
  ) n
  where s.id = n.id and s.ordem <> n.ordem_nova;

  select s.* into v_servico from public.servicos s where s.id = p_servico_id and s.salao_id = v_salao_id;
  if not found then
    raise exception 'nao_encontrado';
  end if;

  select count(*) filter (where s.ordem <= v_servico.ordem), count(*)
  into v_posicao, v_total
  from public.servicos s
  where s.salao_id = v_salao_id and s.categoria_id = v_servico.categoria_id;

  if p_direcao = 'subir' then
    select s.* into v_vizinho from public.servicos s
    where s.salao_id = v_salao_id and s.categoria_id = v_servico.categoria_id and s.ordem < v_servico.ordem
    order by s.ordem desc limit 1;
  else
    select s.* into v_vizinho from public.servicos s
    where s.salao_id = v_salao_id and s.categoria_id = v_servico.categoria_id and s.ordem > v_servico.ordem
    order by s.ordem limit 1;
  end if;
  if v_vizinho.id is null then
    raise exception 'sem_vizinho';
  end if;

  update public.servicos s
  set ordem = case when s.id = v_servico.id then v_vizinho.ordem else v_servico.ordem end
  where s.id in (v_servico.id, v_vizinho.id);

  return jsonb_build_object(
    'posicao', case when p_direcao = 'subir' then v_posicao - 1 else v_posicao + 1 end,
    'total', v_total
  );
end;
$$;

create or replace function public.salvar_horarios_do_profissional(p_profissional_id bigint, p_linhas jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_salao_id uuid := privado.meu_salao();
begin
  if v_salao_id is null then
    raise exception 'sem_permissao';
  end if;
  if not privado.sou_dono() and p_profissional_id is distinct from privado.meu_profissional() then
    raise exception 'sem_permissao';
  end if;
  if not exists (
    select 1 from public.profissionais p where p.id = p_profissional_id and p.salao_id = v_salao_id and p.ativo
  ) then
    raise exception 'nao_encontrado';
  end if;
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) > 35 then
    raise exception 'horario_invalido';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_linhas) e
    where e.value ->> 'dia_semana' is null or e.value ->> 'inicio' is null or e.value ->> 'fim' is null
      or (e.value ->> 'dia_semana')::integer not between 0 and 6
      or (e.value ->> 'inicio')::time >= (e.value ->> 'fim')::time
  ) then
    raise exception 'horario_invalido';
  end if;

  delete from public.horarios_trabalho h
  where h.profissional_id = p_profissional_id and h.salao_id = v_salao_id;

  insert into public.horarios_trabalho (salao_id, profissional_id, dia_semana, inicio, fim)
  select v_salao_id, p_profissional_id, (e.value ->> 'dia_semana')::integer,
         (e.value ->> 'inicio')::time, (e.value ->> 'fim')::time
  from jsonb_array_elements(p_linhas) e;
exception
  when exclusion_violation then
    raise exception 'horarios_sobrepostos';
  when not_null_violation or check_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise exception 'horario_invalido';
end;
$$;

revoke all on function
  public.salvar_servico(jsonb),
  public.apagar_servico(bigint),
  public.trocar_ordem_servico(bigint, text),
  public.salvar_horarios_do_profissional(bigint, jsonb)
from public, anon;

grant execute on function
  public.salvar_servico(jsonb),
  public.apagar_servico(bigint),
  public.trocar_ordem_servico(bigint, text),
  public.salvar_horarios_do_profissional(bigint, jsonb)
to authenticated;
