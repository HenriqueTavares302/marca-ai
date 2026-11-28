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

create function pg_temp.limpar_dados_de_exemplo() returns void
language plpgsql as $$
declare
  v_saloes integer := (select count(*) from public.salao);
  v_salao_id uuid;
  v_dono public.profissionais;
begin
  if v_saloes <> 1 then
    raise exception 'limpeza_recusada: o banco tem % salões, e a limpeza só roda com um', v_saloes;
  end if;
  select s.id into v_salao_id from public.salao s;

  select p.* into v_dono from public.profissionais p where p.id = 1;
  if v_dono.id is null or v_dono.salao_id <> v_salao_id or v_dono.papel <> 'dono' or not v_dono.ativo or v_dono.user_id is null then
    raise exception 'limpeza_recusada: o profissional 1 precisa ser o dono ativo, com o login ligado';
  end if;

  if exists (select 1 from public.clientes c where c.telefone is not null and c.telefone !~ '^00') then
    raise exception 'limpeza_recusada: há cliente com celular que não é de exemplo (não começa com 00)';
  end if;

  delete from public.agendamento_servicos;
  delete from public.agendamentos;
  delete from public.clientes;
  delete from public.bloqueios;
  delete from public.horarios_trabalho;
  delete from public.profissional_variacoes;
  delete from public.profissional_servicos;
  delete from public.servico_variacoes;
  delete from public.servicos;
  delete from public.categorias;
  delete from public.profissionais where id <> 1;
end;
$$;

create function pg_temp.gravar_dados_do_salao(
  p_nome_do_salao text,
  p_slug text,
  p_nome_do_profissional text,
  p_endereco text,
  p_whatsapp text,
  p_telefone text,
  p_descricao text
) returns void
language plpgsql as $$
declare
  v_marcadores text[] := array[upper('nome_do_salao'), upper('slug'), upper('nome_do_profissional'), upper('endereco'), upper('whatsapp'), upper('telefone'), upper('descricao')];
  v_nome_do_salao text := btrim(coalesce(p_nome_do_salao, ''));
  v_slug text := btrim(coalesce(p_slug, ''));
  v_nome_do_profissional text := btrim(coalesce(p_nome_do_profissional, ''));
  v_endereco text := btrim(coalesce(p_endereco, ''));
  v_whatsapp text := btrim(coalesce(p_whatsapp, ''));
  v_telefone text := nullif(btrim(coalesce(p_telefone, '')), '');
  v_descricao text := nullif(btrim(coalesce(p_descricao, '')), '');
