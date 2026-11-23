-- =====================================================================
-- Rabbitech — classificação das missões (fácil, difícil, vantajosa, desvantajosa)
-- =====================================================================
-- A equipe decide, antes de montar a estratégia, em quais caixas cada missão entra.
-- Uma missão pode estar em mais de uma caixa (ex.: fácil e vantajosa).
-- Mesmo isolamento por equipe das outras tabelas. A tabela swot_items fica como estava.
-- Idempotente.
-- =====================================================================

create table if not exists public.mission_tags (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade default public.default_team_id(),
  mission_id int not null check (mission_id between 1 and 15),
  tag text not null check (tag in ('facil', 'dificil', 'vantajosa', 'desvantajosa')),
  created_at timestamptz not null default now(),
  unique (team_id, mission_id, tag)
);
create index if not exists idx_mission_tags_team on public.mission_tags (team_id);

alter table public.mission_tags enable row level security;
revoke all on public.mission_tags from anon;
grant select, insert, update, delete on public.mission_tags to authenticated;
drop policy if exists "equipe_le" on public.mission_tags;
drop policy if exists "equipe_cria" on public.mission_tags;
drop policy if exists "equipe_edita" on public.mission_tags;
drop policy if exists "equipe_apaga" on public.mission_tags;
create policy "equipe_le" on public.mission_tags for select to authenticated using (public.is_member_of(team_id));
create policy "equipe_cria" on public.mission_tags for insert to authenticated with check (public.is_member_of(team_id));
create policy "equipe_edita" on public.mission_tags for update to authenticated
  using (public.is_member_of(team_id)) with check (public.is_member_of(team_id));
create policy "equipe_apaga" on public.mission_tags for delete to authenticated using (public.is_member_of(team_id));

alter table public.mission_tags replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.mission_tags;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
