begin;

create temp table resultados (n serial, resultado text);
create temp table guardado (chave text primary key, valor jsonb);

create function pg_temp.guarde(p_chave text, p_valor jsonb) returns void
language sql as $$
  insert into pg_temp.guardado values (p_chave, p_valor)
  on conflict (chave) do update set valor = excluded.valor
$$;

create function pg_temp.lido(p_chave text) returns text
language sql as $$
  select valor #>> '{}' from pg_temp.guardado where chave = p_chave
$$;

create function pg_temp.confere(p_nome text, p_ok boolean, p_detalhe text default null) returns void
language sql as $$
  insert into pg_temp.resultados (resultado)
  values (case when coalesce(p_ok, false) then 'OK       ' else 'FALHOU   ' end || p_nome
    || case when not coalesce(p_ok, false) and p_detalhe is not null then '  →  ' || p_detalhe else '' end)
$$;

create function pg_temp.rodar(p_papel text, p_usuario uuid, p_comando text) returns jsonb
language plpgsql as $$
declare
  v_resultado jsonb;
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_usuario is null then '' else json_build_object('sub', p_usuario, 'role', p_papel)::text end, true);
    execute format('set local role %I', p_papel);
    if p_comando ~* '^\s*(select|with)' then
      execute p_comando into v_resultado;
    else
      execute p_comando;
    end if;
    reset role;
    perform set_config('request.jwt.claims', '', true);
    return jsonb_build_object('ok', true, 'resultado', v_resultado);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', sqlerrm);
  end;
end;
$$;

create function pg_temp.aceita(p_nome text, p_papel text, p_usuario uuid, p_comando text) returns jsonb
language plpgsql as $$
declare
  r jsonb := pg_temp.rodar(p_papel, p_usuario, p_comando);
begin
  perform pg_temp.confere(p_nome, (r ->> 'ok')::boolean, r ->> 'erro');
  return r -> 'resultado';
end;
$$;

create function pg_temp.recusa(p_nome text, p_papel text, p_usuario uuid, p_comando text, p_erro text default null) returns void
language plpgsql as $$
declare
  r jsonb := pg_temp.rodar(p_papel, p_usuario, p_comando);
begin
  perform pg_temp.confere(
    p_nome,
    not (r ->> 'ok')::boolean and (p_erro is null or r ->> 'erro' like '%' || p_erro || '%'),
    coalesce(r ->> 'erro', 'foi aceito')
  );
end;
$$;

create function pg_temp.igual(p_nome text, p_papel text, p_usuario uuid, p_comando text, p_esperado jsonb) returns void
language plpgsql as $$
declare
  r jsonb := pg_temp.rodar(p_papel, p_usuario, p_comando);
begin
  perform pg_temp.confere(
    p_nome,
    (r ->> 'ok')::boolean and r -> 'resultado' = p_esperado,
    coalesce(r ->> 'erro', 'veio ' || coalesce(r -> 'resultado', 'null'::jsonb)::text || ', esperado ' || p_esperado::text)
  );
end;
$$;


create temp table contador (n integer);
insert into pg_temp.contador values (0);

create function pg_temp.pedido(p_servico bigint, p_dias integer, p_status text default 'concluido') returns void
language plpgsql as $$
declare
  v_n integer;
  v_inicio timestamptz;
  v_id bigint;
begin
  update pg_temp.contador set n = n + 1 returning n into v_n;
  v_inicio := date_trunc('day', now()) + make_interval(days => p_dias) + make_interval(hours => 8) + make_interval(mins => v_n * 40);
  insert into public.agendamentos (salao_id, cliente_id, profissional_id, inicio, fim, status)
  values ('00000000-0000-4000-8000-000000000001', 4, 1, v_inicio, v_inicio + interval '30 minutes', p_status)
  returning id into v_id;
  insert into public.agendamento_servicos (salao_id, agendamento_id, servico_id, preco, duracao_min)
  values ('00000000-0000-4000-8000-000000000001', v_id, p_servico, 10, 30);
end;
$$;

create function pg_temp.mais_pedidos() returns jsonb
language sql as $$
  select (pg_temp.rodar('anon', null, $c$select public.vitrine('salao-exemplo')$c$) -> 'resultado') -> 'mais_pedidos'
$$;

create function pg_temp.pela_ordem(p_quantos integer, p_fora bigint[] default '{}') returns jsonb
language sql as $$
  select coalesce(jsonb_agg(id order by ordem, id), '[]'::jsonb) from (
    select id, ordem from public.servicos
    where salao_id = '00000000-0000-4000-8000-000000000001' and ativo and id <> all (p_fora)
    order by ordem, id limit p_quantos
  ) x
$$;

delete from public.agendamento_servicos;
delete from public.agendamentos;

select pg_temp.aceita('visitante abre a vitrine com mais_pedidos', 'anon', null, $c$select public.vitrine('salao-exemplo')$c$);
select pg_temp.confere('sem nenhum agendamento: os 4 primeiros do cardápio',
  pg_temp.mais_pedidos() = pg_temp.pela_ordem(4), pg_temp.mais_pedidos()::text);

