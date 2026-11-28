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



insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'roberto@exemplo.com'),
  ('a0000000-0000-4000-8000-000000000002', 'ana@exemplo.com');
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000001' where id = 1;
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000002' where id = 2;

create function pg_temp.dono(p_comando text) returns jsonb
language sql as $$ select pg_temp.rodar('authenticated', 'a0000000-0000-4000-8000-000000000001', p_comando) $$;
create function pg_temp.ana(p_comando text) returns jsonb
language sql as $$ select pg_temp.rodar('authenticated', 'a0000000-0000-4000-8000-000000000002', p_comando) $$;

select pg_temp.guarde('novo', pg_temp.aceita('dono cria serviço com 2 tamanhos e preço próprio da Ana', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salvar_servico('{"nome":"  Luzes   finas ","categoria":"coloração","descricao":"Teste","tipo_preco":"fixo","preco":10,"duracao_min":30,
     "variacoes":[{"nome":"Curto","preco":150,"duracao_min":90},{"nome":"Longo","preco":220,"duracao_min":150}],
     "profissional_ids":[1,2],
     "precos_profissionais":[{"profissional_id":2,"preco":null,"variacoes":[170,null]}]}'::jsonb)$c$));
select pg_temp.confere('serviço novo: nome limpo, "a partir de", menor preço e menor duração, categoria existente reaproveitada',
  exists (select 1 from public.servicos s join public.categorias c on c.id = s.categoria_id
          where s.id = pg_temp.lido('novo')::bigint and s.nome = 'Luzes finas' and s.tipo_preco = 'a_partir'
            and s.preco = 150 and s.duracao_min = 90 and c.nome = 'Coloração'));
select pg_temp.confere('tamanhos gravados na ordem',
  (select string_agg(v.nome, ',' order by v.ordem) from public.servico_variacoes v where v.servico_id = pg_temp.lido('novo')::bigint) = 'Curto,Longo');
select pg_temp.confere('Roberto e Ana fazem, sem preço próprio no serviço (tem tamanhos)',
  (select count(*) from public.profissional_servicos ps where ps.servico_id = pg_temp.lido('novo')::bigint and ps.preco is null) = 2);
select pg_temp.confere('preço próprio da Ana só no tamanho Curto (R$ 170)',
  (select string_agg(pv.profissional_id || ':' || v.nome || ':' || pv.preco::int, ',')
   from public.profissional_variacoes pv join public.servico_variacoes v on v.id = pv.variacao_id
   where v.servico_id = pg_temp.lido('novo')::bigint) = '2:Curto:170');

insert into public.agendamentos (salao_id, cliente_id, profissional_id, inicio, fim, status)
values ('00000000-0000-4000-8000-000000000001', 4, 2, pg_temp.momento(5, '10:00'), pg_temp.momento(5, '11:30'), 'agendado');
insert into public.agendamento_servicos (salao_id, agendamento_id, servico_id, variacao_id, preco, duracao_min)
select '00000000-0000-4000-8000-000000000001', max(a.id), pg_temp.lido('novo')::bigint,
  (select v.id from public.servico_variacoes v where v.servico_id = pg_temp.lido('novo')::bigint and v.nome = 'Curto'), 170, 90
from public.agendamentos a;

select pg_temp.guarde('curto', to_jsonb((select v.id from public.servico_variacoes v where v.servico_id = pg_temp.lido('novo')::bigint and v.nome = 'Curto')));
select pg_temp.guarde('longo', to_jsonb((select v.id from public.servico_variacoes v where v.servico_id = pg_temp.lido('novo')::bigint and v.nome = 'Longo')));
select pg_temp.aceita('dono edita: tira os dois tamanhos antigos, põe "Médio", e a Ana deixa de fazer', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$select public.salvar_servico('{"id":%s,"nome":"Luzes finas","categoria":"Coloração","descricao":"","tipo_preco":"fixo","preco":null,"duracao_min":null,
     "variacoes":[{"nome":"Médio","preco":180,"duracao_min":120}],"profissional_ids":[1],"precos_profissionais":[]}'::jsonb)$c$, pg_temp.lido('novo')));
select pg_temp.confere('tamanho já usado em agendamento fica inativo (o agendamento mantém o nome)',
  exists (select 1 from public.servico_variacoes v where v.id = pg_temp.lido('curto')::bigint and not v.ativa));
select pg_temp.confere('tamanho nunca usado é apagado',
  not exists (select 1 from public.servico_variacoes v where v.id = pg_temp.lido('longo')::bigint));
select pg_temp.confere('quem deixa de fazer perde a ligação e os preços próprios',
  not exists (select 1 from public.profissional_servicos ps where ps.servico_id = pg_temp.lido('novo')::bigint and ps.profissional_id = 2)
  and not exists (select 1 from public.profissional_variacoes pv where pv.profissional_id = 2 and pv.variacao_id = pg_temp.lido('curto')::bigint));
select pg_temp.confere('menor preço e duração recalculados só com os tamanhos ativos (R$ 180, 120 min)',
  exists (select 1 from public.servicos s where s.id = pg_temp.lido('novo')::bigint and s.preco = 180 and s.duracao_min = 120));

select pg_temp.guarde('servicos_antes', to_jsonb((select count(*) from public.servicos)));
select pg_temp.recusa('nome de 1 letra é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salvar_servico('{"nome":"A","categoria":"Nova categoria","descricao":"","tipo_preco":"fixo","preco":30,"duracao_min":30,"variacoes":[],"profissional_ids":[1]}'::jsonb)$c$,
  'servico_invalido');
select pg_temp.confere('... e nada fica pela metade (nem o serviço nem a categoria nova)',
  (select count(*) from public.servicos) = pg_temp.lido('servicos_antes')::int
  and not exists (select 1 from public.categorias c where c.nome = 'Nova categoria'));
select pg_temp.recusa('sem nenhum profissional é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salvar_servico('{"nome":"Teste","categoria":"Corte","descricao":"","tipo_preco":"fixo","preco":30,"duracao_min":30,"variacoes":[],"profissional_ids":[]}'::jsonb)$c$,
  'sem_profissional');
select pg_temp.recusa('profissional inativo (Carla) é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salvar_servico('{"nome":"Teste","categoria":"Corte","descricao":"","tipo_preco":"fixo","preco":30,"duracao_min":30,"variacoes":[],"profissional_ids":[3]}'::jsonb)$c$,
  'profissional_invalido');
select pg_temp.recusa('profissional (Ana) não salva serviço', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select public.salvar_servico('{"nome":"Teste","categoria":"Corte","descricao":"","tipo_preco":"fixo","preco":30,"duracao_min":30,"variacoes":[],"profissional_ids":[2]}'::jsonb)$c$,
  'sem_permissao');
select pg_temp.recusa('profissional não muda preço direto na tabela (RLS)', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$with x as (update public.servicos set preco = 1 where id = 2 returning 1) select case when count(*) = 0 then 1 / 0 else 1 end from x$c$);
select pg_temp.recusa('visitante não chama salvar_servico', 'anon', null,
  $c$select public.salvar_servico('{}'::jsonb)$c$, 'permission denied');
select pg_temp.recusa('nome do serviço só com espaços é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salvar_servico('{"nome":"   ","categoria":"Corte","descricao":"","tipo_preco":"fixo","preco":30,"duracao_min":30,"variacoes":[],"profissional_ids":[1]}'::jsonb)$c$,
  'servico_invalido');
select pg_temp.recusa('nome da categoria só com espaços é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salvar_servico('{"nome":"Teste vazio","categoria":" \t ","descricao":"","tipo_preco":"fixo","preco":30,"duracao_min":30,"variacoes":[],"profissional_ids":[1]}'::jsonb)$c$,
  'servico_invalido');
select pg_temp.recusa('nome de tamanho só com espaços é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salvar_servico('{"nome":"Teste vazio","categoria":"Corte","descricao":"","variacoes":[{"nome":"Curto","preco":50,"duracao_min":30},{"nome":" \t ","preco":60,"duracao_min":40}],"profissional_ids":[1]}'::jsonb)$c$,
  'servico_invalido');
select pg_temp.confere('... e nenhum dos três gravou nada',
  (select count(*) from public.servicos) = pg_temp.lido('servicos_antes')::int
  and not exists (select 1 from public.servicos where nome = 'Teste vazio'));

select pg_temp.guarde('dois', pg_temp.aceita('dono cria serviço com 2 tamanhos (P e G)', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salvar_servico('{"nome":"Escova teste","categoria":"Tamanhos","descricao":"","variacoes":[{"nome":"P","preco":40,"duracao_min":30},{"nome":"G","preco":60,"duracao_min":50}],"profissional_ids":[1]}'::jsonb)$c$));
select pg_temp.guarde('p', to_jsonb((select v.id from public.servico_variacoes v where v.servico_id = pg_temp.lido('dois')::bigint and v.nome = 'P')));
select pg_temp.guarde('g', to_jsonb((select v.id from public.servico_variacoes v where v.servico_id = pg_temp.lido('dois')::bigint and v.nome = 'G')));
select pg_temp.aceita('salvo de novo com a ordem dos tamanhos invertida', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$select public.salvar_servico('{"id":%s,"nome":"Escova teste","categoria":"Tamanhos","descricao":"","variacoes":[{"id":%s,"nome":"G","preco":60,"duracao_min":50},{"id":%s,"nome":"P","preco":40,"duracao_min":30}],"profissional_ids":[1]}'::jsonb)$c$,
    pg_temp.lido('dois'), pg_temp.lido('g'), pg_temp.lido('p')));
select pg_temp.confere('ordem nova gravada (G, P), com os mesmos tamanhos e sem criar outros',
  (select string_agg(v.id || ':' || v.nome || ':' || v.ordem, ',' order by v.ordem) from public.servico_variacoes v where v.servico_id = pg_temp.lido('dois')::bigint)
  = pg_temp.lido('g') || ':G:1,' || pg_temp.lido('p') || ':P:2');

select pg_temp.guarde('tres', pg_temp.aceita('dono cria serviço com 3 tamanhos', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salvar_servico('{"nome":"Hidratação teste","categoria":"Tamanhos","descricao":"","variacoes":[{"nome":"Curto","preco":50,"duracao_min":30},{"nome":"Médio","preco":70,"duracao_min":45},{"nome":"Longo","preco":90,"duracao_min":60}],"profissional_ids":[1]}'::jsonb)$c$));
select pg_temp.guarde('t_curto', to_jsonb((select v.id from public.servico_variacoes v where v.servico_id = pg_temp.lido('tres')::bigint and v.nome = 'Curto')));
select pg_temp.guarde('t_medio', to_jsonb((select v.id from public.servico_variacoes v where v.servico_id = pg_temp.lido('tres')::bigint and v.nome = 'Médio')));
select pg_temp.guarde('t_longo', to_jsonb((select v.id from public.servico_variacoes v where v.servico_id = pg_temp.lido('tres')::bigint and v.nome = 'Longo')));
insert into public.agendamentos (salao_id, cliente_id, profissional_id, inicio, fim, status)
values ('00000000-0000-4000-8000-000000000001', 4, 1, pg_temp.momento(7, '15:00'), pg_temp.momento(7, '15:45'), 'agendado');
insert into public.agendamento_servicos (salao_id, agendamento_id, servico_id, variacao_id, preco, duracao_min)
select '00000000-0000-4000-8000-000000000001', max(a.id), pg_temp.lido('tres')::bigint, pg_temp.lido('t_medio')::bigint, 70, 45
from public.agendamentos a;
select pg_temp.aceita('salvo sem o tamanho do meio, que já foi usado (sem servico_repetido)', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$select public.salvar_servico('{"id":%s,"nome":"Hidratação teste","categoria":"Tamanhos","descricao":"","variacoes":[{"id":%s,"nome":"Curto","preco":50,"duracao_min":30},{"id":%s,"nome":"Longo","preco":90,"duracao_min":60}],"profissional_ids":[1]}'::jsonb)$c$,
    pg_temp.lido('tres'), pg_temp.lido('t_curto'), pg_temp.lido('t_longo')));
select pg_temp.confere('o do meio fica inativo; Curto e Longo ativos e em ordem (1 e 2)',
  exists (select 1 from public.servico_variacoes v where v.id = pg_temp.lido('t_medio')::bigint and not v.ativa)
  and (select string_agg(v.nome || ':' || v.ordem, ',' order by v.ordem) from public.servico_variacoes v
       where v.servico_id = pg_temp.lido('tres')::bigint and v.ativa) = 'Curto:1,Longo:2');

select pg_temp.guarde('sem_uso', pg_temp.aceita('dono cria serviço sem uso numa categoria nova', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.salvar_servico('{"nome":"Sobrancelha","categoria":"Rosto","descricao":"","tipo_preco":"consulta","preco":50,"duracao_min":20,"variacoes":[],
     "profissional_ids":[1,2],"precos_profissionais":[{"profissional_id":2,"preco":40,"variacoes":[]}]}'::jsonb)$c$));
select pg_temp.confere('"sob consulta" fica sem preço, inclusive o próprio',
  exists (select 1 from public.servicos s where s.id = pg_temp.lido('sem_uso')::bigint and s.preco is null and s.tipo_preco = 'consulta')
  and not exists (select 1 from public.profissional_servicos ps where ps.servico_id = pg_temp.lido('sem_uso')::bigint and ps.preco is not null));
select pg_temp.recusa('apagar serviço já usado (Corte masculino) é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select 1 from public.apagar_servico(1)$c$, 'servico_usado');
select pg_temp.recusa('profissional não apaga serviço', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  format($c$select 1 from public.apagar_servico(%s)$c$, pg_temp.lido('sem_uso')), 'sem_permissao');
select pg_temp.aceita('dono apaga serviço nunca usado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  format($c$select 1 from public.apagar_servico(%s)$c$, pg_temp.lido('sem_uso')));
select pg_temp.confere('serviço, ligações e categoria vazia saem juntos',
  not exists (select 1 from public.servicos where id = pg_temp.lido('sem_uso')::bigint)
  and not exists (select 1 from public.profissional_servicos where servico_id = pg_temp.lido('sem_uso')::bigint)
  and not exists (select 1 from public.categorias where nome = 'Rosto'));

select pg_temp.igual('dono sobe "Corte feminino" (vira o 1º de 3 em Corte)', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.trocar_ordem_servico(2, 'subir')$c$, '{"posicao": 1, "total": 3}');
select pg_temp.confere('ordem trocada com o vizinho da mesma categoria',
  (select ordem from public.servicos where id = 2) < (select ordem from public.servicos where id = 1));
select pg_temp.recusa('o 1º da categoria não sobe mais', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select public.trocar_ordem_servico(2, 'subir')$c$, 'sem_vizinho');
select pg_temp.recusa('profissional não muda a ordem', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select public.trocar_ordem_servico(1, 'subir')$c$, 'sem_permissao');

select pg_temp.aceita('Ana salva os próprios horários', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select 1 from public.salvar_horarios_do_profissional(2, '[{"dia_semana":2,"inicio":"08:00:00","fim":"12:00:00"},{"dia_semana":2,"inicio":"13:00:00","fim":"18:00:00"}]'::jsonb)$c$);
select pg_temp.confere('horários da Ana trocados de uma vez (2 linhas)',
  (select string_agg(dia_semana || ' ' || inicio || '-' || fim, ',' order by inicio) from public.horarios_trabalho where profissional_id = 2)
  = '2 08:00:00-12:00:00,2 13:00:00-18:00:00');
select pg_temp.guarde('roberto', to_jsonb((select count(*) from public.horarios_trabalho where profissional_id = 1)));
select pg_temp.recusa('Ana não mexe nos horários do Roberto', 'authenticated', 'a0000000-0000-4000-8000-000000000002',
  $c$select 1 from public.salvar_horarios_do_profissional(1, '[]'::jsonb)$c$, 'sem_permissao');
select pg_temp.confere('... e os horários do Roberto continuam lá',
  (select count(*) from public.horarios_trabalho where profissional_id = 1) = pg_temp.lido('roberto')::int);
select pg_temp.recusa('intervalos sobrepostos são recusados', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select 1 from public.salvar_horarios_do_profissional(2, '[{"dia_semana":3,"inicio":"08:00:00","fim":"12:00:00"},{"dia_semana":3,"inicio":"11:00:00","fim":"15:00:00"}]'::jsonb)$c$,
  'horarios_sobrepostos');
select pg_temp.confere('... sem apagar os horários que já existiam',
  (select count(*) from public.horarios_trabalho where profissional_id = 2) = 2);
select pg_temp.recusa('início depois do fim é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select 1 from public.salvar_horarios_do_profissional(2, '[{"dia_semana":3,"inicio":"15:00:00","fim":"12:00:00"}]'::jsonb)$c$,
  'horario_invalido');
select pg_temp.recusa('linha sem dia_semana é recusada', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select 1 from public.salvar_horarios_do_profissional(2, '[{"inicio":"08:00:00","fim":"12:00:00"}]'::jsonb)$c$,
  'horario_invalido');
select pg_temp.recusa('linha sem fim é recusada', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select 1 from public.salvar_horarios_do_profissional(2, '[{"dia_semana":3,"inicio":"08:00:00"},{"dia_semana":5,"inicio":"08:00:00","fim":"12:00:00"}]'::jsonb)$c$,
  'horario_invalido');
select pg_temp.confere('... e os horários antigos da Ana continuam lá',
  (select string_agg(dia_semana || ' ' || inicio || '-' || fim, ',' order by inicio) from public.horarios_trabalho where profissional_id = 2)
  = '2 08:00:00-12:00:00,2 13:00:00-18:00:00');
select pg_temp.recusa('profissional inativo (Carla) é recusado', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select 1 from public.salvar_horarios_do_profissional(3, '[]'::jsonb)$c$, 'nao_encontrado');
select pg_temp.aceita('dono salva os horários da Ana', 'authenticated', 'a0000000-0000-4000-8000-000000000001',
  $c$select 1 from public.salvar_horarios_do_profissional(2, '[{"dia_semana":4,"inicio":"09:00:00","fim":"19:00:00"}]'::jsonb)$c$);
select pg_temp.recusa('visitante não chama salvar_horarios_do_profissional', 'anon', null,
  $c$select 1 from public.salvar_horarios_do_profissional(2, '[]'::jsonb)$c$, 'permission denied');
select pg_temp.recusa('visitante não chama apagar_servico', 'anon', null,
  $c$select 1 from public.apagar_servico(1)$c$, 'permission denied');
select pg_temp.recusa('visitante não chama trocar_ordem_servico', 'anon', null,
  $c$select public.trocar_ordem_servico(1, 'subir')$c$, 'permission denied');
select pg_temp.confere('anon sem execute nas 4 funções; authenticated com execute nas 4',
  not has_function_privilege('anon', 'public.salvar_servico(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.apagar_servico(bigint)', 'execute')
  and not has_function_privilege('anon', 'public.trocar_ordem_servico(bigint, text)', 'execute')
  and not has_function_privilege('anon', 'public.salvar_horarios_do_profissional(bigint, jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.salvar_servico(jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.apagar_servico(bigint)', 'execute')
  and has_function_privilege('authenticated', 'public.trocar_ordem_servico(bigint, text)', 'execute')
  and has_function_privilege('authenticated', 'public.salvar_horarios_do_profissional(bigint, jsonb)', 'execute'));

select pg_temp.confere('as 4 funções são security invoker (o RLS de quem chama vale) com search_path vazio',
  (select bool_and(not p.prosecdef and p.proconfig = array['search_path=""'])
   from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('salvar_servico', 'apagar_servico', 'trocar_ordem_servico', 'salvar_horarios_do_profissional'))
  and (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('salvar_servico', 'apagar_servico', 'trocar_ordem_servico', 'salvar_horarios_do_profissional')) = 4);
select pg_temp.confere('nenhuma das 4 liberada para public ou anon',
  not exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('salvar_servico', 'apagar_servico', 'trocar_ordem_servico', 'salvar_horarios_do_profissional')
      and (a.grantee = 0 or a.grantee = 'anon'::regrole)
  ));


select resultado from (
  select n, resultado from pg_temp.resultados
  union all
  select 100000, 'TOTAL: ' || count(*) filter (where resultado like 'OK %' and resultado not like '%---%')
    || ' OK, ' || count(*) filter (where resultado like 'FALHOU%') || ' FALHOU'
  from pg_temp.resultados
) x order by n;

rollback;