begin
  if array[v_nome_do_salao, v_slug, v_nome_do_profissional, v_endereco, v_whatsapp, v_telefone, v_descricao] && v_marcadores then
    raise exception 'dados_recusados: troque todos os marcadores (TELEFONE e DESCRICAO podem ficar vazios, entre aspas: '''')';
  end if;
  if (select count(*) from public.salao) <> 1 then
    raise exception 'dados_recusados: o banco precisa ter exatamente um salão';
  end if;
  if exists (select 1 from public.profissionais p where p.id <> 1)
    or exists (select 1 from public.servicos)
    or exists (select 1 from public.clientes)
    or exists (select 1 from public.agendamentos) then
    raise exception 'dados_recusados: rode antes o 10_limpar_dados_de_exemplo.sql';
  end if;
  if not exists (select 1 from public.profissionais p where p.id = 1 and p.papel = 'dono' and p.ativo and p.user_id is not null) then
    raise exception 'dados_recusados: o profissional 1 precisa ser o dono ativo, com o login ligado';
  end if;
  if char_length(v_nome_do_salao) not between 2 and 80 then
    raise exception 'dados_recusados: o nome do salão precisa ter de 2 a 80 letras';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) > 60 then
    raise exception 'dados_recusados: o slug só pode ter letras minúsculas sem acento, números e hífen entre as palavras (ex.: salao-do-joao)';
  end if;
  if char_length(v_nome_do_profissional) not between 2 and 80 then
    raise exception 'dados_recusados: o nome do profissional precisa ter de 2 a 80 letras';
  end if;
  if char_length(v_endereco) not between 5 and 200 then
    raise exception 'dados_recusados: o endereço precisa ter de 5 a 200 letras';
  end if;
  if v_whatsapp !~ '^55[0-9]{10,11}$' then
    raise exception 'dados_recusados: o WhatsApp precisa ter só números, começando com 55 e o DDD (ex.: 5511999999999)';
  end if;
  if v_telefone is not null and v_telefone !~ '^55[0-9]{10,11}$' then
    raise exception 'dados_recusados: o telefone precisa ter só números, começando com 55 e o DDD (fixo ou celular), ou ficar vazio';
  end if;
  if char_length(coalesce(v_descricao, '')) > 300 then
    raise exception 'dados_recusados: a descrição pode ter no máximo 300 letras';
  end if;

  update public.salao
  set slug = v_slug,
      nome = v_nome_do_salao,
      endereco = v_endereco,
      whatsapp = v_whatsapp,
      telefone = v_telefone,
      descricao = v_descricao,
      foto_capa_url = null;

  update public.profissionais
  set nome = v_nome_do_profissional,
      telefone = null,
      foto_url = null
  where id = 1;
end;
$$;

create function pg_temp.sobras() returns table (o_que_sobrou text)
language sql as $$
select o_que_sobrou from (
  select 'salão: nome ou endereço de exemplo' as o_que_sobrou from public.salao s
    where s.nome ilike '%exemplo%' or s.slug like '%exemplo%' or coalesce(s.endereco, '') ilike '%exemplo%'
  union all select 'salão: descrição de exemplo' from public.salao s
    where s.descricao = 'Cortes, cor e cuidado para toda a família.'
  union all select 'salão: WhatsApp com DDD 00' from public.salao s where coalesce(s.whatsapp, '') ~ '^(00|5500)'
  union all select 'salão: telefone com DDD 00' from public.salao s where coalesce(s.telefone, '') ~ '^(00|5500)'
  union all select 'profissional: ' || p.nome from public.profissionais p
    where p.nome in ('Roberto Silva', 'Ana Souza') or coalesce(p.telefone, '') ~ '^(00|5500)'
  union all select 'cliente: ' || c.nome from public.clientes c
    where coalesce(c.telefone, '') ~ '^00' or c.nome in ('Mariana Costa', 'Juliana Ferreira', 'Patrícia Lima', 'Rafael Oliveira', 'Lucas Almeida', 'Fernanda Rocha', 'Camila Martins', 'Bruno Santos')
  union all select 'login: ' || u.email from auth.users u where u.email ilike '%@exemplo.com'
) x order by o_que_sobrou
$$;

create function pg_temp.erro_de(p_comando text) returns text
language plpgsql as $$
begin
  execute p_comando;
  return 'aceito';
exception when others then
  return sqlerrm;
end;
$$;

create function pg_temp.recusou(p_nome text, p_comando text, p_erro text) returns void
language plpgsql as $$
declare
  v_erro text := pg_temp.erro_de(p_comando);
begin
  perform pg_temp.confere(p_nome, v_erro like '%' || p_erro || '%', v_erro);
end;
$$;

create function pg_temp.linhas_de_exemplo() returns text
language sql as $$
  select (select count(*) from public.servicos) || '/' || (select count(*) from public.clientes) || '/'
    || (select count(*) from public.agendamentos) || '/' || (select count(*) from public.profissionais)
$$;

create function pg_temp.dados(p_nome_do_salao text, p_slug text, p_nome_do_profissional text, p_endereco text, p_whatsapp text, p_telefone text, p_descricao text) returns text
language sql as $$
  select format('select pg_temp.gravar_dados_do_salao(%L, %L, %L, %L, %L, %L, %L)',
    p_nome_do_salao, p_slug, p_nome_do_profissional, p_endereco, p_whatsapp, p_telefone, p_descricao)
$$;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'roberto@exemplo.com'),
  ('a0000000-0000-4000-8000-000000000002', 'ana@exemplo.com');
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000001' where id = 1;
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000002' where id = 2;
update public.clientes set telefone = null where telefone !~ '^00';

select pg_temp.guarde('antes', to_jsonb(pg_temp.linhas_de_exemplo()));
select pg_temp.confere('o banco começa com os dados de exemplo do 02', pg_temp.lido('antes') <> '0/0/0/1');

update public.profissionais set user_id = null where id = 1;
select pg_temp.recusou('limpeza recusada: profissional 1 sem login ligado',
  'select pg_temp.limpar_dados_de_exemplo()', 'limpeza_recusada: o profissional 1 precisa ser o dono ativo');
update public.profissionais set user_id = 'a0000000-0000-4000-8000-000000000001' where id = 1;

update public.profissionais set papel = 'dono' where id = 2;
update public.profissionais set papel = 'profissional' where id = 1;
select pg_temp.recusou('limpeza recusada: profissional 1 não é o dono',
  'select pg_temp.limpar_dados_de_exemplo()', 'limpeza_recusada: o profissional 1 precisa ser o dono ativo');
update public.profissionais set papel = 'dono' where id = 1;
update public.profissionais set papel = 'profissional' where id = 2;

insert into public.salao (id, slug, nome) values ('00000000-0000-4000-8000-000000000002', 'outro-salao', 'Outro Salão');
select pg_temp.recusou('limpeza recusada: mais de um salão',
  'select pg_temp.limpar_dados_de_exemplo()', 'limpeza_recusada: o banco tem 2 salões');
delete from public.salao where id = '00000000-0000-4000-8000-000000000002';

insert into public.clientes (salao_id, nome, telefone) values ('00000000-0000-4000-8000-000000000001', 'Cliente De Verdade', '11000000000');
select pg_temp.recusou('limpeza recusada: cliente com celular que não começa com 00',
  'select pg_temp.limpar_dados_de_exemplo()', 'limpeza_recusada: há cliente com celular que não é de exemplo');
delete from public.clientes where telefone = '11000000000';

select pg_temp.confere('... e nenhuma recusa apagou nada', pg_temp.linhas_de_exemplo() = pg_temp.lido('antes'));

select pg_temp.recusou('dados do salão recusados antes da limpeza',
  pg_temp.dados('Salão Teste', 'salao-teste', 'Dono Teste', 'Rua Teste, 1', '5500900000099', '', ''),
  'dados_recusados: rode antes o 10_limpar_dados_de_exemplo.sql');

select pg_temp.confere('limpeza roda', pg_temp.erro_de('select pg_temp.limpar_dados_de_exemplo()') = 'aceito');
select pg_temp.confere('sai tudo de exemplo: categorias, serviços, tamanhos, preços próprios, horários, bloqueios, clientes, agendamentos e itens',
  (select count(*) from public.categorias) + (select count(*) from public.servicos) + (select count(*) from public.servico_variacoes)
  + (select count(*) from public.profissional_servicos) + (select count(*) from public.profissional_variacoes)
  + (select count(*) from public.horarios_trabalho) + (select count(*) from public.bloqueios) + (select count(*) from public.clientes)
  + (select count(*) from public.agendamentos) + (select count(*) from public.agendamento_servicos) = 0);
select pg_temp.confere('fica só o profissional 1, dono ativo e com o mesmo login',
  (select string_agg(id || ':' || papel || ':' || ativo || ':' || user_id, ',') from public.profissionais)
  = '1:dono:true:a0000000-0000-4000-8000-000000000001');
select pg_temp.confere('o salão continua (mesma linha) e os logins continuam',
  (select count(*) from public.salao where id = '00000000-0000-4000-8000-000000000001') = 1
  and (select count(*) from auth.users where id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')) = 2);

select pg_temp.recusou('dados recusados com os marcadores sem trocar',
  pg_temp.dados('NOME_DO_SALAO', 'SLUG', 'NOME_DO_PROFISSIONAL', 'ENDERECO', 'WHATSAPP', 'TELEFONE', 'DESCRICAO'),
  'dados_recusados: troque todos os marcadores');
select pg_temp.recusou('dados recusados com um marcador opcional sem trocar (TELEFONE)',
  pg_temp.dados('Salão Teste', 'salao-teste', 'Dono Teste', 'Rua Teste, 1', '5500900000099', 'TELEFONE', ''),
  'dados_recusados: troque todos os marcadores');
select pg_temp.recusou('dados recusados com slug inválido',
  pg_temp.dados('Salão Teste', 'Salão Teste', 'Dono Teste', 'Rua Teste, 1', '5500900000099', '', ''),
  'dados_recusados: o slug');
select pg_temp.recusou('dados recusados com WhatsApp com máscara',
  pg_temp.dados('Salão Teste', 'salao-teste', 'Dono Teste', 'Rua Teste, 1', '(00) 90000-0099', '', ''),
  'dados_recusados: o WhatsApp');
select pg_temp.recusou('dados recusados com WhatsApp sem o 55',
  pg_temp.dados('Salão Teste', 'salao-teste', 'Dono Teste', 'Rua Teste, 1', '00900000099', '', ''),
  'dados_recusados: o WhatsApp');
select pg_temp.recusou('dados recusados com telefone curto',
  pg_temp.dados('Salão Teste', 'salao-teste', 'Dono Teste', 'Rua Teste, 1', '5500900000099', '5500123', ''),
  'dados_recusados: o telefone');
select pg_temp.recusou('dados recusados com nome do profissional de 1 letra',
  pg_temp.dados('Salão Teste', 'salao-teste', 'D', 'Rua Teste, 1', '5500900000099', '', ''),
  'dados_recusados: o nome do profissional');
select pg_temp.recusou('dados recusados com endereço vazio',
  pg_temp.dados('Salão Teste', 'salao-teste', 'Dono Teste', '   ', '5500900000099', '', ''),
  'dados_recusados: o endereço');
select pg_temp.confere('... e nenhuma recusa mudou o salão',
  (select slug from public.salao) = 'salao-exemplo');

select pg_temp.confere('dados gravados com TELEFONE e DESCRICAO vazios',
  pg_temp.erro_de(pg_temp.dados(' Salão Teste ', 'salao-teste', 'Dono Teste', 'Rua Teste, 1 - Centro', '5500900000099', '', '  ')) = 'aceito');
select pg_temp.confere('salão com os dados novos, telefone, descrição e foto vazios',
  (select slug = 'salao-teste' and nome = 'Salão Teste' and endereco = 'Rua Teste, 1 - Centro' and whatsapp = '5500900000099'
     and telefone is null and descricao is null and foto_capa_url is null from public.salao));
select pg_temp.confere('profissional 1 renomeado, sem telefone e sem foto, com o mesmo login e papel',
  (select nome = 'Dono Teste' and telefone is null and foto_url is null and papel = 'dono' and user_id = 'a0000000-0000-4000-8000-000000000001'
   from public.profissionais where id = 1));
select pg_temp.confere('a vitrine abre pelo slug novo, com o nome novo e sem serviços nem horários',
  (select v ->> 'salao' like '%Salão Teste%' and jsonb_array_length(v -> 'servicos') = 0 and jsonb_array_length(v -> 'horarios_trabalho') = 0
   from (select public.vitrine('salao-teste') as v) x));
select pg_temp.recusou('o slug antigo deixa de existir', $c$select public.vitrine('salao-exemplo')$c$, 'salao_nao_encontrado');

select pg_temp.confere('dados gravados de novo com telefone fixo e descrição',
  pg_temp.erro_de(pg_temp.dados('Salão Teste', 'salao-teste', 'Dono Teste', 'Rua Teste, 1 - Centro', '5500900000099', '550030000000', 'Cortes e cor.')) = 'aceito');
select pg_temp.confere('telefone fixo (12 números) e descrição gravados',
  (select telefone = '550030000000' and descricao = 'Cortes e cor.' from public.salao));

select pg_temp.confere('conferência final acha o que é de teste aqui (DDD 00 e @exemplo.com) e nada mais',
  (select string_agg(o_que_sobrou, ' | ' order by o_que_sobrou) from pg_temp.sobras() where o_que_sobrou not like 'login: %')
  = 'salão: WhatsApp com DDD 00 | salão: telefone com DDD 00'
  and exists (select 1 from pg_temp.sobras() where o_que_sobrou = 'login: roberto@exemplo.com')
  and not exists (select 1 from pg_temp.sobras() where o_que_sobrou like 'login: %' and o_que_sobrou not like '%@exemplo.com'));


select resultado from (
  select n, resultado from pg_temp.resultados
  union all
  select 100000, 'TOTAL: ' || count(*) filter (where resultado like 'OK %')
    || ' OK, ' || count(*) filter (where resultado like 'FALHOU%') || ' FALHOU'
  from pg_temp.resultados
) x order by n;

rollback;
