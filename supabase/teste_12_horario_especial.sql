begin;

create function pg_temp.dia_de_trabalho(passos integer) returns date
language plpgsql as $$
declare
  dia date := (now() at time zone 'America/Sao_Paulo')::date;
  restantes integer := passos;
begin
  while extract(dow from dia) not between 2 and 6 loop
    dia := dia + 1;
  end loop;
  while restantes > 0 loop
    dia := dia + 1;
    if extract(dow from dia) between 2 and 6 then
      restantes := restantes - 1;
    end if;
  end loop;
  return dia;
end;
$$;

create function pg_temp.momento(passos integer, hora time) returns timestamptz
language sql as $$
  select (pg_temp.dia_de_trabalho(passos) + hora) at time zone 'America/Sao_Paulo'
$$;

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

create function pg_temp.expediente_antigo(p_salao_id uuid, p_profissional_id bigint, p_inicio timestamptz, p_fim timestamptz)
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

create function pg_temp.cabe_antigo(p_salao_id uuid, p_profissional_id bigint, p_inicio timestamptz, p_fim timestamptz)
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

create function pg_temp.grade_antiga(p_salao_id uuid, p_profissional_id bigint, p_dia date, p_duracao_min integer)
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

create function pg_temp.proximo(p_dia_semana integer, p_semanas integer) returns date
language sql as $$
  select d::date + 7 * p_semanas
  from generate_series((now() at time zone 'America/Sao_Paulo')::date + 1, (now() at time zone 'America/Sao_Paulo')::date + 7, interval '1 day') d
  where extract(dow from d) = p_dia_semana
$$;

create function pg_temp.hora(p_dia date, p_hora time) returns timestamptz
language sql as $$
  select (p_dia + p_hora) at time zone 'America/Sao_Paulo'
$$;

create function pg_temp.horas(p_profissional_id bigint, p_dia date) returns text
language sql as $$
  select coalesce(string_agg(h ->> 'hora', ',' order by h ->> 'hora'), '')
  from jsonb_array_elements(public.horarios_livres('salao-exemplo', '[{"servico_id": 1}]', p_profissional_id, p_dia) -> 'horarios') h
$$;

create function pg_temp.aberto(p_profissional_id bigint, p_dia date) returns boolean
language sql as $$
  select (d ->> 'aberto')::boolean
  from jsonb_array_elements(public.dias_abertos('salao-exemplo', '[{"servico_id": 1}]', p_profissional_id, p_dia, p_dia)) d
$$;

create function pg_temp.salvar(p_usuario uuid, p_profissional_id bigint, p_data date, p_linhas text) returns text
language sql as $$
  select format('select 1 from public.salvar_horarios_especiais(%s, %L, %L::jsonb)', p_profissional_id, p_data, p_linhas)
$$;

