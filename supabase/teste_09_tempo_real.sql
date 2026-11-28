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

  delete from public.profissional_variacoes where salao_id = '00000000-0000-4000-8000-000000000001';
  delete from public.servico_variacoes where salao_id = '00000000-0000-4000-8000-000000000001' and id > 9;
  delete from public.servicos where salao_id = '00000000-0000-4000-8000-000000000001' and id > 12;

  insert into public.categorias (id, salao_id, nome, ordem)
  overriding system value values
    (1, '00000000-0000-4000-8000-000000000001', 'Corte', 1),
    (2, '00000000-0000-4000-8000-000000000001', 'Coloração', 2),
    (3, '00000000-0000-4000-8000-000000000001', 'Escova', 3),
    (4, '00000000-0000-4000-8000-000000000001', 'Tratamento', 4),
    (5, '00000000-0000-4000-8000-000000000001', 'Barba', 5)
  on conflict (id) do update set nome = excluded.nome, ordem = excluded.ordem;

  insert into public.servicos (id, salao_id, categoria_id, nome, descricao, foto_url, duracao_min, preco, tipo_preco, ativo, ordem, criado_em)
  overriding system value values
    (1, '00000000-0000-4000-8000-000000000001', 1, 'Corte masculino', 'Corte na tesoura ou máquina, com lavagem.', null, 30, 45, 'fixo', true, 1, '2026-01-10T12:00:00Z'),
    (2, '00000000-0000-4000-8000-000000000001', 1, 'Corte feminino', 'Corte com lavagem e finalização.', null, 60, 80, 'fixo', true, 2, '2026-01-10T12:00:00Z'),
    (3, '00000000-0000-4000-8000-000000000001', 1, 'Corte infantil', 'Para crianças até 12 anos.', null, 30, 35, 'fixo', true, 3, '2026-01-10T12:00:00Z'),
    (4, '00000000-0000-4000-8000-000000000001', 2, 'Tintura', 'Coloração completa. O preço muda com o tamanho do cabelo.', null, 90, 120, 'a_partir', true, 4, '2026-01-10T12:00:00Z'),
    (5, '00000000-0000-4000-8000-000000000001', 2, 'Mechas', 'Luzes ou mechas. O valor é combinado depois de avaliar o cabelo.', null, 180, null, 'consulta', true, 5, '2026-01-10T12:00:00Z'),
    (6, '00000000-0000-4000-8000-000000000001', 2, 'Retoque de raiz', 'Tintura só na raiz.', null, 60, 90, 'fixo', true, 6, '2026-01-10T12:00:00Z'),
    (7, '00000000-0000-4000-8000-000000000001', 3, 'Escova', 'Escova modelada. O preço muda com o tamanho do cabelo.', null, 40, 50, 'a_partir', true, 7, '2026-01-10T12:00:00Z'),
    (8, '00000000-0000-4000-8000-000000000001', 3, 'Escova progressiva', 'Alisamento que dura meses. O valor final depende do volume do cabelo.', null, 150, 200, 'a_partir', true, 8, '2026-01-10T12:00:00Z'),
    (9, '00000000-0000-4000-8000-000000000001', 4, 'Hidratação', 'Hidratação profunda. O preço muda com o tamanho do cabelo.', null, 40, 60, 'a_partir', true, 9, '2026-01-10T12:00:00Z'),
    (10, '00000000-0000-4000-8000-000000000001', 4, 'Cauterização', 'Reconstrução para cabelo danificado.', null, 90, 150, 'fixo', true, 10, '2026-01-10T12:00:00Z'),
    (11, '00000000-0000-4000-8000-000000000001', 5, 'Barba', 'Barba com toalha quente e navalha.', null, 30, 35, 'fixo', true, 11, '2026-01-10T12:00:00Z'),
    (12, '00000000-0000-4000-8000-000000000001', 5, 'Corte e barba', 'Corte masculino e barba juntos.', null, 60, 70, 'fixo', true, 12, '2026-01-10T12:00:00Z')
  on conflict (id) do update set
    categoria_id = excluded.categoria_id, nome = excluded.nome, descricao = excluded.descricao, foto_url = excluded.foto_url,
    duracao_min = excluded.duracao_min, preco = excluded.preco, tipo_preco = excluded.tipo_preco,
    ativo = excluded.ativo, ordem = excluded.ordem;

  delete from public.categorias where salao_id = '00000000-0000-4000-8000-000000000001' and id > 5;

  insert into public.servico_variacoes (id, salao_id, servico_id, nome, preco, duracao_min, ordem, ativa)
  overriding system value values
    (1, '00000000-0000-4000-8000-000000000001', 4, 'Curto', 120, 90, 1, true),
    (2, '00000000-0000-4000-8000-000000000001', 4, 'Médio', 150, 110, 2, true),
    (3, '00000000-0000-4000-8000-000000000001', 4, 'Longo', 190, 130, 3, true),
    (4, '00000000-0000-4000-8000-000000000001', 7, 'Curto', 50, 40, 1, true),
    (5, '00000000-0000-4000-8000-000000000001', 7, 'Médio', 65, 50, 2, true),
    (6, '00000000-0000-4000-8000-000000000001', 7, 'Longo', 80, 60, 3, true),
    (7, '00000000-0000-4000-8000-000000000001', 9, 'Curto', 60, 40, 1, true),
    (8, '00000000-0000-4000-8000-000000000001', 9, 'Médio', 75, 50, 2, true),
    (9, '00000000-0000-4000-8000-000000000001', 9, 'Longo', 90, 60, 3, true)
  on conflict (id) do update set
    servico_id = excluded.servico_id, nome = excluded.nome, preco = excluded.preco,
    duracao_min = excluded.duracao_min, ordem = excluded.ordem, ativa = excluded.ativa;

  delete from public.profissional_servicos where salao_id = '00000000-0000-4000-8000-000000000001';
  insert into public.profissional_servicos (salao_id, profissional_id, servico_id, preco)
  select '00000000-0000-4000-8000-000000000001', profissional_id, servico_id, null
  from (values
    (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 9), (1, 10), (1, 11), (1, 12),
    (2, 1), (2, 2), (2, 3), (2, 7), (2, 8), (2, 9), (2, 10), (2, 11), (2, 12)
  ) as ligacoes (profissional_id, servico_id);

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
  ('a0000000-0000-4000-8000-000000000002', 'ana@exemplo.com'),
  ('a0000000-0000-4000-8000-000000000003', 'sem.vinculo@exemplo.com'),
  ('a0000000-0000-4000-8000-000000000004', 'carla@exemplo.com');
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000001' where id = 1;
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000002' where id = 2;
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000004' where id = 3;

