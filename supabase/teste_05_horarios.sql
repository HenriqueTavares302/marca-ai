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
  ('a0000000-0000-4000-8000-000000000002', 'ana@exemplo.com');
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000001' where id = 1;
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000002' where id = 2;

update public.profissional_servicos set preco = 50 where profissional_id = 2 and servico_id = 1;

insert into public.agendamentos (salao_id, cliente_id, profissional_id, inicio, fim, status) values
  ('00000000-0000-4000-8000-000000000001', 4, 1, pg_temp.momento(3, '10:00'), pg_temp.momento(3, '10:30'), 'cancelado'),
  ('00000000-0000-4000-8000-000000000001', 4, 1, pg_temp.momento(3, '11:00'), pg_temp.momento(3, '11:30'), 'agendado');
insert into public.bloqueios (salao_id, profissional_id, inicio, fim, motivo) values
  ('00000000-0000-4000-8000-000000000001', 1, pg_temp.momento(3, '15:00'), pg_temp.momento(3, '16:00'), 'Curso de corte'),
  ('00000000-0000-4000-8000-000000000001', 2, pg_temp.momento(4, '00:00'), pg_temp.momento(4, '00:00') + interval '1 day', 'Médico');

select pg_temp.guarde('segunda', to_jsonb(min(d)::text))
from generate_series(current_date + 2, current_date + 9, interval '1 day') d where extract(dow from d) = 1;
insert into public.agendamentos (salao_id, cliente_id, profissional_id, inicio, fim)
select '00000000-0000-4000-8000-000000000001', 8, 1,
  ((pg_temp.lido('segunda')::date + time '09:00') at time zone 'America/Sao_Paulo'),
  ((pg_temp.lido('segunda')::date + time '12:00') at time zone 'America/Sao_Paulo');

create function pg_temp.horas(p_resultado jsonb) returns text[]
language sql as $$
  select coalesce(array_agg(h ->> 'hora' order by h ->> 'hora'), '{}') from jsonb_array_elements(p_resultado -> 'horarios') h
$$;


select pg_temp.confere('--- VISITANTE: horários livres', true);

select pg_temp.guarde('roberto_d3', pg_temp.aceita('visitante lista horários do Roberto (corte, 30 min)', 'anon', null, format(
  $c$select public.horarios_livres('salao-exemplo', '[{"servico_id": 1}]', 1, %L)$c$, pg_temp.dia_de_trabalho(3))));
select pg_temp.confere('cada horário só tem inicio, hora, profissional, valor_total e tem_valor_a_combinar',
  (select bool_and((select array_agg(k order by k) from jsonb_object_keys(h) k) = array['hora', 'inicio', 'profissional', 'tem_valor_a_combinar', 'valor_total'])
   from jsonb_array_elements(pg_temp.lido('roberto_d3')::jsonb -> 'horarios') h));
select pg_temp.confere('nunca aparece motivo de bloqueio, cliente ou outro agendamento',
  pg_temp.lido('roberto_d3') not like '%Curso%' and pg_temp.lido('roberto_d3') not like '%Rafael%'
  and pg_temp.lido('roberto_d3') not like '%motivo%' and pg_temp.lido('roberto_d3') not like '%cliente%'
  and pg_temp.lido('roberto_d3') not like '%status%');
select pg_temp.confere('grade de 30 em 30 desde o início do expediente',
  (pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb))[1] = '09:00'
  and (select bool_and(right(x, 2) in ('00', '30')) from unnest(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb)) x));
select pg_temp.confere('cancelado libera o horário (10:00)', '10:00' = any(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb)));
select pg_temp.confere('agendado ocupa o horário (11:00)', not '11:00' = any(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb)));
select pg_temp.confere('almoço: 11:30 sim, 12:00 e 12:30 não, 13:00 sim',
  '11:30' = any(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb)) and not '12:00' = any(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb))
  and not '12:30' = any(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb)) and '13:00' = any(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb)));
select pg_temp.confere('bloqueio de período tira 15:00 e 15:30, mantém 16:00',
  not '15:00' = any(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb)) and not '15:30' = any(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb))
  and '16:00' = any(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb)));
