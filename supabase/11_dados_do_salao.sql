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

select pg_temp.gravar_dados_do_salao(
  p_nome_do_salao => 'NOME_DO_SALAO',
  p_slug => 'SLUG',
  p_nome_do_profissional => 'NOME_DO_PROFISSIONAL',
  p_endereco => 'ENDERECO',
  p_whatsapp => 'WHATSAPP',
  p_telefone => 'TELEFONE',
  p_descricao => 'DESCRICAO'
);

select s.slug, s.nome, s.endereco, s.whatsapp, s.telefone, s.descricao, p.nome as profissional
from public.salao s
join public.profissionais p on p.salao_id = s.id and p.id = 1;
