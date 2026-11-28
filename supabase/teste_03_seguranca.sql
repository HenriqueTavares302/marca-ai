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
  ('a0000000-0000-4000-8000-000000000003', 'carla@exemplo.com'),
  ('a0000000-0000-4000-8000-000000000004', 'cliente@exemplo.com'),
  ('a0000000-0000-4000-8000-000000000005', 'outro@exemplo.com');

update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000001' where id = 1;
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000002' where id = 2;
insert into public.profissionais (salao_id, user_id, nome, telefone, papel, ativo)
values ('00000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'Carla Dias', '00900000012', 'profissional', false);
select pg_temp.guarde('carla', to_jsonb(id)) from public.profissionais where nome = 'Carla Dias';

insert into public.salao (id, slug, nome) values ('00000000-0000-4000-8000-000000000002', 'outro-salao', 'Outro Salão');
insert into public.profissionais (salao_id, user_id, nome, papel)
values ('00000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000005', 'Pessoa do Outro', 'dono');
insert into public.categorias (salao_id, nome) values ('00000000-0000-4000-8000-000000000002', 'Corte');
insert into public.servicos (salao_id, categoria_id, nome, duracao_min, preco)
select '00000000-0000-4000-8000-000000000002', id, 'Serviço do outro', 30, 10 from public.categorias where salao_id = '00000000-0000-4000-8000-000000000002';
insert into public.clientes (salao_id, nome, telefone) values ('00000000-0000-4000-8000-000000000002', 'Cliente do Outro', '00900000001');
select pg_temp.guarde('servico_do_outro', to_jsonb(id)) from public.servicos where nome = 'Serviço do outro';

update public.servicos set ativo = false where id = 3;
update public.servico_variacoes set ativa = false where id = 9;
update public.profissional_servicos set preco = 50 where profissional_id = 2 and servico_id = 1;

insert into public.bloqueios (salao_id, profissional_id, inicio, fim, motivo) values
  ('00000000-0000-4000-8000-000000000001', 2, pg_temp.momento(4, '00:00'), pg_temp.momento(4, '00:00') + interval '1 day', 'Médico'),
  ('00000000-0000-4000-8000-000000000001', 1, pg_temp.momento(6, '00:00'), pg_temp.momento(6, '00:00') + interval '1 day', 'Curso');

insert into public.agendamentos (salao_id, cliente_id, profissional_id, inicio, fim, codigo_hash)
values ('00000000-0000-4000-8000-000000000001', 8, pg_temp.lido('carla')::bigint,
  now() + interval '60 minutes', now() + interval '90 minutes', extensions.digest('codigo-dentro-de-2-horas', 'sha256'));
insert into public.agendamentos (salao_id, cliente_id, profissional_id, inicio, fim)
values ('00000000-0000-4000-8000-000000000001', 8, pg_temp.lido('carla')::bigint,
  pg_temp.momento(5, '10:00'), pg_temp.momento(5, '10:30'));

select pg_temp.guarde('total_agendamentos', to_jsonb(count(*))) from public.agendamentos where salao_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.guarde('total_clientes', to_jsonb(count(*))) from public.clientes where salao_id = '00000000-0000-4000-8000-000000000001';
select pg_temp.guarde('agendamentos_da_mariana', to_jsonb(count(*))) from public.agendamentos where cliente_id = 1;


select pg_temp.confere('--- VISITANTE (anon, sem login)', true);

select pg_temp.recusa('visitante não lê a tabela ' || t, 'anon', null, format('select to_jsonb(count(*)) from public.%I', t), 'permission denied')
from unnest(array[
  'salao', 'profissionais', 'categorias', 'servicos', 'servico_variacoes', 'profissional_servicos',
  'profissional_variacoes', 'horarios_trabalho', 'bloqueios', 'clientes', 'agendamentos', 'agendamento_servicos'
]) t;

select pg_temp.recusa('visitante não altera preço direto na tabela', 'anon', null,
  $c$update public.servicos set preco = 1 where id = 1$c$, 'permission denied');

select pg_temp.guarde('vitrine', pg_temp.aceita('visitante abre a vitrine', 'anon', null, $c$select public.vitrine('salao-exemplo')$c$));

select pg_temp.confere('vitrine: profissionais só com id, nome e foto',
  (select bool_and((select array_agg(k order by k) from jsonb_object_keys(p) k) = array['foto_url', 'id', 'nome'])
   from jsonb_array_elements(pg_temp.lido('vitrine')::jsonb -> 'profissionais') p));
select pg_temp.confere('vitrine: sem user_id, papel, telefone de profissional, bloqueio ou observação',
  pg_temp.lido('vitrine') not like '%user_id%' and pg_temp.lido('vitrine') not like '%papel%'
  and pg_temp.lido('vitrine') not like '%00900000010%' and pg_temp.lido('vitrine') not like '%00900000011%'
  and pg_temp.lido('vitrine') not like '%bloqueio%' and pg_temp.lido('vitrine') not like '%Folga%'
  and pg_temp.lido('vitrine') not like '%Médico%' and pg_temp.lido('vitrine') not like '%observac%'
  and pg_temp.lido('vitrine') not like '%Alergia%');
select pg_temp.confere('vitrine: sem profissional inativo (Carla)', pg_temp.lido('vitrine') not like '%Carla%');
select pg_temp.confere('vitrine: sem serviço inativo (Corte infantil)', pg_temp.lido('vitrine') not like '%Corte infantil%');
select pg_temp.confere('vitrine: sem variação inativa (id 9)',
  not exists (select 1 from jsonb_array_elements(pg_temp.lido('vitrine')::jsonb -> 'variacoes') v where (v ->> 'id')::int = 9));
select pg_temp.confere('vitrine: traz o preço próprio da Ana (R$ 50 no corte masculino)',
  exists (select 1 from jsonb_array_elements(pg_temp.lido('vitrine')::jsonb -> 'profissional_servicos') x
          where (x ->> 'profissional_id')::int = 2 and (x ->> 'servico_id')::int = 1 and (x ->> 'preco')::numeric = 50));
select pg_temp.confere('vitrine: nada do outro salão', pg_temp.lido('vitrine') not like '%Serviço do outro%');
select pg_temp.recusa('vitrine de salão que não existe', 'anon', null, $c$select public.vitrine('nao-existe')$c$, 'salao_nao_encontrado');

select pg_temp.guarde('ag1', pg_temp.aceita('visitante agenda corte com o Roberto', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1, "preco": 1}]', 1, %L, 'Visitante Um', '00900000090', 'Primeira vez', 'salao')$c$,
  pg_temp.momento(3, '09:00'))));