do $$
begin
  delete from public.agendamentos
  where salao_id = '00000000-0000-4000-8000-000000000001' and id > 18;

  update public.agendamentos a
  set status = s.status, valor_total = s.valor_total, forma_pagamento = s.forma_pagamento,
      pago = s.pago, forma_recebida = null, observacoes = s.observacoes
  from (values
    (1, 'concluido', 45::numeric, 'salao', true, null::text),
    (2, 'concluido', 65, 'salao', true, null),
    (3, 'concluido', 190, 'salao', true, null),
    (4, 'faltou', 80, 'salao', false, null),
    (5, 'concluido', 70, 'salao', true, null),
    (6, 'concluido', 130, 'salao', true, null),
    (7, 'cancelado', 75, 'salao', false, 'Cliente desmarcou pelo WhatsApp.'),
    (8, 'concluido', 45, 'salao', true, null),
    (9, 'agendado', 145, 'pix', true, null),
    (10, 'agendado', null, 'salao', false, 'Valor combinado na avaliação.'),
    (11, 'agendado', 200, 'salao', false, null),
    (12, 'agendado', 45, 'salao', false, null),
    (13, 'cancelado', 35, 'salao', false, null),
    (14, 'agendado', 90, 'salao', false, null),
    (15, 'agendado', 90, 'salao', false, null),
    (16, 'agendado', 80, 'salao', false, null),
    (17, 'agendado', 130, 'salao', false, null),
    (18, 'agendado', 150, 'salao', false, null)
  ) as s (id, status, valor_total, forma_pagamento, pago, observacoes)
  where a.id = s.id and a.salao_id = '00000000-0000-4000-8000-000000000001';

  update public.clientes c
  set nome = s.nome, telefone = s.telefone, email = null, observacoes = s.observacoes, user_id = null
  from (values
    (1, 'Mariana Costa', '00900000001', null::text),
    (2, 'Juliana Ferreira', '00900000002', 'Prefere escova mais lisa.'),
    (3, 'Patrícia Lima', '00900000003', 'Coloração 6.0 com 20 volumes.'),
    (4, 'Rafael Oliveira', '00900000004', null),
    (5, 'Lucas Almeida', '00900000005', null),
    (6, 'Fernanda Rocha', '00900000006', null),
    (7, 'Camila Martins', '00900000007', 'Alergia a amônia.'),
    (8, 'Bruno Santos', '00900000008', null)
  ) as s (id, nome, telefone, observacoes)
  where c.id = s.id and c.salao_id = '00000000-0000-4000-8000-000000000001';

  delete from public.bloqueios
  where salao_id = '00000000-0000-4000-8000-000000000001'
    and id > (select min(b.id) from public.bloqueios b where b.salao_id = '00000000-0000-4000-8000-000000000001');

  if to_regclass('public.horarios_especiais') is not null then
    execute $c$delete from public.horarios_especiais where salao_id = '00000000-0000-4000-8000-000000000001'$c$;
  end if;

  delete from public.horarios_trabalho
  where salao_id = '00000000-0000-4000-8000-000000000001' and profissional_id in (1, 2);
  insert into public.horarios_trabalho (salao_id, profissional_id, dia_semana, inicio, fim)
  select '00000000-0000-4000-8000-000000000001', profissional_id, dia_semana, inicio, fim
  from (
    values (1, 1, time '09:00', time '12:00')
    union all
    select profissional_id, dia_semana, intervalo.inicio, intervalo.fim
    from (values (1), (2)) as pessoas (profissional_id)
    cross join generate_series(2, 6) as dia_semana
    cross join (values (time '09:00', time '12:00'), (time '13:00', time '19:00')) as intervalo (inicio, fim)
  ) as horarios (profissional_id, dia_semana, inicio, fim);

  update public.profissionais set ativo = true
  where salao_id = '00000000-0000-4000-8000-000000000001' and id in (1, 2);
  update public.salao
  set intervalo_minutos = 30, antecedencia_minima_minutos = 60, cancelamento_minimo_minutos = 120
  where id = '00000000-0000-4000-8000-000000000001';

  perform set_config('marca_aviso.' || t, '', true)
  from unnest(array['agendamentos', 'bloqueios', 'horarios', 'clientes', 'servicos', 'equipe', 'salao']) t;
end;
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'roberto@exemplo.com'),
  ('a0000000-0000-4000-8000-000000000002', 'ana@exemplo.com');
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000001' where id = 1;
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000002' where id = 2;

select pg_temp.confere('--- ESTRUTURA', true);
select pg_temp.confere('btree_gist instalada no esquema extensions',
  exists (select 1 from pg_extension e where e.extname = 'btree_gist' and e.extnamespace = 'extensions'::regnamespace));
select pg_temp.confere('horarios_especiais com RLS e a política "dono tudo, profissional os proprios"',
  (select c.relrowsecurity from pg_class c where c.oid = 'public.horarios_especiais'::regclass)
  and exists (select 1 from pg_policies p where p.tablename = 'horarios_especiais' and p.policyname = 'dono tudo, profissional os proprios'));
select pg_temp.confere('anon sem nenhuma permissão na tabela nova',
  not has_table_privilege('anon', 'public.horarios_especiais', 'select, insert, update, delete'));
select pg_temp.confere('gatilho de tempo real na tabela nova',
  exists (select 1 from pg_trigger t where t.tgname = 'avisar_mudanca' and t.tgrelid = 'public.horarios_especiais'::regclass));
select pg_temp.confere('funções novas e trocadas com search_path vazio',
  (select bool_and(p.proconfig = array['search_path=""']) and count(*) = 7 from pg_proc p
   where (p.pronamespace = 'privado'::regnamespace and p.proname in ('turnos_do_dia', 'dentro_do_expediente', 'cabe_na_grade', 'grade_do_dia', 'montar_dias'))
      or (p.pronamespace = 'public'::regnamespace and p.proname in ('salvar_horarios_especiais', 'vitrine'))));
