-- =====================================================================
-- Rabbitech — várias equipes no mesmo site (multi-equipe)
-- =====================================================================
-- Cada equipe vê e altera SOMENTE os próprios dados. Contas conectadas
-- (Spotify, token do GitHub) ficam por equipe numa tabela que o site não lê;
-- só as Edge Functions acessam, depois de conferir se a pessoa é da equipe.
-- Idempotente: pode rodar de novo sem perder dados.
-- =====================================================================

-- ---------- equipes e membros ----------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  github_repo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null check (email = lower(email) and email like '%@%'),
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (team_id, email)
);
create index if not exists idx_team_members_email on public.team_members (email);

-- quem pode criar equipes
create table if not exists public.platform_admins (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- segredos por equipe: SEM políticas de acesso (só as Edge Functions, com a chave de serviço)
create table if not exists public.team_integrations (
  team_id uuid primary key references public.teams(id) on delete cascade,
  github_token text,
  spotify_refresh_token text,
  spotify_access_token text,
  spotify_expires_at timestamptz,
  spotify_user text,
  spotify_product text,
  spotify_connected_by text,
  spotify_connected_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.spotify_oauth_states (
  state text primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_email text,
  return_to text,
  created_at timestamptz not null default now()
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.team_integrations enable row level security;
alter table public.spotify_oauth_states enable row level security;
revoke all on public.team_integrations, public.spotify_oauth_states, public.platform_admins from anon, authenticated;

-- ---------- funções de permissão ----------
create or replace function public.jwt_email()
returns text language sql stable set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.platform_admins where email = public.jwt_email());
$$;

create or replace function public.is_member_of(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.team_members where team_id = t and email = public.jwt_email()
  );
$$;

create or replace function public.is_admin_of(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_platform_admin()
    or exists (select 1 from public.team_members where team_id = t and email = public.jwt_email() and role = 'admin')
  );
$$;

-- "é de alguma equipe?" (usado pelo site e pelas buscas do YouTube/Spotify)
create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_platform_admin()
    or exists (select 1 from public.team_members where email = public.jwt_email())
  );
$$;

-- equipe padrão de quem participa de UMA equipe só (para inserções sem team_id)
create or replace function public.default_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select case when count(*) = 1 then (array_agg(team_id))[1] end
  from public.team_members where email = public.jwt_email() and auth.uid() is not null;
$$;

revoke all on function public.jwt_email(), public.is_platform_admin(), public.is_member_of(uuid),
  public.is_admin_of(uuid), public.is_team_member(), public.default_team_id() from public, anon;
grant execute on function public.jwt_email(), public.is_platform_admin(), public.is_member_of(uuid),
  public.is_admin_of(uuid), public.is_team_member(), public.default_team_id() to authenticated;

-- ---------- políticas das equipes ----------
drop policy if exists "membros_veem_equipe" on public.teams;
drop policy if exists "plataforma_cria_equipe" on public.teams;
drop policy if exists "admin_edita_equipe" on public.teams;
drop policy if exists "plataforma_apaga_equipe" on public.teams;
create policy "membros_veem_equipe" on public.teams for select to authenticated
  using (public.is_member_of(id) or public.is_platform_admin());
create policy "plataforma_cria_equipe" on public.teams for insert to authenticated with check (public.is_platform_admin());
create policy "admin_edita_equipe" on public.teams for update to authenticated
  using (public.is_admin_of(id)) with check (public.is_admin_of(id));
create policy "plataforma_apaga_equipe" on public.teams for delete to authenticated using (public.is_platform_admin());

drop policy if exists "membros_veem_colegas" on public.team_members;
drop policy if exists "admin_adiciona" on public.team_members;
drop policy if exists "admin_altera" on public.team_members;
drop policy if exists "admin_remove" on public.team_members;
create policy "membros_veem_colegas" on public.team_members for select to authenticated
  using (public.is_member_of(team_id) or public.is_platform_admin());
create policy "admin_adiciona" on public.team_members for insert to authenticated with check (public.is_admin_of(team_id));
create policy "admin_altera" on public.team_members for update to authenticated
  using (public.is_admin_of(team_id)) with check (public.is_admin_of(team_id));
create policy "admin_remove" on public.team_members for delete to authenticated using (public.is_admin_of(team_id));

grant select, insert, update, delete on public.teams, public.team_members to authenticated;
revoke all on public.teams, public.team_members from anon;

-- ---------- equipe inicial: Rabbitech (recebe todos os dados que já existem) ----------
insert into public.teams (name, github_repo)
values ('Rabbitech', 'lnzindev/rabbitech-code-for-pybricks')
on conflict (name) do nothing;

do $$
begin
  if to_regclass('public.allowed_emails') is not null then
    insert into public.team_members (team_id, email)
    select t.id, a.email from public.allowed_emails a cross join public.teams t
    where t.name = 'Rabbitech' and a.email like '%@%'
    on conflict (team_id, email) do nothing;
  end if;
end $$;

-- ---------- team_id em todas as tabelas de dados + isolamento por equipe ----------
do $$
declare
  t text;
  rid uuid;
begin
  select id into rid from public.teams where name = 'Rabbitech';
  foreach t in array array['members','team_tasks','strategies','sorties','rounds','sortie_logs','swot_items',
                           'improvements','documents','media_links','tv_playlists','tv_playlist_items','code_changes'] loop
    execute format('alter table public.%I add column if not exists team_id uuid references public.teams(id) on delete cascade', t);
    execute format('update public.%I set team_id = $1 where team_id is null', t) using rid;
    execute format('alter table public.%I alter column team_id set default public.default_team_id()', t);
    execute format('alter table public.%I alter column team_id set not null', t);
    execute format('create index if not exists %I on public.%I (team_id)', 'idx_' || t || '_team', t);
    execute format('drop policy if exists "equipe_acesso_total" on public.%I', t);
    execute format('drop policy if exists "equipe_le" on public.%I', t);
    execute format('drop policy if exists "equipe_cria" on public.%I', t);
    execute format('drop policy if exists "equipe_edita" on public.%I', t);
    execute format('drop policy if exists "equipe_apaga" on public.%I', t);
    execute format('create policy "equipe_le" on public.%I for select to authenticated using (public.is_member_of(team_id))', t);
    execute format('create policy "equipe_cria" on public.%I for insert to authenticated with check (public.is_member_of(team_id))', t);
    execute format('create policy "equipe_edita" on public.%I for update to authenticated using (public.is_member_of(team_id)) with check (public.is_member_of(team_id))', t);
    execute format('create policy "equipe_apaga" on public.%I for delete to authenticated using (public.is_member_of(team_id))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- o nome do aluno é único só dentro da mesma equipe (equipes diferentes podem ter alunos de mesmo nome)
-- (sem restrição de unicidade hoje; nada a fazer)

do $$
declare t text;
begin
  foreach t in array array['teams','team_members'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