select pg_temp.confere('preço vem do banco, não do aparelho (R$ 45, ignorou o 1)', (pg_temp.lido('ag1')::jsonb ->> 'valor_total')::numeric = 45);
select pg_temp.confere('devolve um código secreto de 64 caracteres', pg_temp.lido('ag1')::jsonb ->> 'codigo' ~ '^[0-9a-f]{64}$');
select pg_temp.confere('banco guarda só o hash do código',
  (select a.codigo_hash = extensions.digest(pg_temp.lido('ag1')::jsonb ->> 'codigo', 'sha256')
   from public.agendamentos a where a.id = (pg_temp.lido('ag1')::jsonb ->> 'id')::bigint)
  and not exists (select 1 from public.agendamentos a where encode(a.codigo_hash, 'hex') = pg_temp.lido('ag1')::jsonb ->> 'codigo'));
select pg_temp.confere('resposta sem observação do agendamento', pg_temp.lido('ag1') not like '%Primeira vez%');

select pg_temp.guarde('ag2', pg_temp.aceita('visitante agenda com "qualquer profissional"', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', null, %L, 'Visitante Dois', '00900000091')$c$,
  pg_temp.momento(3, '09:00'))));
select pg_temp.confere('"qualquer" pegou a Ana (Roberto ocupado) com o preço dela (R$ 50)',
  (pg_temp.lido('ag2')::jsonb #>> '{profissional,id}')::int = 2 and (pg_temp.lido('ag2')::jsonb ->> 'valor_total')::numeric = 50);

select pg_temp.guarde('ag3', pg_temp.aceita('visitante agenda tintura médio (variação)', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 4, "variacao_id": 2}]', 1, %L, 'Visitante Três', '00900000092')$c$,
  pg_temp.momento(3, '13:00'))));
select pg_temp.confere('variação: preço R$ 150 e 110 min',
  (pg_temp.lido('ag3')::jsonb ->> 'valor_total')::numeric = 150
  and (pg_temp.lido('ag3')::jsonb ->> 'fim')::timestamptz - (pg_temp.lido('ag3')::jsonb ->> 'inicio')::timestamptz = interval '110 minutes');

