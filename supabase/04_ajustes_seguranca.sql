revoke select on table public.agendamentos from authenticated;

grant select (
  id,
  salao_id,
  cliente_id,
  profissional_id,
  inicio,
  fim,
  status,
  valor_total,
  forma_pagamento,
  pago,
  forma_recebida,
  observacoes,
  criado_em
) on public.agendamentos to authenticated;