select pg_temp.confere('salvar_horarios_especiais é security invoker, só para authenticated; turnos_do_dia para ninguém',
  (select not p.prosecdef from pg_proc p where p.proname = 'salvar_horarios_especiais')
  and has_function_privilege('authenticated', 'public.salvar_horarios_especiais(bigint, date, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.salvar_horarios_especiais(bigint, date, jsonb)', 'execute')
  and not has_function_privilege('anon', 'privado.turnos_do_dia(uuid, bigint, date)', 'execute')
  and not has_function_privilege('authenticated', 'privado.turnos_do_dia(uuid, bigint, date)', 'execute'));

select pg_temp.confere('--- SEM HORÁRIO ESPECIAL, TUDO IGUAL AO 05', true);
select pg_temp.confere('grade de cada dia igual à antiga (2 profissionais, 60 dias, 30 e 90 minutos)',
  not exists (
    select 1
    from generate_series((now() at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date + 59, interval '1 day') d,
      (values (1::bigint), (2::bigint)) p (id), (values (30), (90)) m (duracao)
    where array(select privado.grade_do_dia('00000000-0000-4000-8000-000000000001', p.id, d::date, m.duracao) order by 1)
       is distinct from array(select pg_temp.grade_antiga('00000000-0000-4000-8000-000000000001', p.id, d::date, m.duracao) order by 1)
  ));
select pg_temp.confere('expediente e grade iguais aos antigos a cada 15 minutos (2 profissionais, 21 dias, das 6h às 22h)',
  not exists (
    select 1
    from generate_series(pg_temp.hora((now() at time zone 'America/Sao_Paulo')::date, '06:00'),
                         pg_temp.hora((now() at time zone 'America/Sao_Paulo')::date + 20, '22:00'), interval '15 minutes') i,
      (values (1::bigint), (2::bigint)) p (id)
    where extract(hour from i at time zone 'America/Sao_Paulo') between 6 and 21
      and (privado.dentro_do_expediente('00000000-0000-4000-8000-000000000001', p.id, i, i + interval '30 minutes')
           is distinct from pg_temp.expediente_antigo('00000000-0000-4000-8000-000000000001', p.id, i, i + interval '30 minutes')
        or privado.cabe_na_grade('00000000-0000-4000-8000-000000000001', p.id, i, i + interval '30 minutes')
           is distinct from pg_temp.cabe_antigo('00000000-0000-4000-8000-000000000001', p.id, i, i + interval '30 minutes'))
  ));
select pg_temp.confere('dias abertos iguais à regra antiga (cada profissional e "qualquer", 31 dias)',
  not exists (
    select 1
    from (values (1::bigint), (2::bigint), (null::bigint)) p (id),
      jsonb_array_elements(public.dias_abertos('salao-exemplo', '[{"servico_id": 1}]', p.id,
        (now() at time zone 'America/Sao_Paulo')::date, (now() at time zone 'America/Sao_Paulo')::date + 30)) d
    where (d ->> 'aberto')::boolean is distinct from (
      (d ->> 'data')::date <= (now() at time zone 'America/Sao_Paulo')::date + 90 and exists (
        select 1 from public.profissionais x
        where x.ativo and (p.id is null or x.id = p.id)
          and exists (select 1 from public.horarios_trabalho h where h.profissional_id = x.id and h.dia_semana = extract(dow from (d ->> 'data')::date))
          and not privado.dia_inteiro_bloqueado('00000000-0000-4000-8000-000000000001', x.id, (d ->> 'data')::date)
      )
    )
  ));

select pg_temp.confere('--- GRAVAR', true);
select pg_temp.guarde('domingo', to_jsonb(pg_temp.proximo(0, 2)));
select pg_temp.guarde('domingo_seguinte', to_jsonb(pg_temp.proximo(0, 3)));
select pg_temp.guarde('sexta', to_jsonb(pg_temp.proximo(5, 3)));
select pg_temp.guarde('sexta_seguinte', to_jsonb(pg_temp.proximo(5, 4)));
select pg_temp.guarde('terca', to_jsonb(pg_temp.proximo(2, 3)));
select pg_temp.guarde('segunda', to_jsonb(pg_temp.proximo(1, 3)));

select pg_temp.confere('domingo começa fechado para o cliente', not pg_temp.aberto(1, pg_temp.lido('domingo')::date) and pg_temp.horas(1, pg_temp.lido('domingo')::date) = '');
select pg_temp.aceita('dono abre o domingo do Roberto das 9h às 13h', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, pg_temp.lido('domingo')::date, '[{"inicio":"09:00","fim":"13:00"}]'));
select pg_temp.aceita('Ana grava o próprio horário especial (sábado)', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  pg_temp.salvar(null, 2, pg_temp.proximo(6, 3), '[{"inicio":"08:00","fim":"12:00"}]'));
select pg_temp.recusa('Ana não grava horário especial do Roberto', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  pg_temp.salvar(null, 1, pg_temp.proximo(6, 3), '[{"inicio":"08:00","fim":"12:00"}]'), 'sem_permissao');
select pg_temp.recusa('visitante não chama salvar_horarios_especiais', 'anon', null,
  pg_temp.salvar(null, 1, pg_temp.proximo(6, 3), '[]'), 'permission denied');