select pg_temp.recusa('horário ocupado', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.momento(3, '09:00')), 'horario_ocupado');
select pg_temp.recusa('horário no passado', 'anon', null,
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, now() - interval '1 day', 'Outra Pessoa', '00900000093')$c$,
  'antecedencia_minima');
select pg_temp.recusa('antes da antecedência mínima (daqui a 10 min)', 'anon', null,
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, date_trunc('minute', now()) + interval '10 minutes', 'Outra Pessoa', '00900000093')$c$,
  'antecedencia_minima');
select pg_temp.recusa('mais de 90 dias no futuro', 'anon', null,
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, now() + interval '91 days', 'Outra Pessoa', '00900000093')$c$,
  'muito_distante');
select pg_temp.recusa('fora do expediente (20:00)', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.momento(3, '20:00')), 'fora_do_expediente');
select pg_temp.recusa('no almoço (12:00, entre os dois intervalos)', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.momento(3, '12:00')), 'fora_do_expediente');
select pg_temp.recusa('fora da grade de 30 min (09:10)', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 2, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.momento(3, '09:10')), 'fora_do_expediente');
select pg_temp.recusa('dentro de um bloqueio da Ana', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 2, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.momento(4, '10:00')), 'horario_bloqueado');
select pg_temp.recusa('serviço inativo', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 3}]', 1, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.momento(3, '15:00')), 'servicos_invalidos');
select pg_temp.recusa('serviço que a Ana não faz (tintura)', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 4, "variacao_id": 1}]', 2, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.momento(3, '15:00')), 'profissional_nao_faz_o_servico');
select pg_temp.recusa('variação de outro serviço', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 4, "variacao_id": 4}]', 1, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.momento(3, '15:00')), 'tamanho_invalido');
select pg_temp.recusa('variação inativa', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 9, "variacao_id": 9}]', 1, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.momento(3, '15:00')), 'tamanho_invalido');
select pg_temp.recusa('serviço com tamanho sem escolher o tamanho', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 4}]', 1, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.momento(3, '15:00')), 'tamanho_invalido');
select pg_temp.recusa('serviço do outro salão', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": %s}]', 1, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.lido('servico_do_outro'), pg_temp.momento(3, '15:00')), 'servicos_invalidos');
select pg_temp.recusa('profissional inativo (Carla)', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', %s, %L, 'Outra Pessoa', '00900000093')$c$,
  pg_temp.lido('carla'), pg_temp.momento(3, '15:00')), 'profissional_invalido');
select pg_temp.recusa('Pix com o Pix desligado', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Outra Pessoa', '00900000093', null, 'pix')$c$,
  pg_temp.momento(3, '15:00')), 'forma_de_pagamento_invalida');
select pg_temp.recusa('celular inválido', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Outra Pessoa', '123')$c$,
  pg_temp.momento(3, '15:00')), 'telefone_invalido');

select pg_temp.guarde('ag_camila', pg_temp.aceita('visitante usa o celular de uma cliente já cadastrada', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Nome Digitado', '00900000007')$c$,
  pg_temp.momento(3, '15:00'))));
select pg_temp.confere('não revela o nome nem as observações do cadastro',
  pg_temp.lido('ag_camila') not like '%Camila%' and pg_temp.lido('ag_camila') not like '%Alergia%'
  and pg_temp.lido('ag_camila')::jsonb #>> '{cliente,nome}' = 'Nome Digitado');
select pg_temp.confere('não altera o cadastro existente',
  (select nome = 'Camila Martins' and observacoes = 'Alergia a amônia.' from public.clientes where id = 7));

select pg_temp.aceita('mesmo celular: 2º agendamento futuro', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Visitante Um', '00900000090')$c$,
  pg_temp.momento(3, '16:00')));
select pg_temp.aceita('mesmo celular: 3º agendamento futuro', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Visitante Um', '00900000090')$c$,
  pg_temp.momento(3, '16:30')));
select pg_temp.recusa('mesmo celular: 4º agendamento futuro', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Visitante Um', '00900000090')$c$,
  pg_temp.momento(3, '17:00')), 'limite_de_agendamentos');

select pg_temp.igual('meus agendamentos com o código certo', 'anon', null, format(
  $c$select to_jsonb(jsonb_array_length(public.meus_agendamentos(array[%L])))$c$, pg_temp.lido('ag1')::jsonb ->> 'codigo'), '1');
