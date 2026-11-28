create function privado.avisar_mudanca() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_linha jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_salao_id text := coalesce(v_linha ->> 'salao_id', v_linha ->> 'id');
  v_marca text := 'marca_aviso.' || tg_argv[0];
  v_avisados text := coalesce(current_setting(v_marca, true), '');
begin
  if v_salao_id is null or position(v_salao_id in v_avisados) > 0 then
    return null;
  end if;
  perform set_config(v_marca, v_avisados || v_salao_id || ',', true);
  begin
    perform realtime.send(jsonb_build_object('tipo', tg_argv[0]), 'mudou', 'salao:' || v_salao_id, true);
  exception when others then
    null;
  end;
  return null;
end;
$$;

revoke all on function privado.avisar_mudanca() from public, anon, authenticated;

create trigger avisar_mudanca
after insert or update or delete on public.agendamentos
for each row execute function privado.avisar_mudanca('agendamentos');

create trigger avisar_mudanca
after insert or update or delete on public.bloqueios
for each row execute function privado.avisar_mudanca('bloqueios');

create trigger avisar_mudanca
after insert or update or delete on public.horarios_trabalho
for each row execute function privado.avisar_mudanca('horarios');

create trigger avisar_mudanca
after update or delete on public.clientes
for each row execute function privado.avisar_mudanca('clientes');

create trigger avisar_mudanca
after update on public.servicos
for each row when (old.nome is distinct from new.nome)
execute function privado.avisar_mudanca('servicos');

create trigger avisar_mudanca
after update on public.servico_variacoes
for each row when (old.nome is distinct from new.nome)
execute function privado.avisar_mudanca('servicos');

create trigger avisar_mudanca
after insert or update or delete on public.profissionais
for each row execute function privado.avisar_mudanca('equipe');

create trigger avisar_mudanca
after update on public.salao
for each row execute function privado.avisar_mudanca('salao');

create policy "equipe do salao ouve os avisos" on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.messages.topic = (select realtime.topic())
  and (select realtime.topic()) = 'salao:' || (select privado.meu_salao())::text
);