create temp table vistos (id text primary key);
create temp table do_teste (id text primary key);

create function pg_temp.avisos() returns text
language plpgsql as $$
declare
  v_tipos text;
begin
  select string_agg(m.payload ->> 'tipo', ',' order by m.payload ->> 'tipo') into v_tipos
  from realtime.messages m
  where m.topic like 'salao:%' and m.id::text not in (select v.id from pg_temp.vistos v);
  insert into pg_temp.do_teste
  select m.id::text from realtime.messages m
  where m.topic like 'salao:%' and m.id::text not in (select v.id from pg_temp.vistos v);
  insert into pg_temp.vistos select m.id::text from realtime.messages m on conflict do nothing;
  perform set_config('marca_aviso.' || t, '', true)
  from unnest(array['agendamentos', 'bloqueios', 'horarios', 'clientes', 'servicos', 'equipe', 'salao']) t;
  return coalesce(v_tipos, '');
end;
$$;

create function pg_temp.avisou(p_nome text, p_esperado text) returns void
language plpgsql as $$
declare
  v_tipos text := pg_temp.avisos();
begin
  perform pg_temp.confere(p_nome, v_tipos = p_esperado, 'veio "' || v_tipos || '", esperado "' || p_esperado || '"');
end;
$$;

create function pg_temp.le(p_papel text, p_usuario uuid, p_topico_do_canal text, p_topico_da_linha text) returns integer
language plpgsql as $$
declare
  r jsonb;
begin
  perform set_config('realtime.topic', p_topico_do_canal, true);
  r := pg_temp.rodar(p_papel, p_usuario,
    format('select to_jsonb(count(*)) from realtime.messages where topic = %L', p_topico_da_linha));
  perform set_config('realtime.topic', '', true);
  return case when (r ->> 'ok')::boolean then (r ->> 'resultado')::integer else 0 end;