select pg_temp.igual('meus agendamentos com código errado vem vazio', 'anon', null,
  $c$select public.meus_agendamentos(array['codigo-que-nao-existe'])$c$, '[]');
select pg_temp.confere('meus agendamentos não traz observação nem dados do cadastro',
  (select r::text not like '%Primeira vez%' and r::text not like '%Alergia%' and r::text not like '%cliente%'
   from pg_temp.rodar('anon', null, format($c$select public.meus_agendamentos(array[%L, %L])$c$,
     pg_temp.lido('ag1')::jsonb ->> 'codigo', pg_temp.lido('ag_camila')::jsonb ->> 'codigo')) r));

select pg_temp.recusa('cancelar com o código de outro agendamento', 'anon', null, format(
  $c$select public.cancelar_agendamento(%s, %L)$c$,
  pg_temp.lido('ag1')::jsonb ->> 'id', pg_temp.lido('ag2')::jsonb ->> 'codigo'), 'nao_encontrado');
select pg_temp.recusa('cancelar a menos de 2 horas', 'anon', null, format(
  $c$select public.cancelar_agendamento(%s, 'codigo-dentro-de-2-horas')$c$,
  (select id from public.agendamentos where codigo_hash = extensions.digest('codigo-dentro-de-2-horas', 'sha256'))), 'fora_do_prazo');
select pg_temp.recusa('remarcar para horário ocupado', 'anon', null, format(
  $c$select public.remarcar_agendamento(%s, %L, %L, 1)$c$,
  pg_temp.lido('ag2')::jsonb ->> 'id', pg_temp.lido('ag2')::jsonb ->> 'codigo', pg_temp.momento(3, '09:00')), 'horario_ocupado');
select pg_temp.guarde('remarcado', pg_temp.aceita('remarcar da Ana para o Roberto com o código', 'anon', null, format(
  $c$select public.remarcar_agendamento(%s, %L, %L, 1)$c$,
  pg_temp.lido('ag2')::jsonb ->> 'id', pg_temp.lido('ag2')::jsonb ->> 'codigo', pg_temp.momento(3, '10:00'))));
