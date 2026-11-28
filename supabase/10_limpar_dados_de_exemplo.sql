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

select pg_temp.limpar_dados_de_exemplo();

select tabela, linhas from (
  select 1 as ordem, 'salao' as tabela, count(*)::text as linhas from public.salao
  union all select 2, 'profissionais', count(*)::text from public.profissionais
  union all select 3, 'categorias', count(*)::text from public.categorias
  union all select 4, 'servicos', count(*)::text from public.servicos
  union all select 5, 'servico_variacoes', count(*)::text from public.servico_variacoes
  union all select 6, 'profissional_servicos', count(*)::text from public.profissional_servicos
  union all select 7, 'profissional_variacoes', count(*)::text from public.profissional_variacoes
  union all select 8, 'horarios_trabalho', count(*)::text from public.horarios_trabalho
  union all select 9, 'bloqueios', count(*)::text from public.bloqueios
  union all select 10, 'clientes', count(*)::text from public.clientes
  union all select 11, 'agendamentos', count(*)::text from public.agendamentos
  union all select 12, 'agendamento_servicos', count(*)::text from public.agendamento_servicos
  union all select 13, 'login do dono (profissional 1)', u.email from auth.users u
    where u.id = (select p.user_id from public.profissionais p where p.id = 1)
  union all select 14, 'outro login (apagar em Authentication → Users)', u.email from auth.users u
    where u.id is distinct from (select p.user_id from public.profissionais p where p.id = 1)
) x order by ordem, linhas;
