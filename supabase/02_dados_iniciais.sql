create function pg_temp.dia_de_trabalho(passos integer) returns date
language plpgsql as $$
declare
  dia date := (now() at time zone 'America/Sao_Paulo')::date;
  restantes integer := abs(passos);
begin
  if passos < 0 then
    while restantes > 0 loop
      dia := dia - 1;
      if extract(dow from dia) between 2 and 6 then
        restantes := restantes - 1;
      end if;
    end loop;
    return dia;
  end if;

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

insert into salao (
  id, slug, nome, descricao, foto_capa_url, endereco, telefone, whatsapp,
  intervalo_minutos, antecedencia_minima_minutos, cancelamento_minimo_minutos, pix_ativo
) values (
  '00000000-0000-4000-8000-000000000001',
  'salao-exemplo',
  'Salão Exemplo',
  'Cortes, cor e cuidado para toda a família.',
  null,
  'Rua Exemplo, 0 - Bairro Exemplo, Cidade Exemplo',
  '0030000000',
  '5500900000000',
  30, 60, 120, false
);

insert into profissionais (id, salao_id, user_id, nome, telefone, foto_url, papel, ativo, criado_em)
overriding system value values
  (1, '00000000-0000-4000-8000-000000000001', null, 'Roberto Silva', '00900000010', null, 'dono', true, '2026-01-10T12:00:00Z'),
  (2, '00000000-0000-4000-8000-000000000001', null, 'Ana Souza', '00900000011', null, 'profissional', true, '2026-03-02T12:00:00Z');

insert into categorias (id, salao_id, nome, ordem)
overriding system value values
  (1, '00000000-0000-4000-8000-000000000001', 'Corte', 1),
  (2, '00000000-0000-4000-8000-000000000001', 'Coloração', 2),
  (3, '00000000-0000-4000-8000-000000000001', 'Escova', 3),
  (4, '00000000-0000-4000-8000-000000000001', 'Tratamento', 4),
  (5, '00000000-0000-4000-8000-000000000001', 'Barba', 5);

insert into servicos (id, salao_id, categoria_id, nome, descricao, foto_url, duracao_min, preco, tipo_preco, ativo, ordem, criado_em)
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
  (12, '00000000-0000-4000-8000-000000000001', 5, 'Corte e barba', 'Corte masculino e barba juntos.', null, 60, 70, 'fixo', true, 12, '2026-01-10T12:00:00Z');

insert into servico_variacoes (id, salao_id, servico_id, nome, preco, duracao_min, ordem, ativa)
overriding system value values
  (1, '00000000-0000-4000-8000-000000000001', 4, 'Curto', 120, 90, 1, true),
  (2, '00000000-0000-4000-8000-000000000001', 4, 'Médio', 150, 110, 2, true),
  (3, '00000000-0000-4000-8000-000000000001', 4, 'Longo', 190, 130, 3, true),
  (4, '00000000-0000-4000-8000-000000000001', 7, 'Curto', 50, 40, 1, true),
  (5, '00000000-0000-4000-8000-000000000001', 7, 'Médio', 65, 50, 2, true),
  (6, '00000000-0000-4000-8000-000000000001', 7, 'Longo', 80, 60, 3, true),
  (7, '00000000-0000-4000-8000-000000000001', 9, 'Curto', 60, 40, 1, true),
  (8, '00000000-0000-4000-8000-000000000001', 9, 'Médio', 75, 50, 2, true),
  (9, '00000000-0000-4000-8000-000000000001', 9, 'Longo', 90, 60, 3, true);

insert into profissional_servicos (salao_id, profissional_id, servico_id, preco)
select '00000000-0000-4000-8000-000000000001', profissional_id, servico_id, null
from (values
  (1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 9), (1, 10), (1, 11), (1, 12),
  (2, 1), (2, 2), (2, 3), (2, 7), (2, 8), (2, 9), (2, 10), (2, 11), (2, 12)
) as ligacoes (profissional_id, servico_id);

insert into horarios_trabalho (salao_id, profissional_id, dia_semana, inicio, fim)
select '00000000-0000-4000-8000-000000000001', profissional_id, dia_semana, inicio, fim
from (
  values (1, 1, time '09:00', time '12:00')
  union all
  select profissional_id, dia_semana, intervalo.inicio, intervalo.fim
  from (values (1), (2)) as pessoas (profissional_id)
  cross join generate_series(2, 6) as dia_semana
  cross join (values (time '09:00', time '12:00'), (time '13:00', time '19:00')) as intervalo (inicio, fim)
) as horarios (profissional_id, dia_semana, inicio, fim)
order by profissional_id, dia_semana, inicio;

insert into bloqueios (salao_id, profissional_id, inicio, fim, motivo)
values (
  '00000000-0000-4000-8000-000000000001',
  2,
  pg_temp.momento(2, time '00:00'),
  pg_temp.momento(2, time '00:00') + interval '1 day',
  'Folga'
);