end;
$$;

select realtime.send('{"tipo":"teste"}'::jsonb, 'checagem', 'salao:checagem', true);
select pg_temp.confere('realtime.send grava (se falhar: abra a Agenda logado uma vez, para o Realtime criar as partições de realtime.messages)',
  exists (select 1 from realtime.messages m where m.topic = 'salao:checagem' and m.event = 'checagem'));

select pg_temp.avisos();
delete from pg_temp.do_teste;

select pg_temp.guarde('ana', pg_temp.aceita('cliente marca pela vitrine com a Ana', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 2, %L, 'Visitante Tempo Real', '00900000190')$c$,
  pg_temp.momento(3, '16:00'))));
select pg_temp.avisou('... avisa uma vez "agendamentos" (o cadastro novo do cliente não avisa)', 'agendamentos');

select pg_temp.aceita('cliente remarca da Ana para o Roberto (muda o preço dos itens e o agendamento)', 'anon', null, format(
  $c$select public.remarcar_agendamento(%s, %L, %L, 1)$c$,
  pg_temp.lido('ana')::jsonb ->> 'id', pg_temp.lido('ana')::jsonb ->> 'codigo', pg_temp.momento(3, '17:00')));
select pg_temp.avisou('... avisa uma vez "agendamentos"', 'agendamentos');

select pg_temp.aceita('cliente cancela', 'anon', null, format(
  $c$select public.cancelar_agendamento(%s, %L)$c$,
  pg_temp.lido('ana')::jsonb ->> 'id', pg_temp.lido('ana')::jsonb ->> 'codigo'));
select pg_temp.avisou('... avisa uma vez "agendamentos"', 'agendamentos');