select pg_temp.confere('último horário de 30 min é 18:30 (fecha às 19:00)', (pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb))[array_length(pg_temp.horas(pg_temp.lido('roberto_d3')::jsonb), 1)] = '18:30');
select pg_temp.confere('preço do Roberto: R$ 45', (pg_temp.lido('roberto_d3')::jsonb #>> '{horarios,0,valor_total}')::numeric = 45);

select pg_temp.guarde('longo_d3', pg_temp.aceita('serviço de 60 min', 'anon', null, format(
  $c$select public.horarios_livres('salao-exemplo', '[{"servico_id": 2}]', 1, %L)$c$, pg_temp.dia_de_trabalho(3))));
select pg_temp.confere('60 min: 10:30 não cabe (bate às 11:00), 11:00 ocupado, 14:30 bate no bloqueio, último é 18:00',
  not '10:30' = any(pg_temp.horas(pg_temp.lido('longo_d3')::jsonb)) and not '14:30' = any(pg_temp.horas(pg_temp.lido('longo_d3')::jsonb))
  and (pg_temp.horas(pg_temp.lido('longo_d3')::jsonb))[array_length(pg_temp.horas(pg_temp.lido('longo_d3')::jsonb), 1)] = '18:00'
  and (pg_temp.lido('longo_d3')::jsonb ->> 'duracao_min')::int = 60);

select pg_temp.guarde('qualquer_d3', pg_temp.aceita('"qualquer profissional"', 'anon', null, format(
  $c$select public.horarios_livres('salao-exemplo', '[{"servico_id": 1}]', null, %L)$c$, pg_temp.dia_de_trabalho(3))));
select pg_temp.confere('"qualquer": às 09:00 vai o Roberto (primeiro), às 11:00 a Ana com o preço dela (R$ 50)',
  (select (h #>> '{profissional,id}')::int = 1 and (h ->> 'valor_total')::numeric = 45 from jsonb_array_elements(pg_temp.lido('qualquer_d3')::jsonb -> 'horarios') h where h ->> 'hora' = '09:00')
  and (select (h #>> '{profissional,id}')::int = 2 and (h ->> 'valor_total')::numeric = 50 and h #>> '{profissional,nome}' = 'Ana Souza'
       from jsonb_array_elements(pg_temp.lido('qualquer_d3')::jsonb -> 'horarios') h where h ->> 'hora' = '11:00'));
select pg_temp.confere('"qualquer" sem 12:00 (os dois estão no almoço)', not '12:00' = any(pg_temp.horas(pg_temp.lido('qualquer_d3')::jsonb)));

select pg_temp.guarde('mechas', pg_temp.aceita('serviço sob consulta', 'anon', null, format(
  $c$select public.horarios_livres('salao-exemplo', '[{"servico_id": 5}]', null, %L)$c$, pg_temp.dia_de_trabalho(3))));
select pg_temp.confere('sob consulta: tem_valor_a_combinar e só o Roberto (a Ana não faz mechas)',
  (select bool_and((h ->> 'tem_valor_a_combinar')::boolean and (h #>> '{profissional,id}')::int = 1)
   from jsonb_array_elements(pg_temp.lido('mechas')::jsonb -> 'horarios') h));

select pg_temp.igual('Ana com bloqueio de dia inteiro: nenhum horário', 'anon', null, format(
  $c$select to_jsonb(jsonb_array_length(public.horarios_livres('salao-exemplo', '[{"servico_id": 1}]', 2, %L) -> 'horarios'))$c$,
  pg_temp.dia_de_trabalho(4)), '0');
select pg_temp.recusa('profissional que não faz o serviço é recusado', 'anon', null, format(
  $c$select public.horarios_livres('salao-exemplo', '[{"servico_id": 4, "variacao_id": 1}]', 2, %L)$c$, pg_temp.dia_de_trabalho(3)),
  'profissional_nao_faz_o_servico');
select pg_temp.recusa('serviço inexistente é recusado', 'anon', null, format(
  $c$select public.horarios_livres('salao-exemplo', '[{"servico_id": 999}]', null, %L)$c$, pg_temp.dia_de_trabalho(3)), 'servicos_invalidos');
select pg_temp.igual('dia que já passou: nenhum horário', 'anon', null,
  $c$select to_jsonb(jsonb_array_length(public.horarios_livres('salao-exemplo', '[{"servico_id": 1}]', null, current_date - 1) -> 'horarios'))$c$, '0');
select pg_temp.igual('depois de 90 dias: nenhum horário', 'anon', null,
  $c$select to_jsonb(jsonb_array_length(public.horarios_livres('salao-exemplo', '[{"servico_id": 1}]', null, current_date + 92) -> 'horarios'))$c$, '0');
select pg_temp.confere('hoje: nenhum horário antes da antecedência mínima',
  coalesce((select bool_and((h ->> 'inicio')::timestamptz >= now() + interval '60 minutes')
   from jsonb_array_elements((pg_temp.rodar('anon', null, $c$select public.horarios_livres('salao-exemplo', '[{"servico_id": 1}]', null, (now() at time zone 'America/Sao_Paulo')::date)$c$) -> 'resultado') -> 'horarios') h), true));

select pg_temp.guarde('primeiro_livre', (pg_temp.lido('qualquer_d3')::jsonb -> 'horarios' -> 0));
select pg_temp.aceita('o primeiro horário listado pode ser agendado', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', %s, %L, 'Pessoa Teste', '00900000070')$c$,
  pg_temp.lido('primeiro_livre')::jsonb #>> '{profissional,id}', pg_temp.lido('primeiro_livre')::jsonb ->> 'inicio'));
select pg_temp.confere('depois de agendado, o horário some da lista',
  not exists (select 1 from jsonb_array_elements((pg_temp.rodar('anon', null, format(
    $c$select public.horarios_livres('salao-exemplo', '[{"servico_id": 1}]', %s, %L)$c$,
    pg_temp.lido('primeiro_livre')::jsonb #>> '{profissional,id}', pg_temp.dia_de_trabalho(3))) -> 'resultado') -> 'horarios') h
    where h ->> 'inicio' = pg_temp.lido('primeiro_livre')::jsonb ->> 'inicio'));
select pg_temp.recusa('horário que não aparece (12:00, almoço) é recusado ao agendar', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Pessoa Teste', '00900000071')$c$,
  pg_temp.momento(3, '12:00')), 'fora_do_expediente');

select pg_temp.guarde('para_remarcar', pg_temp.aceita('agenda às 16:00 para testar a remarcação', 'anon', null, format(
  $c$select public.criar_agendamento('salao-exemplo', '[{"servico_id": 1}]', 1, %L, 'Pessoa Teste', '00900000072')$c$,
  pg_temp.momento(3, '16:00'))));
select pg_temp.confere('sem o código, 16:00 aparece ocupado',
  not '16:00' = any(pg_temp.horas(pg_temp.rodar('anon', null, format(
    $c$select public.horarios_livres('salao-exemplo', '[{"servico_id": 1}]', 1, %L)$c$, pg_temp.dia_de_trabalho(3))) -> 'resultado')));
select pg_temp.confere('remarcando com o código, o próprio horário (16:00) aparece livre',
  '16:00' = any(pg_temp.horas(pg_temp.rodar('anon', null, format(
    $c$select public.horarios_livres('salao-exemplo', null, 1, %L, %s, %L)$c$, pg_temp.dia_de_trabalho(3),
    pg_temp.lido('para_remarcar')::jsonb ->> 'id', pg_temp.lido('para_remarcar')::jsonb ->> 'codigo')) -> 'resultado')));
select pg_temp.recusa('remarcar com código errado é recusado', 'anon', null, format(
  $c$select public.horarios_livres('salao-exemplo', null, 1, %L, %s, 'codigo-errado')$c$, pg_temp.dia_de_trabalho(3),
  pg_temp.lido('para_remarcar')::jsonb ->> 'id'), 'nao_encontrado');


select pg_temp.confere('--- VISITANTE: dias abertos', true);

select pg_temp.guarde('dias', pg_temp.aceita('visitante lista 21 dias', 'anon', null,
  $c$select public.dias_abertos('salao-exemplo', '[{"servico_id": 1}]', null, current_date, current_date + 20)$c$));
select pg_temp.confere('vem um item por dia, só com data, aberto e tem_horario_livre',
  jsonb_array_length(pg_temp.lido('dias')::jsonb) = 21
  and (select bool_and((select array_agg(k order by k) from jsonb_object_keys(d) k) = array['aberto', 'data', 'tem_horario_livre'])
       from jsonb_array_elements(pg_temp.lido('dias')::jsonb) d));
select pg_temp.confere('domingo fechado, terça a sábado abertos',
  (select bool_and(case when extract(dow from (d ->> 'data')::date) = 0 then not (d ->> 'aberto')::boolean
                        when extract(dow from (d ->> 'data')::date) between 2 and 6 and (d ->> 'data')::date > current_date then (d ->> 'aberto')::boolean
                        else true end)
   from jsonb_array_elements(pg_temp.lido('dias')::jsonb) d));
select pg_temp.igual('dia inteiro bloqueado da Ana: fechado só para ela', 'anon', null, format(
  $c$select jsonb_build_array(
     (public.dias_abertos('salao-exemplo', '[{"servico_id": 1}]', 2, %1$L, %1$L) -> 0 -> 'aberto'),
     (public.dias_abertos('salao-exemplo', '[{"servico_id": 1}]', null, %1$L, %1$L) -> 0 -> 'aberto'))$c$,
  pg_temp.dia_de_trabalho(4)), '[false, true]');
select pg_temp.igual('segunda: só o Roberto trabalha (Ana fechada)', 'anon', null, format(
  $c$select jsonb_build_array(
     (public.dias_abertos('salao-exemplo', '[{"servico_id": 1}]', 2, %1$L, %1$L) -> 0 -> 'aberto'),
     (public.dias_abertos('salao-exemplo', '[{"servico_id": 1}]', 1, %1$L, %1$L) -> 0 -> 'aberto'))$c$,
  pg_temp.lido('segunda')), '[false, true]');
select pg_temp.igual('segunda lotada do Roberto: aberto, mas sem horário livre ("Lotado")', 'anon', null, format(
  $c$select (public.dias_abertos('salao-exemplo', '[{"servico_id": 1}]', 1, %1$L, %1$L) -> 0) - 'data'$c$,
  pg_temp.lido('segunda')), '{"aberto": true, "tem_horario_livre": false}');
select pg_temp.confere('depois de 90 dias, fechado',
  (select bool_and(not (d ->> 'aberto')::boolean) from jsonb_array_elements((pg_temp.rodar('anon', null,
    $c$select public.dias_abertos('salao-exemplo', '[{"servico_id": 1}]', null, current_date + 91, current_date + 100)$c$) -> 'resultado')) d));
select pg_temp.recusa('período maior que 31 dias é recusado', 'anon', null,
  $c$select public.dias_abertos('salao-exemplo', '[{"servico_id": 1}]', null, current_date, current_date + 31)$c$, 'periodo_invalido');


select pg_temp.confere('--- SALÃO', true);

select pg_temp.recusa('visitante não chama salao_horarios_livres', 'anon', null,
  $c$select public.salao_horarios_livres('[{"servico_id": 1}]', 1, current_date + 3)$c$, 'permission denied');
select pg_temp.recusa('visitante não chama conferir_encaixe', 'anon', null,
  $c$select public.conferir_encaixe(1, now() + interval '1 day', 30)$c$, 'permission denied');
select pg_temp.recusa('Ana não lista horários do Roberto', 'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$select public.salao_horarios_livres('[{"servico_id": 1}]', 1, %L)$c$, pg_temp.dia_de_trabalho(3)), 'sem_permissao');
select pg_temp.recusa('Ana não usa "qualquer profissional"', 'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$select public.salao_horarios_livres('[{"servico_id": 1}]', null, %L)$c$, pg_temp.dia_de_trabalho(3)), 'sem_permissao');
select pg_temp.aceita('Ana lista os próprios horários', 'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$select public.salao_horarios_livres('[{"servico_id": 1}]', 2, %L)$c$, pg_temp.dia_de_trabalho(3)));
select pg_temp.aceita('dono lista "qualquer profissional"', 'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$select public.salao_horarios_livres('[{"servico_id": 1}]', null, %L)$c$, pg_temp.dia_de_trabalho(3)));
select pg_temp.confere('salão vê horários além dos 90 dias (até 1 ano)',
  jsonb_array_length((pg_temp.rodar('authenticated', 'a0000000-0000-4000-8000-000000000001',
    $c$select public.salao_horarios_livres('[{"servico_id": 1}]', 1, (select min(d)::date from generate_series(current_date + 120, current_date + 127, interval '1 day') d where extract(dow from d) = 3))$c$) -> 'resultado') -> 'horarios') > 0);
select pg_temp.igual('salão: depois de 1 ano, nada', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select to_jsonb(jsonb_array_length(public.salao_horarios_livres('[{"servico_id": 1}]', 1, current_date + 370) -> 'horarios'))$c$, '0');
select pg_temp.confere('salão: hoje sem a antecedência mínima, mas sem horário que já passou',
  coalesce((select bool_and((h ->> 'inicio')::timestamptz >= now())
   from jsonb_array_elements((pg_temp.rodar('authenticated', 'a0000000-0000-4000-8000-000000000001',
     $c$select public.salao_horarios_livres('[{"servico_id": 1}]', null, (now() at time zone 'America/Sao_Paulo')::date)$c$) -> 'resultado') -> 'horarios') h), true));
select pg_temp.aceita('dono lista dias abertos', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salao_dias_abertos('[{"servico_id": 1}]', null, current_date, current_date + 30)$c$);
select pg_temp.recusa('Ana não lista dias do Roberto', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select public.salao_dias_abertos('[{"servico_id": 1}]', 1, current_date, current_date + 6)$c$, 'sem_permissao');

select pg_temp.recusa('Ana não confere encaixe na agenda do Roberto', 'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$select public.conferir_encaixe(1, %L, 30)$c$, pg_temp.momento(3, '11:00')), 'sem_permissao');
select pg_temp.igual('encaixe em cima de atendimento: conflito com o nome do cliente', 'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$select public.conferir_encaixe(1, %L, 30) #- '{conflito,inicio}' #- '{conflito,fim}'$c$, pg_temp.momento(3, '11:15')),
  '{"erro": "conflito", "conflito": {"nome": "Rafael Oliveira", "tipo": "atendimento"}}');
select pg_temp.igual('encaixe em cima de bloqueio: conflito com o motivo', 'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$select public.conferir_encaixe(1, %L, 30) #- '{conflito,inicio}' #- '{conflito,fim}'$c$, pg_temp.momento(3, '15:10')),
  '{"erro": "conflito", "conflito": {"nome": "Curso de corte", "tipo": "bloqueio"}}');
select pg_temp.igual('encaixe às 20:00: livre, fora do expediente', 'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$select public.conferir_encaixe(1, %L, 30)$c$, pg_temp.momento(3, '20:00')), '{"livre": true, "fora_do_expediente": true}');
select pg_temp.igual('encaixe às 13:10 (fora da grade, dentro do expediente): livre, no expediente', 'authenticated', 'a0000000-0000-4000-8000-000000000001', format(
  $c$select public.conferir_encaixe(1, %L, 30)$c$, pg_temp.momento(3, '13:10')), '{"livre": true, "fora_do_expediente": false}');
select pg_temp.igual('encaixe no passado: ja_passou', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.conferir_encaixe(1, now() - interval '2 hours', 30)$c$, '{"erro": "ja_passou"}');
select pg_temp.aceita('Ana confere encaixe na própria agenda', 'authenticated', 'a0000000-0000-4000-8000-000000000002', format(
  $c$select public.conferir_encaixe(2, %L, 30)$c$, pg_temp.momento(3, '09:00')));


select pg_temp.confere('--- PERMISSÕES', true);

select pg_temp.confere('anon executa só as 7 funções do cliente',
  (select string_agg(p.proname, ',' order by p.proname) from pg_proc p
   where p.pronamespace in ('public'::regnamespace, 'privado'::regnamespace) and has_function_privilege('anon', p.oid, 'execute'))
  = 'cancelar_agendamento,criar_agendamento,dias_abertos,horarios_livres,meus_agendamentos,remarcar_agendamento,vitrine');
select pg_temp.confere('nenhuma função nova do privado liberada para ninguém',
  (select bool_and(not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p where p.pronamespace = 'privado'::regnamespace and p.proname in (
     'dentro_do_expediente', 'cabe_na_grade', 'sem_conflito', 'grade_do_dia', 'dia_inteiro_bloqueado', 'livres',
     'candidatos', 'montar_horarios', 'montar_dias', 'agendamento_para_remarcar', 'conferir_permissao_de_agenda')));
select pg_temp.confere('todas as funções novas com search_path vazio',
  (select bool_and(p.proconfig = array['search_path=""']) and count(*) = 16 from pg_proc p
   where (p.pronamespace = 'privado'::regnamespace and p.proname in (
     'dentro_do_expediente', 'cabe_na_grade', 'sem_conflito', 'grade_do_dia', 'dia_inteiro_bloqueado', 'livres',
     'candidatos', 'montar_horarios', 'montar_dias', 'agendamento_para_remarcar', 'conferir_permissao_de_agenda'))
   or (p.pronamespace = 'public'::regnamespace and p.proname in (
     'horarios_livres', 'dias_abertos', 'salao_horarios_livres', 'salao_dias_abertos', 'conferir_encaixe'))));


select resultado from (
  select n, resultado from pg_temp.resultados
  union all
  select 100000, 'TOTAL: ' || count(*) filter (where resultado like 'OK %' and resultado not like '%---%')
    || ' OK, ' || count(*) filter (where resultado like 'FALHOU%') || ' FALHOU'
  from pg_temp.resultados
) x order by n;

rollback;