select pg_temp.confere('remarcar com outro profissional recalcula o preço (R$ 50 → R$ 45)',
  (pg_temp.lido('remarcado')::jsonb ->> 'valor_total')::numeric = 45
  and (pg_temp.lido('remarcado')::jsonb #>> '{servicos,0,preco}')::numeric = 45);
select pg_temp.aceita('cancelar com o código certo', 'anon', null, format(
  $c$select public.cancelar_agendamento(%s, %L)$c$,
  pg_temp.lido('ag1')::jsonb ->> 'id', pg_temp.lido('ag1')::jsonb ->> 'codigo'));
select pg_temp.confere('agendamento ficou cancelado',
  (select status = 'cancelado' from public.agendamentos where id = (pg_temp.lido('ag1')::jsonb ->> 'id')::bigint));

select pg_temp.recusa('visitante não chama ' || f, 'anon', null, c, 'permission denied')
from (values
  ('privado.meu_salao', $c$select to_jsonb(privado.meu_salao())$c$),
  ('privado.calcular_itens', $c$select to_jsonb(count(*)) from privado.calcular_itens(null, 1, '[]')$c$),
  ('salao_criar_agendamento', $c$select to_jsonb(public.salao_criar_agendamento('[{"servico_id": 1}]', 1, now() + interval '3 days', 1))$c$),
  ('mudar_status_agendamento', $c$select to_jsonb(public.mudar_status_agendamento(9, 'cancelado'))$c$),
  ('remover_dados_do_cliente', $c$select to_jsonb(public.remover_dados_do_cliente(8))$c$)
) as x (f, c);




select pg_temp.confere('--- PROFISSIONAL (Ana)', true);

select pg_temp.igual('Ana não vê agendamento do colega com cliente que não é dela (Bruno com Roberto)',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(count(*)) from public.agendamentos where id in (8, 16)$c$, '0');
select pg_temp.igual('Ana não vê o cliente que nunca atendeu (Bruno)',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(count(*)) from public.clientes where id = 8$c$, '0');
select pg_temp.igual('Ana vê a ficha inteira da Mariana, inclusive o agendamento com o Roberto',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(count(*)) from public.agendamentos where cliente_id = 1$c$, pg_temp.lido('agendamentos_da_mariana')::jsonb);
select pg_temp.igual('Ana vê o agendamento 10 (Mariana com o Roberto) e os itens dele',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(count(*)) from public.agendamento_servicos where agendamento_id = 10$c$, '1');
select pg_temp.igual('Ana lê as observações de quem ela atende (Patrícia)',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(observacoes) from public.clientes where id = 3$c$, '"Coloração 6.0 com 20 volumes."');
select pg_temp.igual('Ana não vê horários de trabalho do Roberto',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(count(*)) from public.horarios_trabalho where profissional_id = 1$c$, '0');
select pg_temp.igual('Ana não vê bloqueios do Roberto',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(count(*)) from public.bloqueios where profissional_id = 1$c$, '0');
select pg_temp.igual('Ana vê os próprios bloqueios',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(count(*) > 0) from public.bloqueios where profissional_id = 2$c$, 'true');
select pg_temp.igual('Ana não vê nada do outro salão',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb((select count(*) from public.clientes where salao_id = '00000000-0000-4000-8000-000000000002')
    + (select count(*) from public.servicos where salao_id = '00000000-0000-4000-8000-000000000002'))$c$, '0');

select pg_temp.guarde('cliente_da_ana', pg_temp.aceita('Ana cadastra uma cliente nova',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$with novo as (
    insert into public.clientes (salao_id, nome, telefone, observacoes)
    values ('00000000-0000-4000-8000-000000000001', 'Cliente da Ana', '00900000050', 'Cabelo fino.')
    returning id
  ) select to_jsonb(id) from novo$c$));
select pg_temp.confere('o banco marca a Ana como quem cadastrou',
  (select criado_por_profissional_id = 2 from public.clientes where id = pg_temp.lido('cliente_da_ana')::bigint));
select pg_temp.recusa('Ana não escolhe quem cadastrou',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$insert into public.clientes (salao_id, nome, telefone, criado_por_profissional_id)
     values ('00000000-0000-4000-8000-000000000001', 'Outra', '00900000051', 1)$c$, 'permission denied');
select pg_temp.recusa('Ana não cadastra cliente no outro salão',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$insert into public.clientes (salao_id, nome, telefone) values ('00000000-0000-4000-8000-000000000002', 'Outra', '00900000052')$c$,
  'row-level security');
select pg_temp.igual('Ana altera observação de quem ela atende',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$with u as (update public.clientes set observacoes = 'Coloração 6.0.' where id = 3 returning 1) select to_jsonb(count(*)) from u$c$, '1');
select pg_temp.igual('Ana não altera cliente que não pode ver (Bruno)',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$with u as (update public.clientes set nome = 'Trocado' where id = 8 returning 1) select to_jsonb(count(*)) from u$c$, '0');
select pg_temp.recusa('Ana não apaga cliente direto',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$delete from public.clientes where id = 3$c$, 'permission denied');

select pg_temp.recusa('Ana não cria agendamento para o colega',
  'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$select to_jsonb(public.salao_criar_agendamento('[{"servico_id": 1}]', 1, %L, 3))$c$, pg_temp.momento(3, '14:00')), 'sem_permissao');
select pg_temp.recusa('Ana não agenda cliente que não pode ver (Bruno)',
  'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$select to_jsonb(public.salao_criar_agendamento('[{"servico_id": 1}]', 2, %L, 8))$c$, pg_temp.momento(3, '14:00')), 'cliente_nao_encontrado');
select pg_temp.guarde('ag_ana', pg_temp.aceita('Ana cria agendamento para ela mesma',
  'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$select to_jsonb(public.salao_criar_agendamento('[{"servico_id": 1}]', 2, %L, 3))$c$, pg_temp.momento(3, '14:00'))));
select pg_temp.confere('agendamento pelo salão usa o preço próprio da Ana (R$ 50)',
  (select valor_total = 50 from public.agendamentos where id = pg_temp.lido('ag_ana')::bigint));
select pg_temp.recusa('Ana não muda status de agendamento do colega (10)',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(public.mudar_status_agendamento(10, 'faltou'))$c$, 'nao_encontrado');
select pg_temp.aceita('Ana conclui o próprio atendimento (12) com valor e forma',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(public.mudar_status_agendamento(12, 'concluido', 50, 'pix'))$c$);
select pg_temp.recusa('concluir sem forma recebida',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(public.mudar_status_agendamento(14, 'concluido', 90))$c$, 'recebimento_invalido');
select pg_temp.recusa('cancelado não volta para agendado',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(public.mudar_status_agendamento(13, 'agendado'))$c$, 'mudanca_invalida');
select pg_temp.recusa('Ana não remove dados de cliente',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(public.remover_dados_do_cliente(4))$c$, 'sem_permissao');
select pg_temp.recusa('Ana não escreve direto em agendamentos',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$update public.agendamentos set valor_total = 1 where id = 12$c$, 'permission denied');

select pg_temp.igual('Ana não altera preço de serviço',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$with u as (update public.servicos set preco = 1 where id = 1 returning 1) select to_jsonb(count(*)) from u$c$, '0');
select pg_temp.igual('Ana não altera o próprio preço',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$with u as (update public.profissional_servicos set preco = 1 where profissional_id = 2 returning 1) select to_jsonb(count(*)) from u$c$, '0');
select pg_temp.recusa('Ana não cria serviço',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$insert into public.servicos (salao_id, categoria_id, nome, duracao_min, preco) values ('00000000-0000-4000-8000-000000000001', 1, 'Novo', 30, 10)$c$,
  'row-level security');
select pg_temp.igual('Ana não altera as configurações do salão',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$with u as (update public.salao set pix_ativo = true returning 1) select to_jsonb(count(*)) from u$c$, '0');
select pg_temp.igual('Ana não vira dona',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$with u as (update public.profissionais set papel = 'dono' where id = 2 returning 1) select to_jsonb(count(*)) from u$c$, '0');
select pg_temp.recusa('Ana não troca o user_id de ninguém',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$update public.profissionais set user_id = null where id = 2$c$, 'permission denied');
select pg_temp.recusa('Ana não cria horário para o Roberto',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$insert into public.horarios_trabalho (salao_id, profissional_id, dia_semana, inicio, fim) values ('00000000-0000-4000-8000-000000000001', 1, 0, '10:00', '12:00')$c$,
  'row-level security');
select pg_temp.aceita('Ana cria o próprio horário (domingo 10–12)',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$insert into public.horarios_trabalho (salao_id, profissional_id, dia_semana, inicio, fim) values ('00000000-0000-4000-8000-000000000001', 2, 0, '10:00', '12:00')$c$);
select pg_temp.aceita('Ana cria o próprio bloqueio',
  'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$insert into public.bloqueios (salao_id, profissional_id, inicio, fim, motivo) values ('00000000-0000-4000-8000-000000000001', 2, %L, %L, 'Dentista')$c$,
  pg_temp.momento(7, '09:00'), pg_temp.momento(7, '10:00')));
select pg_temp.recusa('Ana não cria bloqueio para o Roberto',
  'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$insert into public.bloqueios (salao_id, profissional_id, inicio, fim, motivo) values ('00000000-0000-4000-8000-000000000001', 1, %L, %L, 'Teste')$c$,
  pg_temp.momento(7, '09:00'), pg_temp.momento(7, '10:00')), 'row-level security');


select pg_temp.confere('--- OUTROS LOGINS', true);

select pg_temp.igual('profissional desativado (Carla) não vê nada',
  'authenticated', 'a0000000-0000-4000-8000-000000000003',
  $c$select to_jsonb((select count(*) from public.agendamentos) + (select count(*) from public.clientes)
    + (select count(*) from public.servicos) + (select count(*) from public.salao))$c$, '0');
select pg_temp.recusa('profissional desativado não agenda pelo salão',
  'authenticated', 'a0000000-0000-4000-8000-000000000003', format(
  $c$select to_jsonb(public.salao_criar_agendamento('[{"servico_id": 1}]', 2, %L, 1))$c$, pg_temp.momento(3, '17:00')), 'sem_permissao');
select pg_temp.igual('usuário logado que não é profissional não vê nada',
  'authenticated', 'a0000000-0000-4000-8000-000000000004',
  $c$select to_jsonb((select count(*) from public.agendamentos) + (select count(*) from public.clientes)
    + (select count(*) from public.profissionais) + (select count(*) from public.salao))$c$, '0');
select pg_temp.aceita('usuário logado que não é profissional abre a vitrine',
  'authenticated', 'a0000000-0000-4000-8000-000000000004',
  $c$select public.vitrine('salao-exemplo')$c$);
select pg_temp.igual('dono do outro salão não vê o Salão Exemplo',
  'authenticated', 'a0000000-0000-4000-8000-000000000005',
  $c$select to_jsonb((select count(*) from public.agendamentos where salao_id = '00000000-0000-4000-8000-000000000001')
    + (select count(*) from public.clientes where salao_id = '00000000-0000-4000-8000-000000000001'))$c$, '0');
select pg_temp.igual('dono do outro salão vê o próprio cliente',
  'authenticated', 'a0000000-0000-4000-8000-000000000005',
  $c$select to_jsonb(count(*)) from public.clientes$c$, '1');
select pg_temp.recusa('dono do outro salão não muda status no Salão Exemplo',
  'authenticated', 'a0000000-0000-4000-8000-000000000005',
  $c$select to_jsonb(public.mudar_status_agendamento(9, 'cancelado'))$c$, 'nao_encontrado');


select pg_temp.confere('--- DONO (Roberto)', true);

select pg_temp.igual('dono vê todos os agendamentos do salão',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(count(*)) from public.agendamentos$c$,
  (select to_jsonb(count(*)) from public.agendamentos where salao_id = '00000000-0000-4000-8000-000000000001'));
select pg_temp.recusa('dono não lê o hash do código secreto (agendamentos.codigo_hash)',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(count(codigo_hash)) from public.agendamentos$c$, 'permission denied');
select pg_temp.recusa('Ana não lê o hash do código secreto',
  'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select to_jsonb(count(codigo_hash)) from public.agendamentos$c$, 'permission denied');
select pg_temp.igual('dono lê as outras colunas dos agendamentos',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(count(*)) from (select id, salao_id, cliente_id, profissional_id, inicio, fim, status, valor_total,
    forma_pagamento, pago, forma_recebida, observacoes, criado_em from public.agendamentos where id = 9) x$c$, '1');
select pg_temp.igual('dono vê todos os clientes do salão',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(count(*)) from public.clientes$c$,
  (select to_jsonb(count(*)) from public.clientes where salao_id = '00000000-0000-4000-8000-000000000001'));
select pg_temp.igual('dono vê a cliente que a Ana cadastrou',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$select to_jsonb(nome) from public.clientes where id = %s$c$, pg_temp.lido('cliente_da_ana')), '"Cliente da Ana"');
select pg_temp.igual('dono lê as observações',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(observacoes) from public.clientes where id = 7$c$, '"Alergia a amônia."');
select pg_temp.igual('dono vê horários de todos',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(count(distinct profissional_id)) from public.horarios_trabalho$c$, '2');
select pg_temp.igual('dono altera preço',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$with u as (update public.servicos set preco = 48 where id = 1 returning 1) select to_jsonb(count(*)) from u$c$, '1');
select pg_temp.aceita('dono cria serviço',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$insert into public.servicos (salao_id, categoria_id, nome, duracao_min, preco) values ('00000000-0000-4000-8000-000000000001', 1, 'Serviço novo', 30, 10)$c$);
select pg_temp.recusa('dono não cria serviço no outro salão',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$insert into public.servicos (salao_id, categoria_id, nome, duracao_min, preco) values ('00000000-0000-4000-8000-000000000002', %s, 'Intruso', 30, 10)$c$,
    (select id from public.categorias where salao_id = '00000000-0000-4000-8000-000000000002')), 'row-level security');
select pg_temp.aceita('dono cria horário para a Ana',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$insert into public.horarios_trabalho (salao_id, profissional_id, dia_semana, inicio, fim) values ('00000000-0000-4000-8000-000000000001', 2, 1, '09:00', '12:00')$c$);
select pg_temp.aceita('dono cria agendamento para a Ana',
  'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$select to_jsonb(public.salao_criar_agendamento('[{"servico_id": 1}]', 2, %L, 1))$c$, pg_temp.momento(3, '15:00')));
select pg_temp.aceita('dono conclui atendimento da Ana (14)',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(public.mudar_status_agendamento(14, 'concluido', 90, 'dinheiro'))$c$);
select pg_temp.aceita('dono altera configuração do salão',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.salao set descricao = 'Nova descrição.'$c$);
select pg_temp.aceita('dono desativa a Ana',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.profissionais set ativo = false where id = 2$c$);
update public.profissionais set ativo = true where id = 2;
select pg_temp.recusa('dono não deixa o salão sem dono',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.profissionais set papel = 'profissional' where id = 1$c$, 'ultimo_dono');
select pg_temp.recusa('dono não troca user_id pela API',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$update public.profissionais set user_id = null where id = 2$c$, 'permission denied');
select pg_temp.recusa('remover dados com agendamento futuro (Bruno)',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(public.remover_dados_do_cliente(8))$c$, 'tem_agendamento_futuro');
select pg_temp.igual('remover dados de quem só tem histórico (Fernanda) anonimiza',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(public.remover_dados_do_cliente(6))$c$, '"anonimizado"');
select pg_temp.confere('Fernanda virou "Cliente removido" sem celular nem observações',
  (select nome = 'Cliente removido' and telefone is null and observacoes is null from public.clientes where id = 6));
select pg_temp.igual('remover dados de quem nunca agendou apaga o cadastro',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$select to_jsonb(public.remover_dados_do_cliente(%s))$c$, pg_temp.lido('cliente_da_ana')), '"apagado"');
select pg_temp.recusa('dono não remove cliente do outro salão',
  'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$select to_jsonb(public.remover_dados_do_cliente(%s))$c$,
    (select id from public.clientes where salao_id = '00000000-0000-4000-8000-000000000002')), 'cliente_nao_encontrado');


select pg_temp.confere('--- PERMISSÕES', true);

select pg_temp.confere('anon não tem permissão em nenhuma tabela',
  (select bool_and(not has_table_privilege('anon', c.oid, 'select, insert, update, delete'))
   from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'));
select pg_temp.confere('anon executa só as 7 funções do cliente',
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'privado'::regnamespace) and has_function_privilege('anon', p.oid, 'execute'))
  = 'cancelar_agendamento,criar_agendamento,dias_abertos,horarios_livres,meus_agendamentos,remarcar_agendamento,vitrine');
select pg_temp.confere('authenticated executa só as funções liberadas',
  (select string_agg(nome, ',' order by nome) from (
     select p.pronamespace::regnamespace || '.' || p.proname as nome from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'privado'::regnamespace) and has_function_privilege('authenticated', p.oid, 'execute')
       and p.proname not in ('salvar_servico', 'apagar_servico', 'trocar_ordem_servico', 'salvar_horarios_do_profissional', 'salvar_horarios_especiais')
   ) x)
  = 'privado.atendi_cliente,privado.meu_profissional,privado.meu_salao,privado.sou_dono,privado.vejo_cliente,public.cancelar_agendamento,public.conferir_encaixe,public.criar_agendamento,public.dias_abertos,public.horarios_livres,public.meus_agendamentos,public.mudar_status_agendamento,public.remarcar_agendamento,public.remover_dados_do_cliente,public.salao_criar_agendamento,public.salao_dias_abertos,public.salao_horarios_livres,public.vitrine');
select pg_temp.confere('nenhuma função liberada para public',
  (select bool_and(p.proacl is not null and not exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0))
   from pg_proc p where p.pronamespace in ('public'::regnamespace, 'privado'::regnamespace)));