select pg_temp.recusa('visitante não lê a tabela', 'anon', null,
  'select to_jsonb(count(*)) from public.horarios_especiais', 'permission denied');
select pg_temp.igual('Ana só vê os próprios horários especiais', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  'select to_jsonb(array_agg(distinct profissional_id)) from public.horarios_especiais', '[2]');
select pg_temp.igual('dono vê os de todos', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  'select to_jsonb(array_agg(distinct profissional_id order by profissional_id)) from public.horarios_especiais', '[1, 2]');
select pg_temp.recusa('Ana não grava direto na tabela para o Roberto (RLS)', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  format($c$insert into public.horarios_especiais (salao_id, profissional_id, data, inicio, fim) values ('00000000-0000-4000-8000-000000000001', 1, %L, '08:00', '09:00')$c$, pg_temp.proximo(6, 4)));
select pg_temp.recusa('início depois do fim é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, pg_temp.proximo(6, 4), '[{"inicio":"13:00","fim":"09:00"}]'), 'horario_invalido');
select pg_temp.recusa('linha sem fim é recusada', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, pg_temp.proximo(6, 4), '[{"inicio":"09:00"}]'), 'horario_invalido');
select pg_temp.recusa('mais de 6 intervalos é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, pg_temp.proximo(6, 4), '[{"inicio":"06:00","fim":"07:00"},{"inicio":"08:00","fim":"09:00"},{"inicio":"10:00","fim":"11:00"},{"inicio":"12:00","fim":"13:00"},{"inicio":"14:00","fim":"15:00"},{"inicio":"16:00","fim":"17:00"},{"inicio":"18:00","fim":"19:00"}]'), 'horario_invalido');
select pg_temp.recusa('data no passado é recusada', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, (now() at time zone 'America/Sao_Paulo')::date - 1, '[{"inicio":"09:00","fim":"12:00"}]'), 'data_invalida');
select pg_temp.recusa('data a mais de 1 ano é recusada', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, (now() at time zone 'America/Sao_Paulo')::date + 366, '[{"inicio":"09:00","fim":"12:00"}]'), 'data_invalida');
select pg_temp.aceita('data daqui a 1 ano é aceita', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, (now() at time zone 'America/Sao_Paulo')::date + 365, '[{"inicio":"09:00","fim":"12:00"}]'));
select pg_temp.recusa('profissional que não existe é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 999, pg_temp.proximo(6, 4), '[{"inicio":"09:00","fim":"12:00"}]'), 'nao_encontrado');
select pg_temp.recusa('intervalos sobrepostos são recusados', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, pg_temp.lido('domingo')::date, '[{"inicio":"09:00","fim":"12:00"},{"inicio":"11:00","fim":"14:00"}]'), 'horarios_sobrepostos');
select pg_temp.confere('... e o horário especial que já existia continua lá',
  (select string_agg(inicio || '-' || fim, ',') from public.horarios_especiais where profissional_id = 1 and data = pg_temp.lido('domingo')::date) = '09:00:00-13:00:00');

select pg_temp.confere('--- O HORÁRIO ESPECIAL VALE NO LUGAR DO DA SEMANA', true);
select pg_temp.confere('domingo especial aberto para o cliente, das 9h às 12h30 (serviço de 30 min)',
  pg_temp.aberto(1, pg_temp.lido('domingo')::date)
  and pg_temp.horas(1, pg_temp.lido('domingo')::date) = '09:00,09:30,10:00,10:30,11:00,11:30,12:00,12:30');