select pg_temp.pedido(8, -10), pg_temp.pedido(8, -20), pg_temp.pedido(8, -30);
select pg_temp.pedido(5, -5, 'agendado'), pg_temp.pedido(5, -6, 'faltou');
select pg_temp.pedido(12, -2);
select pg_temp.pedido(1, -3, 'cancelado'), pg_temp.pedido(1, -4, 'cancelado'), pg_temp.pedido(1, -7, 'cancelado'),
  pg_temp.pedido(1, -8, 'cancelado'), pg_temp.pedido(1, -9, 'cancelado');
select pg_temp.pedido(2, -100), pg_temp.pedido(2, -120), pg_temp.pedido(2, -150), pg_temp.pedido(2, -200);
select pg_temp.pedido(3, 5, 'agendado'), pg_temp.pedido(3, 6, 'agendado'), pg_temp.pedido(3, 7, 'agendado'),
  pg_temp.pedido(3, 8, 'agendado');

select pg_temp.confere('mais agendados primeiro (8, 5, 12) e completa pela ordem do cardápio',
  pg_temp.mais_pedidos() = '[8, 5, 12]'::jsonb || pg_temp.pela_ordem(1, '{8,5,12}'), pg_temp.mais_pedidos()::text);
select pg_temp.confere('cancelados não contam (5 cancelados do serviço 1 não o põem na frente)',
  not (pg_temp.mais_pedidos() -> 0 = '1' or pg_temp.mais_pedidos() -> 1 = '1' or pg_temp.mais_pedidos() -> 2 = '1'), pg_temp.mais_pedidos()::text);
select pg_temp.confere('agendamentos com mais de 90 dias não contam (serviço 2)',
  not (pg_temp.mais_pedidos() -> 0 = '2' or pg_temp.mais_pedidos() -> 1 = '2' or pg_temp.mais_pedidos() -> 2 = '2'), pg_temp.mais_pedidos()::text);
select pg_temp.confere('agendamentos futuros ainda não contam (serviço 3)',
  not (pg_temp.mais_pedidos() -> 0 = '3' or pg_temp.mais_pedidos() -> 1 = '3' or pg_temp.mais_pedidos() -> 2 = '3'), pg_temp.mais_pedidos()::text);

select pg_temp.pedido(1, -1), pg_temp.pedido(1, -2);
select pg_temp.confere('empate (5 e 1 com 2 cada) segue a ordem do cardápio',
  pg_temp.mais_pedidos() = '[8, 1, 5, 12]'::jsonb, pg_temp.mais_pedidos()::text);

update public.servicos set ativo = false where id = 8;
select pg_temp.confere('serviço desativado sai da lista', pg_temp.mais_pedidos() = '[1, 5, 12]'::jsonb || pg_temp.pela_ordem(1, '{1,5,12}'),
  pg_temp.mais_pedidos()::text);
update public.servicos set ativo = true where id = 8;

select pg_temp.confere('no máximo 4 ids', jsonb_array_length(pg_temp.mais_pedidos()) = 4);
select pg_temp.confere('visitante recebe só números (ids), sem contagem, cliente, data ou valor',
  (select bool_and(jsonb_typeof(v) = 'number') from jsonb_array_elements(pg_temp.mais_pedidos()) v));
select pg_temp.confere('a vitrine não traz contagem, cliente, data ou valor de agendamento',
  pg_temp.rodar('anon', null, $c$select public.vitrine('salao-exemplo')$c$)::text !~ '(vezes|posicao|contagem|cliente|valor_total|agendamento|criado_em|status)');
select pg_temp.confere('os ids da lista são serviços ativos da própria vitrine',
  (select bool_and(r -> 'servicos' @> jsonb_build_array(jsonb_build_object('id', v)))
   from (select pg_temp.rodar('anon', null, $c$select public.vitrine('salao-exemplo')$c$) -> 'resultado' as r) x,
        jsonb_array_elements(x.r -> 'mais_pedidos') v));
update public.servicos set ativo = false where salao_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.confere('salão sem serviços ativos: lista vazia', pg_temp.mais_pedidos() = '[]'::jsonb, pg_temp.mais_pedidos()::text);

select pg_temp.confere('vitrine continua security definer com search_path vazio',
  (select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = 'public.vitrine(text)'::regprocedure));
select pg_temp.confere('visitante e logado podem chamar a vitrine',
  has_function_privilege('anon', 'public.vitrine(text)', 'execute') and has_function_privilege('authenticated', 'public.vitrine(text)', 'execute'));
select pg_temp.confere('public não tem permissão na vitrine',
  not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = 'public.vitrine(text)'::regprocedure and a.grantee = 0));


select resultado from (
  select n, resultado from pg_temp.resultados
  union all
  select 100000, 'TOTAL: ' || count(*) filter (where resultado like 'OK %' and resultado not like '%---%')
    || ' OK, ' || count(*) filter (where resultado like 'FALHOU%') || ' FALHOU'
  from pg_temp.resultados
) x order by n;

rollback;