select pg_temp.aceita('dono marca pelo balcão', 'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$select to_jsonb(public.salao_criar_agendamento('[{"servico_id": 1}]', 1, %L, 4))$c$, pg_temp.momento(5, '14:00')));
select pg_temp.avisou('... avisa uma vez "agendamentos" (grava o agendamento e o valor na mesma transação)', 'agendamentos');
select pg_temp.guarde('balcao', to_jsonb((select max(id) from public.agendamentos where cliente_id = 4)));

select pg_temp.aceita('dono conclui com o valor cobrado', 'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$select 1 from public.mudar_status_agendamento(%s, 'concluido', 60, 'pix')$c$, pg_temp.lido('balcao')));
select pg_temp.avisou('... avisa "agendamentos" (o valor cobrado fica no próprio agendamento)', 'agendamentos');
select pg_temp.aceita('dono volta para agendado', 'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$select 1 from public.mudar_status_agendamento(%s, 'agendado')$c$, pg_temp.lido('balcao')));
select pg_temp.avisou('... avisa "agendamentos"', 'agendamentos');

select pg_temp.recusa('equipe não grava itens direto em agendamento_servicos', 'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$insert into public.agendamento_servicos (salao_id, agendamento_id, servico_id, preco, duracao_min) values ('00000000-0000-4000-8000-000000000001', %s, 1, 1, 30)$c$,
  pg_temp.lido('balcao')), 'permission denied');
select pg_temp.recusa('equipe não muda itens direto em agendamento_servicos', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.agendamento_servicos set preco = 1$c$, 'permission denied');
select pg_temp.recusa('equipe não muda agendamento direto na tabela', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.agendamentos set valor_total = 1$c$, 'permission denied');
select pg_temp.recusa('cliente (anon) não grava itens direto', 'anon', null,
  $c$update public.agendamento_servicos set preco = 1$c$, 'permission denied');

select pg_temp.aceita('Ana cria um bloqueio', 'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$insert into public.bloqueios (salao_id, profissional_id, inicio, fim, motivo) values ('00000000-0000-4000-8000-000000000001', 2, %L, %L, 'Teste')$c$,
  pg_temp.momento(6, '08:00'), pg_temp.momento(6, '09:00')));
select pg_temp.avisou('... avisa "bloqueios"', 'bloqueios');
select pg_temp.aceita('Ana apaga o bloqueio', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$delete from public.bloqueios where motivo = 'Teste'$c$);
select pg_temp.avisou('... avisa "bloqueios"', 'bloqueios');

select pg_temp.aceita('dono salva os horários da Ana (apaga todos e grava 3)', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select 1 from public.salvar_horarios_do_profissional(2, '[{"dia_semana":2,"inicio":"08:00:00","fim":"12:00:00"},{"dia_semana":2,"inicio":"13:00:00","fim":"18:00:00"},{"dia_semana":3,"inicio":"09:00:00","fim":"17:00:00"}]'::jsonb)$c$);
select pg_temp.avisou('... avisa uma vez só "horarios"', 'horarios');
select pg_temp.recusa('horários sobrepostos são recusados', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select 1 from public.salvar_horarios_do_profissional(2, '[{"dia_semana":3,"inicio":"08:00:00","fim":"12:00:00"},{"dia_semana":3,"inicio":"11:00:00","fim":"15:00:00"}]'::jsonb)$c$,
  'horarios_sobrepostos');
select pg_temp.avisou('... e o que deu erro não avisa', '');

select pg_temp.aceita('dono corrige o nome de um cliente', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.clientes set nome = 'Rafael Oliveira Souza' where id = 4$c$);
select pg_temp.avisou('... avisa "clientes" (o nome aparece na Agenda)', 'clientes');
select pg_temp.aceita('dono cadastra um cliente sem agendamento', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$insert into public.clientes (salao_id, nome, telefone) values ('00000000-0000-4000-8000-000000000001', 'Cliente Sem Horário', '00900000191')$c$);
select pg_temp.avisou('... cadastro novo não avisa (ainda não aparece na Agenda)', '');
select pg_temp.aceita('dono remove os dados desse cliente', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(public.remover_dados_do_cliente((select id from public.clientes where telefone = '00900000191')))$c$);
select pg_temp.avisou('... avisa "clientes"', 'clientes');

select pg_temp.aceita('dono renomeia um serviço', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.servicos set nome = 'Corte masculino clássico' where id = 1$c$);
select pg_temp.avisou('... avisa "servicos" (o nome aparece na Agenda e no Resumo)', 'servicos');
select pg_temp.aceita('dono renomeia um tamanho', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.servico_variacoes set nome = 'Médio longo' where id = 2$c$);
select pg_temp.avisou('... avisa "servicos"', 'servicos');
select pg_temp.aceita('dono muda a ordem dos serviços', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.trocar_ordem_servico(2, 'subir')$c$);
select pg_temp.avisou('... mudar só a ordem não avisa', '');

select pg_temp.aceita('dono muda o nome de um profissional', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.profissionais set nome = 'Ana Paula' where id = 2$c$);
select pg_temp.avisou('... avisa "equipe"', 'equipe');
select pg_temp.aceita('dono muda o intervalo da agenda do salão', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.salao set intervalo_minutos = 15 where id = '00000000-0000-4000-8000-000000000001'$c$);
select pg_temp.avisou('... avisa "salao"', 'salao');

select pg_temp.confere('todos os avisos: canal do salão, evento "mudou", privados e só com o tipo e o id da mensagem',
  (select count(*) from pg_temp.do_teste) = 15
  and (select bool_and(
         m.topic = 'salao:00000000-0000-4000-8000-000000000001'
         and m.event = 'mudou' and m.private and m.extension = 'broadcast'
         and jsonb_typeof(m.payload -> 'tipo') = 'string'
         and (m.payload ->> 'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         and (select array_agg(k order by k) from jsonb_object_keys(m.payload) k) = array['id', 'tipo'])
       from realtime.messages m where m.id::text in (select id from pg_temp.do_teste)));

select realtime.send('{"tipo":"agendamentos"}'::jsonb, 'mudou', 'salao:00000000-0000-4000-8000-000000000002', true);
select pg_temp.confere('dono ouve o canal do próprio salão',
  pg_temp.le('authenticated', 'a0000000-0000-4000-8000-000000000001',
    'salao:00000000-0000-4000-8000-000000000001', 'salao:00000000-0000-4000-8000-000000000001') > 0);
select pg_temp.confere('profissional (Ana) ouve o canal do próprio salão',
  pg_temp.le('authenticated', 'a0000000-0000-4000-8000-000000000002',
    'salao:00000000-0000-4000-8000-000000000001', 'salao:00000000-0000-4000-8000-000000000001') > 0);
select pg_temp.confere('dono não entra no canal de outro salão',
  pg_temp.le('authenticated', 'a0000000-0000-4000-8000-000000000001',
    'salao:00000000-0000-4000-8000-000000000002', 'salao:00000000-0000-4000-8000-000000000002') = 0);
select pg_temp.confere('no canal do próprio salão, o dono não lê avisos de outro salão',
  pg_temp.le('authenticated', 'a0000000-0000-4000-8000-000000000001',
    'salao:00000000-0000-4000-8000-000000000001', 'salao:00000000-0000-4000-8000-000000000002') = 0);
select pg_temp.confere('usuário sem vínculo com profissional não entra',
  pg_temp.le('authenticated', 'a0000000-0000-4000-8000-000000000003',
    'salao:00000000-0000-4000-8000-000000000001', 'salao:00000000-0000-4000-8000-000000000001') = 0);
select pg_temp.confere('profissional inativo (Carla) não entra',
  pg_temp.le('authenticated', 'a0000000-0000-4000-8000-000000000004',
    'salao:00000000-0000-4000-8000-000000000001', 'salao:00000000-0000-4000-8000-000000000001') = 0);
select pg_temp.confere('visitante (anon) não entra',
  pg_temp.le('anon', null,
    'salao:00000000-0000-4000-8000-000000000001', 'salao:00000000-0000-4000-8000-000000000001') = 0);
select pg_temp.recusa('equipe não manda mensagem no canal', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$insert into realtime.messages (topic, extension, payload, event, private) values ('salao:00000000-0000-4000-8000-000000000001', 'broadcast', '{"tipo":"agendamentos"}', 'mudou', true)$c$);
select pg_temp.recusa('visitante não manda mensagem no canal', 'anon', null,
  $c$insert into realtime.messages (topic, extension, payload, event, private) values ('salao:00000000-0000-4000-8000-000000000001', 'broadcast', '{"tipo":"agendamentos"}', 'mudou', true)$c$);

select pg_temp.confere('nenhuma tabela do salão na publicação do tempo real (sem postgres_changes)',
  not exists (select 1 from pg_publication_tables t where t.schemaname = 'public'));
select pg_temp.confere('RLS ativado em realtime.messages',
  (select c.relrowsecurity from pg_class c where c.oid = 'realtime.messages'::regclass));
select pg_temp.confere('privado.avisar_mudanca: security definer com search_path vazio, sem execute para public, anon e authenticated',
  (select p.prosecdef and p.proconfig = array['search_path=""'] from pg_proc p
   where p.pronamespace = 'privado'::regnamespace and p.proname = 'avisar_mudanca')
  and not has_function_privilege('anon', 'privado.avisar_mudanca()', 'execute')
  and not has_function_privilege('authenticated', 'privado.avisar_mudanca()', 'execute')
  and not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.pronamespace = 'privado'::regnamespace and p.proname = 'avisar_mudanca' and a.grantee = 0));
select pg_temp.confere('os 8 gatilhos de aviso estão nas tabelas certas (e o 9º em horarios_especiais, com o 12)',
  (select string_agg(c.relname, ',' order by c.relname) from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where t.tgname = 'avisar_mudanca' and not t.tgisinternal and c.relname <> 'horarios_especiais')
  = 'agendamentos,bloqueios,clientes,horarios_trabalho,profissionais,salao,servico_variacoes,servicos'
  and (to_regclass('public.horarios_especiais') is null or exists (
    select 1 from pg_trigger t where t.tgname = 'avisar_mudanca' and t.tgrelid = to_regclass('public.horarios_especiais'))));


select resultado from (
  select n, resultado from pg_temp.resultados
  union all
  select 100000, 'TOTAL: ' || count(*) filter (where resultado like 'OK %' and resultado not like '%---%')
    || ' OK, ' || count(*) filter (where resultado like 'FALHOU%') || ' FALHOU'
  from pg_temp.resultados
) x order by n;

rollback;