select pg_temp.confere('"qualquer profissional" também acha o domingo (só o Roberto atende)',
  pg_temp.aberto(null, pg_temp.lido('domingo')::date) and pg_temp.horas(null, pg_temp.lido('domingo')::date) like '09:00,%');
select pg_temp.confere('o horário especial do Roberto não abre o domingo da Ana',
  not pg_temp.aberto(2, pg_temp.lido('domingo')::date) and pg_temp.horas(2, pg_temp.lido('domingo')::date) = '');
select pg_temp.confere('o domingo seguinte continua fechado',
  not pg_temp.aberto(1, pg_temp.lido('domingo_seguinte')::date) and pg_temp.horas(1, pg_temp.lido('domingo_seguinte')::date) = '');

select pg_temp.aceita('dono estende a sexta do Roberto até 21h (com almoço)', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, pg_temp.lido('sexta')::date, '[{"inicio":"08:00","fim":"12:00"},{"inicio":"13:00","fim":"21:00"}]'));
select pg_temp.confere('sexta especial: começa às 8h, tem 20h30, e o almoço continua livre de horários',
  pg_temp.horas(1, pg_temp.lido('sexta')::date) like '08:00,%'
  and pg_temp.horas(1, pg_temp.lido('sexta')::date) like '%,20:30'
  and pg_temp.horas(1, pg_temp.lido('sexta')::date) not like '%12:00%'
  and pg_temp.horas(1, pg_temp.lido('sexta')::date) not like '%12:30%');
select pg_temp.confere('a sexta seguinte continua no horário da semana (9h às 18h30)',
  pg_temp.horas(1, pg_temp.lido('sexta_seguinte')::date) like '09:00,%'
  and pg_temp.horas(1, pg_temp.lido('sexta_seguinte')::date) like '%,18:30');

select pg_temp.aceita('dono encurta uma terça do Roberto para 10h às 11h', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, pg_temp.lido('terca')::date, '[{"inicio":"10:00","fim":"11:00"}]'));
select pg_temp.confere('terça especial menor vale no lugar da semana (só 10h e 10h30)',
  pg_temp.horas(1, pg_temp.lido('terca')::date) = '10:00,10:30');

select pg_temp.aceita('trocar os intervalos da terça de uma vez', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, pg_temp.lido('terca')::date, '[{"inicio":"14:00","fim":"15:00"},{"inicio":"16:00","fim":"16:30"}]'));
select pg_temp.confere('... ficam só os intervalos novos',
  pg_temp.horas(1, pg_temp.lido('terca')::date) = '14:00,14:30,16:00');
select pg_temp.aceita('apagar a terça (lista vazia)', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  pg_temp.salvar(null, 1, pg_temp.lido('terca')::date, '[]'));
select pg_temp.confere('... e a terça volta ao horário da semana',
  pg_temp.horas(1, pg_temp.lido('terca')::date) like '09:00,%' and pg_temp.horas(1, pg_temp.lido('terca')::date) like '%,18:30');

select pg_temp.confere('--- BLOQUEIOS POR CIMA', true);
insert into public.bloqueios (salao_id, profissional_id, inicio, fim, motivo)
values ('00000000-0000-4000-8000-000000000001', 1, pg_temp.hora(pg_temp.lido('domingo')::date, '10:00'), pg_temp.hora(pg_temp.lido('domingo')::date, '11:00'), 'Teste');
select pg_temp.confere('bloqueio dentro do domingo especial tira 10h e 10h30',
  pg_temp.horas(1, pg_temp.lido('domingo')::date) = '09:00,09:30,11:00,11:30,12:00,12:30');
insert into public.bloqueios (salao_id, profissional_id, inicio, fim, motivo)
values ('00000000-0000-4000-8000-000000000001', 1, pg_temp.hora(pg_temp.lido('sexta')::date, '00:00'), pg_temp.hora(pg_temp.lido('sexta')::date + 1, '00:00'), 'Folga');
select pg_temp.confere('folga de dia inteiro fecha a sexta especial',
  not pg_temp.aberto(1, pg_temp.lido('sexta')::date) and pg_temp.horas(1, pg_temp.lido('sexta')::date) = '');

select pg_temp.confere('--- MARCAR', true);
select pg_temp.aceita('cliente marca no domingo especial às 9h', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Visitante Domingo', '00900000301')$c$,
  pg_temp.hora(pg_temp.lido('domingo')::date, '09:00')));
