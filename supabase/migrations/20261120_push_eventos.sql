-- =====================================================================
-- Rabbitech — avisos push quando algo acontece (em vez de um resumo fixo)
-- =====================================================================
-- Gatilhos nas tabelas chamam a Edge Function push-send (action "notify") pelo pg_net.
-- Quem fez a ação não recebe o próprio aviso. Cada aparelho escolhe as categorias
-- (push_subscriptions.categorias). O resumo diário das 8h virou uma categoria opcional
-- ("resumo"), desligada por padrão.
-- Falha ao avisar NUNCA impede salvar o dado.
-- Idempotente.
-- =====================================================================

alter table public.push_subscriptions
  add column if not exists categorias text[] not null
  default array['agenda','tarefas','documentos','robo','rounds','equipe'];

-- novo tipo de evento: data comemorativa
alter table public.team_events drop constraint if exists team_events_kind_check;
alter table public.team_events add constraint team_events_kind_check
  check (kind in ('torneio', 'reuniao', 'treino', 'data', 'outro'));

create or replace function public.push_team(p_team uuid, p_cat text, p_title text, p_body text, p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://gfunjxrpermmzusklfyn.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select cron_secret from public.push_config where id = 1)),
    body := jsonb_build_object('action', 'notify', 'team_id', p_team, 'categoria', p_cat,
                               'title', p_title, 'body', p_body, 'url', p_url,
                               'actor', public.jwt_email())
  );
exception when others then
  null; -- aviso é secundário: nunca bloqueia a gravação
end $$;

create or replace function public.trg_push()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'team_events' and tg_op = 'INSERT' then
    perform public.push_team(new.team_id, 'agenda',
      case new.kind when 'torneio' then 'Novo torneio' when 'data' then 'Nova data comemorativa' else 'Novo evento' end,
      new.title || ' · ' || to_char(new.event_date, 'DD/MM'), '/calendario');
  elsif tg_table_name = 'team_tasks' and tg_op = 'INSERT' then
    perform public.push_team(new.team_id, 'tarefas', 'Nova tarefa', new.title, '/');
  elsif tg_table_name = 'team_tasks' and tg_op = 'UPDATE' and new.status = 'done' and old.status <> 'done' then
    perform public.push_team(new.team_id, 'tarefas', 'Tarefa concluída', new.title, '/');
  elsif tg_table_name = 'documents' and tg_op = 'INSERT' then
    perform public.push_team(new.team_id, 'documentos', 'Novo documento em Regras', new.title, '/regras');
  elsif tg_table_name = 'code_changes' and tg_op = 'INSERT' then
    perform public.push_team(new.team_id, 'robo', 'Código do robô atualizado', left(coalesce(new.message, new.path, ''), 120), '/codigo');
  elsif tg_table_name = 'rounds' and tg_op = 'INSERT' then
    perform public.push_team(new.team_id, 'rounds', 'Novo round registrado', coalesce(new.total::text, '?') || ' pontos', '/historico');
  elsif tg_table_name = 'team_members' and tg_op = 'INSERT' then
    perform public.push_team(new.team_id, 'equipe', 'Nova pessoa na equipe', split_part(new.email, '@', 1), '/equipe');
  end if;
  return null;
exception when others then
  return null;
end $$;

revoke all on function public.push_team(uuid, text, text, text, text), public.trg_push() from public, anon, authenticated;

drop trigger if exists trg_push_events on public.team_events;
create trigger trg_push_events after insert on public.team_events for each row execute function public.trg_push();
drop trigger if exists trg_push_tasks on public.team_tasks;
create trigger trg_push_tasks after insert or update on public.team_tasks for each row execute function public.trg_push();
drop trigger if exists trg_push_documents on public.documents;
create trigger trg_push_documents after insert on public.documents for each row execute function public.trg_push();
drop trigger if exists trg_push_code on public.code_changes;
create trigger trg_push_code after insert on public.code_changes for each row execute function public.trg_push();
drop trigger if exists trg_push_rounds on public.rounds;
create trigger trg_push_rounds after insert on public.rounds for each row execute function public.trg_push();
drop trigger if exists trg_push_members on public.team_members;
create trigger trg_push_members after insert on public.team_members for each row execute function public.trg_push();

notify pgrst, 'reload schema';