select pg_temp.confere('as 24 funções security definer do Marca Aí com search_path vazio',
  (select bool_and(p.proconfig = array['search_path=""']) and count(*) = 24 from pg_proc p
   where p.prosecdef and (
     (p.pronamespace = 'privado'::regnamespace and p.proname <> 'avisar_mudanca')
     or (p.pronamespace = 'public'::regnamespace and p.proname in (
       'vitrine', 'criar_agendamento', 'meus_agendamentos', 'cancelar_agendamento', 'remarcar_agendamento',
       'salao_criar_agendamento', 'mudar_status_agendamento', 'remover_dados_do_cliente',
       'horarios_livres', 'dias_abertos', 'salao_horarios_livres', 'salao_dias_abertos', 'conferir_encaixe'
     ))
   )));
select pg_temp.confere('pgcrypto e btree_gist no esquema extensions',
  (select bool_and(e.extnamespace = 'extensions'::regnamespace) and count(*) = 2
   from pg_extension e where e.extname in ('pgcrypto', 'btree_gist')));
select pg_temp.confere('RLS ativado nas 12 tabelas',
  (select count(*) from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity
     and c.relname in ('salao', 'profissionais', 'categorias', 'servicos', 'servico_variacoes', 'profissional_servicos',
       'profissional_variacoes', 'horarios_trabalho', 'bloqueios', 'clientes', 'agendamentos', 'agendamento_servicos')) = 12);


select resultado from (
  select n, resultado from pg_temp.resultados
  union all
  select 100000, 'TOTAL: ' || count(*) filter (where resultado like 'OK %' and resultado not like '%---%')
    || ' OK, ' || count(*) filter (where resultado like 'FALHOU%') || ' FALHOU'
  from pg_temp.resultados
) x order by n;

rollback;