select pg_temp.recusa('cliente não marca às 13h do domingo (fora do especial)', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Visitante Domingo', '00900000302')$c$,
  pg_temp.hora(pg_temp.lido('domingo')::date, '13:00')), 'fora_do_expediente');
select pg_temp.recusa('cliente não marca no domingo seguinte (fechado)', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Visitante Domingo', '00900000303')$c$,
  pg_temp.hora(pg_temp.lido('domingo_seguinte')::date, '09:00')), 'fora_do_expediente');
select pg_temp.igual('encaixe às 12h do domingo especial: livre e dentro do horário', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$select public.conferir_encaixe(1, %L, 30)$c$, pg_temp.hora(pg_temp.lido('domingo')::date, '12:00')),
  '{"livre": true, "fora_do_expediente": false}');
select pg_temp.igual('encaixe às 15h do domingo especial: livre, mas fora do horário', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$select public.conferir_encaixe(1, %L, 30)$c$, pg_temp.hora(pg_temp.lido('domingo')::date, '15:00')),
  '{"livre": true, "fora_do_expediente": true}');
select pg_temp.igual('encaixe às 10h do domingo seguinte (fechado): livre, mas fora do horário', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$select public.conferir_encaixe(1, %L, 30)$c$, pg_temp.hora(pg_temp.lido('domingo_seguinte')::date, '10:00')),
  '{"livre": true, "fora_do_expediente": true}');
select pg_temp.aceita('balcão marca no domingo fechado às 10h', 'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$select to_jsonb(public.salao_criar_agendamento('[{"servico_id": 1}]', 1, %L, 4))$c$, pg_temp.hora(pg_temp.lido('domingo_seguinte')::date, '10:00')));
select pg_temp.confere('... e esse horário continua fora da lista do cliente',
  pg_temp.horas(1, pg_temp.lido('domingo_seguinte')::date) = '');

select pg_temp.confere('--- VITRINE E TEMPO REAL', true);
insert into public.horarios_especiais (salao_id, profissional_id, data, inicio, fim) values
  ('00000000-0000-4000-8000-000000000001', 1, (now() at time zone 'America/Sao_Paulo')::date - 3, '09:00', '10:00'),
  ('00000000-0000-4000-8000-000000000001', 1, (now() at time zone 'America/Sao_Paulo')::date + 100, '09:00', '10:00');
select pg_temp.confere('vitrine traz os horários especiais de hoje até 90 dias (sem os passados e os distantes), só com profissional, data, início e fim',
  (select bool_and((e ->> 'data')::date between (now() at time zone 'America/Sao_Paulo')::date and (now() at time zone 'America/Sao_Paulo')::date + 90)
          and bool_and((select array_agg(k order by k) from jsonb_object_keys(e) k) = array['data', 'fim', 'inicio', 'profissional_id'])
          and bool_or((e ->> 'data')::date = pg_temp.lido('domingo')::date and (e ->> 'profissional_id')::int = 1 and e ->> 'inicio' = '09:00:00')
   from jsonb_array_elements(public.vitrine('salao-exemplo') -> 'horarios_especiais') e));
update public.profissionais set ativo = false where id = 2;
select pg_temp.confere('vitrine não traz horário especial de profissional inativo',
  not exists (select 1 from jsonb_array_elements(public.vitrine('salao-exemplo') -> 'horarios_especiais') e where (e ->> 'profissional_id')::int = 2));
update public.profissionais set ativo = true where id = 2;
select pg_temp.confere('vitrine continua com o mais_pedidos do 07', jsonb_typeof(public.vitrine('salao-exemplo') -> 'mais_pedidos') = 'array');
select pg_temp.confere('salvar um horário especial avisa "horarios" no canal do salão',
  exists (select 1 from realtime.messages m where m.topic = 'salao:00000000-0000-4000-8000-000000000001' and m.payload ->> 'tipo' = 'horarios'));


select resultado from (
  select n, resultado from pg_temp.resultados
  union all
  select 100000, 'TOTAL: ' || count(*) filter (where resultado like 'OK %' and resultado not like '%---%')
    || ' OK, ' || count(*) filter (where resultado like 'FALHOU%') || ' FALHOU'
  from pg_temp.resultados
) x order by n;

rollback;