insert into clientes (id, salao_id, user_id, nome, telefone, email, observacoes, criado_em)
overriding system value values
  (1, '00000000-0000-4000-8000-000000000001', null, 'Mariana Costa', '00900000001', null, null, '2026-06-01T12:00:00Z'),
  (2, '00000000-0000-4000-8000-000000000001', null, 'Juliana Ferreira', '00900000002', null, 'Prefere escova mais lisa.', '2026-06-01T12:00:00Z'),
  (3, '00000000-0000-4000-8000-000000000001', null, 'Patrícia Lima', '00900000003', null, 'Coloração 6.0 com 20 volumes.', '2026-06-01T12:00:00Z'),
  (4, '00000000-0000-4000-8000-000000000001', null, 'Rafael Oliveira', '00900000004', null, null, '2026-06-01T12:00:00Z'),
  (5, '00000000-0000-4000-8000-000000000001', null, 'Lucas Almeida', '00900000005', null, null, '2026-06-01T12:00:00Z'),
  (6, '00000000-0000-4000-8000-000000000001', null, 'Fernanda Rocha', '00900000006', null, null, '2026-06-01T12:00:00Z'),
  (7, '00000000-0000-4000-8000-000000000001', null, 'Camila Martins', '00900000007', null, 'Alergia a amônia.', '2026-06-01T12:00:00Z'),
  (8, '00000000-0000-4000-8000-000000000001', null, 'Bruno Santos', '00900000008', null, null, '2026-06-01T12:00:00Z');

insert into agendamentos (
  id, salao_id, cliente_id, profissional_id, inicio, fim, status, valor_total, forma_pagamento, pago, observacoes, criado_em
)
overriding system value
select
  id, '00000000-0000-4000-8000-000000000001', cliente_id, profissional_id,
  pg_temp.momento(dia, inicio), pg_temp.momento(dia, fim),
  status, valor_total, forma_pagamento, pago, observacoes,
  pg_temp.momento(-8, time '08:00')
from (values
  (1, 1, 1, -5, time '09:00', time '09:30', 'concluido', 45, 'salao', true, null),
  (2, 2, 2, -5, time '10:00', time '10:50', 'concluido', 65, 'salao', true, null),
  (3, 3, 1, -3, time '14:00', time '16:10', 'concluido', 190, 'salao', true, null),
  (4, 4, 2, -3, time '15:00', time '16:00', 'faltou', 80, 'salao', false, null),
  (5, 5, 1, -1, time '10:00', time '11:00', 'concluido', 70, 'salao', true, null),
  (6, 6, 2, -1, time '09:00', time '10:40', 'concluido', 130, 'salao', true, null),
  (7, 7, 2, -1, time '14:00', time '14:50', 'cancelado', 75, 'salao', false, 'Cliente desmarcou pelo WhatsApp.'),
  (8, 8, 1, 0, time '09:00', time '09:30', 'concluido', 45, 'salao', true, null),
  (9, 2, 1, 0, time '10:00', time '11:50', 'agendado', 145, 'pix', true, null),
  (10, 1, 1, 0, time '14:00', time '17:00', 'agendado', null, 'salao', false, 'Valor combinado na avaliação.'),
  (11, 3, 2, 0, time '09:30', time '12:00', 'agendado', 200, 'salao', false, null),
  (12, 4, 2, 0, time '13:00', time '13:30', 'agendado', 45, 'salao', false, null),
  (13, 5, 2, 0, time '15:00', time '15:30', 'cancelado', 35, 'salao', false, null),
  (14, 6, 2, 0, time '16:00', time '17:00', 'agendado', 90, 'salao', false, null),
  (15, 7, 1, 1, time '09:00', time '10:00', 'agendado', 90, 'salao', false, null),
  (16, 8, 1, 1, time '11:00', time '12:00', 'agendado', 80, 'salao', false, null),
  (17, 1, 2, 1, time '10:00', time '11:40', 'agendado', 130, 'salao', false, null),
  (18, 3, 2, 1, time '14:00', time '15:30', 'agendado', 150, 'salao', false, null)
) as exemplos (id, cliente_id, profissional_id, dia, inicio, fim, status, valor_total, forma_pagamento, pago, observacoes);

insert into agendamento_servicos (id, salao_id, agendamento_id, servico_id, variacao_id, preco, duracao_min)
overriding system value
select id, '00000000-0000-4000-8000-000000000001', agendamento_id, servico_id, variacao_id, preco, duracao_min
from (values
  (1, 1, 1, null::bigint, 45::numeric, 30),
  (2, 2, 7, 5, 65, 50),
  (3, 3, 4, 3, 190, 130),
  (4, 4, 2, null, 80, 60),
  (5, 5, 12, null, 70, 60),
  (6, 6, 2, null, 80, 60),
  (7, 6, 7, 4, 50, 40),
  (8, 7, 9, 8, 75, 50),
  (9, 8, 1, null, 45, 30),
  (10, 9, 2, null, 80, 60),
  (11, 9, 7, 5, 65, 50),
  (12, 10, 5, null, null, 180),
  (13, 11, 8, null, 200, 150),
  (14, 12, 1, null, 45, 30),
  (15, 13, 3, null, 35, 30),
  (16, 14, 9, 9, 90, 60),
  (17, 15, 6, null, 90, 60),
  (18, 16, 7, 6, 80, 60),
  (19, 17, 2, null, 80, 60),
  (20, 17, 7, 4, 50, 40),
  (21, 18, 10, null, 150, 90)
) as itens (id, agendamento_id, servico_id, variacao_id, preco, duracao_min);

select setval(pg_get_serial_sequence('profissionais', 'id'), (select max(id) from profissionais));
select setval(pg_get_serial_sequence('categorias', 'id'), (select max(id) from categorias));
select setval(pg_get_serial_sequence('servicos', 'id'), (select max(id) from servicos));
select setval(pg_get_serial_sequence('servico_variacoes', 'id'), (select max(id) from servico_variacoes));
select setval(pg_get_serial_sequence('clientes', 'id'), (select max(id) from clientes));
select setval(pg_get_serial_sequence('agendamentos', 'id'), (select max(id) from agendamentos));
select setval(pg_get_serial_sequence('agendamento_servicos', 'id'), (select max(id) from agendamento_servicos));
