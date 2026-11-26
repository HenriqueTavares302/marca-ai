create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

create table salao (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome text not null check (char_length(nome) between 2 and 80),
  descricao text check (char_length(descricao) <= 300),
  foto_capa_url text,
  endereco text,
  telefone text,
  whatsapp text,
  intervalo_minutos integer not null default 30 check (intervalo_minutos between 5 and 240),
  antecedencia_minima_minutos integer not null default 60 check (antecedencia_minima_minutos >= 0),
  cancelamento_minimo_minutos integer not null default 120 check (cancelamento_minimo_minutos >= 0),
  pix_ativo boolean not null default false,
  fuso_horario text not null default 'America/Sao_Paulo',
  criado_em timestamptz not null default now()
);

create table profissionais (
  id bigint generated always as identity primary key,
  salao_id uuid not null references salao(id) on delete cascade,
  user_id uuid references auth.users(id),
  nome text not null check (char_length(nome) between 2 and 80),
  telefone text,
  foto_url text,
  papel text not null default 'profissional' check (papel in ('dono', 'profissional')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (salao_id, id),
  unique (salao_id, user_id)
);

create table categorias (
  id bigint generated always as identity primary key,
  salao_id uuid not null references salao(id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 30),
  ordem integer not null default 0,
  unique (salao_id, id),
  unique (salao_id, nome)
);

create table servicos (
  id bigint generated always as identity primary key,
  salao_id uuid not null references salao(id) on delete cascade,
  categoria_id bigint not null,
  nome text not null check (char_length(nome) between 2 and 60),
  descricao text check (char_length(descricao) <= 160),
  foto_url text,
  duracao_min integer not null check (duracao_min between 5 and 720),
  preco numeric(10,2) check (preco > 0),
  tipo_preco text not null default 'fixo' check (tipo_preco in ('fixo', 'a_partir', 'consulta')),
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  unique (salao_id, id),
  foreign key (salao_id, categoria_id) references categorias(salao_id, id),
  check ((tipo_preco = 'consulta') = (preco is null))
);

create table servico_variacoes (
  id bigint generated always as identity primary key,
  salao_id uuid not null,
  servico_id bigint not null,
  nome text not null check (char_length(nome) between 1 and 30),
  preco numeric(10,2) not null check (preco > 0),
  duracao_min integer not null check (duracao_min between 5 and 720),
  ordem integer not null default 0,
  ativa boolean not null default true,
  unique (salao_id, id),
  foreign key (salao_id, servico_id) references servicos(salao_id, id) on delete cascade
);

create table profissional_servicos (
  salao_id uuid not null,
  profissional_id bigint not null,
  servico_id bigint not null,
  preco numeric(10,2) check (preco > 0),
  primary key (profissional_id, servico_id),
  foreign key (salao_id, profissional_id) references profissionais(salao_id, id) on delete cascade,
  foreign key (salao_id, servico_id) references servicos(salao_id, id) on delete cascade
);

create table profissional_variacoes (
  salao_id uuid not null,
  profissional_id bigint not null,
  variacao_id bigint not null,
  preco numeric(10,2) not null check (preco > 0),
  primary key (profissional_id, variacao_id),
  foreign key (salao_id, profissional_id) references profissionais(salao_id, id) on delete cascade,
  foreign key (salao_id, variacao_id) references servico_variacoes(salao_id, id) on delete cascade
);

create table horarios_trabalho (
  id bigint generated always as identity primary key,
  salao_id uuid not null,
  profissional_id bigint not null,
  dia_semana integer not null check (dia_semana between 0 and 6),
  inicio time not null,
  fim time not null,
  check (fim > inicio),
  foreign key (salao_id, profissional_id) references profissionais(salao_id, id) on delete cascade,
  constraint intervalos_sem_sobreposicao exclude using gist (
    profissional_id with =,
    dia_semana with =,
    tsrange(date '2000-01-01' + inicio, date '2000-01-01' + fim) with &&
  )
);

create table bloqueios (
  id bigint generated always as identity primary key,
  salao_id uuid not null,
  profissional_id bigint not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  motivo text not null check (char_length(motivo) between 1 and 40),
  check (fim > inicio),
  foreign key (salao_id, profissional_id) references profissionais(salao_id, id) on delete cascade
);

create table clientes (
  id bigint generated always as identity primary key,
  salao_id uuid not null references salao(id) on delete cascade,
  user_id uuid references auth.users(id),
  nome text not null check (char_length(nome) between 2 and 80),
  telefone text check (telefone ~ '^[0-9]{10,11}$'),
  email text,
  observacoes text check (char_length(observacoes) <= 500),
  criado_em timestamptz not null default now(),
  unique (salao_id, id),
  unique (salao_id, telefone),
  unique (salao_id, user_id)
);

create table agendamentos (
  id bigint generated always as identity primary key,
  salao_id uuid not null,
  cliente_id bigint not null,
  profissional_id bigint not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'agendado' check (status in ('agendado', 'concluido', 'cancelado', 'faltou')),
  valor_total numeric(10,2) check (valor_total >= 0),
  forma_pagamento text not null default 'salao' check (forma_pagamento in ('salao', 'pix')),
  pago boolean not null default false,
  forma_recebida text check (forma_recebida in ('dinheiro', 'pix', 'debito', 'credito')),
  observacoes text check (char_length(observacoes) <= 200),
  criado_em timestamptz not null default now(),
  unique (salao_id, id),
  foreign key (salao_id, cliente_id) references clientes(salao_id, id),
  foreign key (salao_id, profissional_id) references profissionais(salao_id, id),
  check (fim > inicio),
  check (forma_recebida is null or status = 'concluido'),
  constraint sem_conflito_de_horario exclude using gist (
    profissional_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status <> 'cancelado')
);

create table agendamento_servicos (
  id bigint generated always as identity primary key,
  salao_id uuid not null,
  agendamento_id bigint not null,
  servico_id bigint not null,
  variacao_id bigint,
  preco numeric(10,2) check (preco >= 0),
  duracao_min integer not null check (duracao_min > 0),
  foreign key (salao_id, agendamento_id) references agendamentos(salao_id, id) on delete cascade,
  foreign key (salao_id, servico_id) references servicos(salao_id, id),
  foreign key (salao_id, variacao_id) references servico_variacoes(salao_id, id)
);

create index on profissionais (salao_id);
create index on servicos (salao_id, ordem);
create index on servicos (salao_id, categoria_id);
create index on servico_variacoes (salao_id, servico_id);
create index on profissional_servicos (salao_id, servico_id);
create index on profissional_variacoes (salao_id, variacao_id);
create index on horarios_trabalho (salao_id, profissional_id, dia_semana);
create index on bloqueios (salao_id, profissional_id, inicio);
create index on clientes (salao_id, nome);
create index on agendamentos (salao_id, inicio);
create index on agendamentos (salao_id, profissional_id, inicio);
create index on agendamentos (salao_id, cliente_id);
create index on agendamento_servicos (salao_id, agendamento_id);
create index on agendamento_servicos (salao_id, servico_id);
create index on agendamento_servicos (salao_id, variacao_id);

alter table salao enable row level security;
alter table profissionais enable row level security;
alter table categorias enable row level security;
alter table servicos enable row level security;
alter table servico_variacoes enable row level security;
alter table profissional_servicos enable row level security;
alter table profissional_variacoes enable row level security;
alter table horarios_trabalho enable row level security;
alter table bloqueios enable row level security;
alter table clientes enable row level security;
alter table agendamentos enable row level security;
alter table agendamento_servicos enable row level security;

revoke all on table
  salao,
  profissionais,
  categorias,
  servicos,
  servico_variacoes,
  profissional_servicos,
  profissional_variacoes,
  horarios_trabalho,
  bloqueios,
  clientes,
  agendamentos,
  agendamento_servicos
from anon, authenticated;
