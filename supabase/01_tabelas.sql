create extension if not exists btree_gist;

create table profissionais (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  nome text not null,
  telefone text,
  foto_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table servicos (
  id bigint generated always as identity primary key,
  nome text not null,
  categoria text not null,
  descricao text,
  foto_url text,
  duracao_min integer not null check (duracao_min > 0),
  preco numeric(10,2),
  tipo_preco text not null default 'fixo' check (tipo_preco in ('fixo', 'a_partir', 'consulta')),
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create table servico_variacoes (
  id bigint generated always as identity primary key,
  servico_id bigint not null references servicos(id) on delete cascade,
  nome text not null,
  preco numeric(10,2),
  duracao_min integer not null check (duracao_min > 0),
  ordem integer not null default 0
);

create table profissional_servicos (
  profissional_id bigint not null references profissionais(id) on delete cascade,
  servico_id bigint not null references servicos(id) on delete cascade,
  primary key (profissional_id, servico_id)
);

create table horarios_trabalho (
  id bigint generated always as identity primary key,
  profissional_id bigint not null references profissionais(id) on delete cascade,
  dia_semana integer not null check (dia_semana between 0 and 6),
  inicio time not null,
  fim time not null,
  check (fim > inicio)
);

create table bloqueios (
  id bigint generated always as identity primary key,
  profissional_id bigint not null references profissionais(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  motivo text,
  check (fim > inicio)
);

create table clientes (
  id bigint generated always as identity primary key,
  user_id uuid unique references auth.users(id),
  nome text not null,
  telefone text not null unique,
  email text,
  observacoes text,
  criado_em timestamptz not null default now()
);

create table agendamentos (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references clientes(id),
  profissional_id bigint not null references profissionais(id),
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'agendado' check (status in ('agendado', 'concluido', 'cancelado', 'faltou')),
  valor_total numeric(10,2),
  forma_pagamento text not null default 'salao' check (forma_pagamento in ('salao', 'pix')),
  pago boolean not null default false,
  observacoes text,
  criado_em timestamptz not null default now(),
  check (fim > inicio),
  constraint sem_conflito_de_horario exclude using gist (
    profissional_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status <> 'cancelado')
);

create table agendamento_servicos (
  id bigint generated always as identity primary key,
  agendamento_id bigint not null references agendamentos(id) on delete cascade,
  servico_id bigint not null references servicos(id),
  variacao_id bigint references servico_variacoes(id),
  preco numeric(10,2),
  duracao_min integer not null
);

create index on agendamentos (profissional_id, inicio);
create index on agendamentos (cliente_id);
create index on bloqueios (profissional_id, inicio);
