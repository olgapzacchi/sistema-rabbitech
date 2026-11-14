-- =====================================================================
-- Rabbitech — calendário da equipe (torneio, reunião, treino)
-- =====================================================================
-- Mesmo isolamento por equipe das outras tabelas. Os prazos das tarefas
-- do Kanban aparecem no calendário a partir de team_tasks.due_date.
-- Idempotente.
-- =====================================================================

create table if not exists public.team_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade default public.default_team_id(),
  title text not null check (length(trim(title)) > 0),
  kind text not null default 'reuniao' check (kind in ('torneio', 'reuniao', 'treino', 'outro')),
  event_date date not null,
  event_time time,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_team_events_team_date on public.team_events (team_id, event_date);

alter table public.team_events enable row level security;
revoke all on public.team_events from anon;
grant select, insert, update, delete on public.team_events to authenticated;

drop policy if exists "equipe_le" on public.team_events;
drop policy if exists "equipe_cria" on public.team_events;
drop policy if exists "equipe_edita" on public.team_events;
drop policy if exists "equipe_apaga" on public.team_events;
create policy "equipe_le" on public.team_events for select to authenticated using (public.is_member_of(team_id));
create policy "equipe_cria" on public.team_events for insert to authenticated with check (public.is_member_of(team_id));
create policy "equipe_edita" on public.team_events for update to authenticated
  using (public.is_member_of(team_id)) with check (public.is_member_of(team_id));
create policy "equipe_apaga" on public.team_events for delete to authenticated using (public.is_member_of(team_id));

alter table public.team_events replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.team_events;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
