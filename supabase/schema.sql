-- =====================================================================
-- Rabbitech v2 — esquema completo do banco (Supabase / PostgreSQL)
-- =====================================================================
-- Como usar: Supabase > SQL Editor > New query > cole TODO este arquivo > Run.
-- O script é idempotente: pode ser rodado de novo sem apagar dados
-- (inclusive por cima da migração antiga 20261112000000_rabbitech_v2_schema.sql).
--
-- Modelo de dados
--   members ──< team_tasks.assignee_ids (lista de ids, jsonb)
--   members ──< sortie_logs.member_id, improvements.member_id
--   strategies ──< sorties ──< sortie_logs
--   strategies ──< rounds
--   media_links ──< tv_playlist_items >── tv_playlists   (playlists da TV e da Music)
--   swot_items, documents (independentes)
--
-- Missões são identificadas pelos números 1–15 da temporada (definidos no
-- código, em src/data/missions.js), por isso ficam como listas jsonb.
--
-- Segurança: só usuários logados que são da equipe acessam os dados.
-- "Da equipe" = e-mail listado em public.allowed_emails. Enquanto essa
-- lista estiver vazia, qualquer usuário logado é aceito (fase de configuração).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Controle de acesso
-- ---------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;
-- (sem políticas: a lista só é editada pelo SQL Editor / painel do Supabase)

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    not exists (select 1 from public.allowed_emails)
    or exists (
      select 1 from public.allowed_emails
      where email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
$$;
revoke all on function public.is_team_member() from public, anon;
grant execute on function public.is_team_member() to authenticated;

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------

-- Alunos da equipe
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  group_name text not null default '',
  created_at timestamptz not null default now()
);

-- Kanban (Início)
create table if not exists public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  assignee_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(assignee_ids) = 'array'),
  group_name text not null default '',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Estratégias
create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  notes text not null default '',
  plan_b text not null default '',
  created_at timestamptz not null default now()
);

-- Saídas de cada estratégia (lado, missões, linha no mapa)
create table if not exists public.sorties (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  name text not null,
  side text not null default 'vermelho' check (side in ('vermelho', 'azul')),
  mission_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(mission_ids) = 'array'),
  path jsonb not null default '[]'::jsonb check (jsonb_typeof(path) = 'array'),
  color text not null default '#1450d8',
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- Rounds salvos na Calculadora (Histórico)
create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  total integer not null default 0 check (total >= 0),
  mission_total integer not null default 0,
  token_points integer not null default 0,
  inspection_points integer not null default 0,
  missions_done integer not null default 0 check (missions_done between 0 and 15),
  "values" jsonb not null default '{}'::jsonb,  -- estado completo da calculadora
  strategy_id uuid references public.strategies(id) on delete set null,
  notes text not null default '',
  duration_s integer check (duration_s is null or duration_s >= 0),
  created_at timestamptz not null default now()
);

-- Registro de saídas (testes)
create table if not exists public.sortie_logs (
  id uuid primary key default gen_random_uuid(),
  sortie_id uuid references public.sorties(id) on delete set null,
  mission_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(mission_ids) = 'array'),
  worked text not null check (worked in ('sim', 'parcial', 'nao')),
  time_s numeric(7, 2) check (time_s is null or time_s >= 0),
  notes text not null default '',
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Análise SWOT
create table if not exists public.swot_items (
  id uuid primary key default gen_random_uuid(),
  quadrant text not null check (quadrant in ('forcas', 'fraquezas', 'oportunidades', 'ameacas')),
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now()
);

-- Registro de melhorias
create table if not exists public.improvements (
  id uuid primary key default gen_random_uuid(),
  area text not null default 'Outro',
  title text not null check (length(trim(title)) > 0),
  before_text text not null default '',
  after_text text not null default '',
  result text not null default 'testando' check (result in ('melhorou', 'igual', 'piorou', 'testando')),
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Regras: documentos anexados
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'outro' check (kind in ('regras', 'montagem', 'outro')),
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

-- Rabbitech TV (YouTube) e Rabbitech Music (Spotify)
create table if not exists public.media_links (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('youtube', 'spotify')),
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);
-- Rabbitech TV: categorias, anotações e dados do vídeo
alter table public.media_links add column if not exists category  text not null default 'Geral';
alter table public.media_links add column if not exists notes     text not null default '';
alter table public.media_links add column if not exists thumbnail text not null default '';
alter table public.media_links add column if not exists channel   text not null default '';
alter table public.media_links add column if not exists watched   boolean not null default false;
alter table public.media_links add column if not exists pinned    boolean not null default true;  -- fixado na TV

-- ---------------------------------------------------------------------
-- Rabbitech TV: playlists
-- ---------------------------------------------------------------------
create table if not exists public.tv_playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.tv_playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.tv_playlists(id) on delete cascade,
  media_id uuid not null references public.media_links(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (playlist_id, media_id)
);

alter table public.tv_playlists add column if not exists kind text not null default 'youtube';  -- youtube (TV) ou spotify (Music)
do $$ begin
  alter table public.tv_playlists add constraint tv_playlists_kind_check check (kind in ('youtube', 'spotify'));
exception when duplicate_object then null; end $$;
create index if not exists idx_tv_playlists_created_at    on public.tv_playlists (created_at);
create index if not exists idx_tv_playlists_kind          on public.tv_playlists (kind, created_at);
create index if not exists idx_tv_playlist_items_playlist on public.tv_playlist_items (playlist_id, position);
create index if not exists idx_tv_playlist_items_media    on public.tv_playlist_items (media_id);
create index if not exists idx_media_links_pinned         on public.media_links (kind, pinned);

-- ---------------------------------------------------------------------
-- Código do robô: registro das alterações feitas pelo site (GitHub)
-- ---------------------------------------------------------------------
create table if not exists public.code_changes (
  id uuid primary key default gen_random_uuid(),
  repo text not null,
  path text not null,
  message text not null,
  commit_sha text,
  commit_url text,
  author_email text,
  kind text not null default 'commit' check (kind in ('commit', 'redeploy')),
  created_at timestamptz not null default now()
);
create index if not exists idx_code_changes_created_at on public.code_changes (created_at);

-- Colunas comuns de auditoria (adicionadas também em bancos já existentes)
do $$
declare t text;
begin
  foreach t in array array['members','team_tasks','strategies','sorties','rounds','sortie_logs',
                           'swot_items','improvements','documents','media_links','tv_playlists','tv_playlist_items','code_changes'] loop
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('alter table public.%I add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null', t);
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index if not exists idx_members_created_at      on public.members (created_at);
create index if not exists idx_team_tasks_created_at   on public.team_tasks (created_at);
create index if not exists idx_team_tasks_status       on public.team_tasks (status);
create index if not exists idx_team_tasks_completed_at on public.team_tasks (completed_at) where completed_at is not null;
create index if not exists idx_team_tasks_assignees    on public.team_tasks using gin (assignee_ids);
create index if not exists idx_strategies_created_at   on public.strategies (created_at);
create index if not exists idx_sorties_strategy        on public.sorties (strategy_id, order_index);
create index if not exists idx_sorties_created_at      on public.sorties (created_at);
create index if not exists idx_rounds_created_at       on public.rounds (created_at);
create index if not exists idx_rounds_strategy         on public.rounds (strategy_id);
create index if not exists idx_sortie_logs_created_at  on public.sortie_logs (created_at);
create index if not exists idx_sortie_logs_sortie      on public.sortie_logs (sortie_id);
create index if not exists idx_sortie_logs_member      on public.sortie_logs (member_id);
create index if not exists idx_sortie_logs_missions    on public.sortie_logs using gin (mission_ids);
create index if not exists idx_swot_created_at         on public.swot_items (quadrant, created_at);
create index if not exists idx_improvements_created_at on public.improvements (created_at);
create index if not exists idx_improvements_member     on public.improvements (member_id);
create index if not exists idx_documents_created_at    on public.documents (kind, created_at);
create index if not exists idx_media_links_created_at  on public.media_links (kind, created_at);
create index if not exists idx_media_links_category    on public.media_links (kind, category);

-- ---------------------------------------------------------------------
-- Row Level Security + Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['members','team_tasks','strategies','sorties','rounds','sortie_logs',
                           'swot_items','improvements','documents','media_links','tv_playlists','tv_playlist_items','code_changes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "equipe_acesso_total" on public.%I', t);
    execute format('drop policy if exists "equipe_le" on public.%I', t);
    execute format('drop policy if exists "equipe_cria" on public.%I', t);
    execute format('drop policy if exists "equipe_edita" on public.%I', t);
    execute format('drop policy if exists "equipe_apaga" on public.%I', t);
    execute format('create policy "equipe_le"    on public.%I for select to authenticated using (public.is_team_member())', t);
    execute format('create policy "equipe_cria"  on public.%I for insert to authenticated with check (public.is_team_member())', t);
    execute format('create policy "equipe_edita" on public.%I for update to authenticated using (public.is_team_member()) with check (public.is_team_member())', t);
    execute format('create policy "equipe_apaga" on public.%I for delete to authenticated using (public.is_team_member())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Storage: PDFs e imagens da tela Regras
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', true, 52428800,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipe_envia_documentos" on storage.objects;
drop policy if exists "equipe_apaga_documentos" on storage.objects;
drop policy if exists "equipe_edita_documentos" on storage.objects;
create policy "equipe_envia_documentos" on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos' and public.is_team_member());
create policy "equipe_edita_documentos" on storage.objects
  for update to authenticated using (bucket_id = 'documentos' and public.is_team_member());
create policy "equipe_apaga_documentos" on storage.objects
  for delete to authenticated using (bucket_id = 'documentos' and public.is_team_member());

-- ---------------------------------------------------------------------
-- Dados iniciais (só entram se as tabelas estiverem vazias)
-- ---------------------------------------------------------------------
insert into public.members (name, created_at)
select n, now() + ord * interval '1 millisecond'
from unnest(array['Luiz','Nayon','Arthur','Fernanda','Eduarda','Nayane','Lucas','Laysa','Jamilly','Tayonara'])
     with ordinality as t(n, ord)
where not exists (select 1 from public.members)
order by ord;

insert into public.strategies (name)
select 'Estratégia principal'
where not exists (select 1 from public.strategies);




-- #####################################################################
-- MULTI-EQUIPE (também em supabase/migrations/20261114_multi_equipe.sql)
-- Fica no fim para que as políticas por equipe substituam as anteriores.
-- #####################################################################
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

-- Rabbitech Music passou a usar o YouTube (kind 'ytmusic')
alter table public.media_links drop constraint if exists media_links_kind_check;
alter table public.media_links add constraint media_links_kind_check check (kind in ('youtube', 'spotify', 'ytmusic'));
alter table public.tv_playlists drop constraint if exists tv_playlists_kind_check;
alter table public.tv_playlists add constraint tv_playlists_kind_check check (kind in ('youtube', 'spotify', 'ytmusic'));
notify pgrst, 'reload schema';

-- =====================================================================
-- Rabbitech — perfis dos alunos (foto, nome e bio), visíveis só para a própria equipe
-- =====================================================================
-- Cada aluno edita só o próprio perfil. Colegas da mesma equipe veem.
-- O admin da equipe pode remover foto e texto impróprios.
-- Fotos ficam num bucket PRIVADO: caminho = <team_id>/<email>.
-- Idempotente.
-- =====================================================================

create table if not exists public.member_profiles (
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null check (email = lower(email)),
  display_name text not null default '' check (length(display_name) <= 60),
  bio text not null default '' check (length(bio) <= 280),
  avatar_path text,
  updated_at timestamptz not null default now(),
  primary key (team_id, email)
);

alter table public.member_profiles enable row level security;
revoke all on public.member_profiles from anon;
grant select, insert, update on public.member_profiles to authenticated;

drop policy if exists "colegas_veem_perfis" on public.member_profiles;
drop policy if exists "aluno_cria_proprio_perfil" on public.member_profiles;
drop policy if exists "aluno_edita_proprio_perfil" on public.member_profiles;
drop policy if exists "admin_modera_perfil" on public.member_profiles;
create policy "colegas_veem_perfis" on public.member_profiles for select to authenticated
  using (public.is_member_of(team_id));
create policy "aluno_cria_proprio_perfil" on public.member_profiles for insert to authenticated
  with check (email = public.jwt_email() and public.is_member_of(team_id));
create policy "aluno_edita_proprio_perfil" on public.member_profiles for update to authenticated
  using (email = public.jwt_email() and public.is_member_of(team_id))
  with check (email = public.jwt_email() and public.is_member_of(team_id));
create policy "admin_modera_perfil" on public.member_profiles for update to authenticated
  using (public.is_admin_of(team_id)) with check (public.is_admin_of(team_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "equipe_ve_fotos" on storage.objects;
drop policy if exists "aluno_envia_propria_foto" on storage.objects;
drop policy if exists "aluno_troca_propria_foto" on storage.objects;
drop policy if exists "aluno_ou_admin_apaga_foto" on storage.objects;
create policy "equipe_ve_fotos" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_member_of(((storage.foldername(name))[1])::uuid));
create policy "aluno_envia_propria_foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and storage.filename(name) = public.jwt_email()
              and public.is_member_of(((storage.foldername(name))[1])::uuid));
create policy "aluno_troca_propria_foto" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and storage.filename(name) = public.jwt_email()
         and public.is_member_of(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'avatars' and storage.filename(name) = public.jwt_email()
              and public.is_member_of(((storage.foldername(name))[1])::uuid));
create policy "aluno_ou_admin_apaga_foto" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (
    (storage.filename(name) = public.jwt_email() and public.is_member_of(((storage.foldername(name))[1])::uuid))
    or public.is_admin_of(((storage.foldername(name))[1])::uuid)));

do $$
begin
  alter publication supabase_realtime add table public.member_profiles;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

do $$
declare t text;
begin
  foreach t in array array['members','team_tasks','strategies','sorties','rounds','sortie_logs','swot_items',
                           'improvements','documents','media_links','tv_playlists','tv_playlist_items','code_changes',
                           'member_profiles','team_members','teams'] loop
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

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

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_email on public.push_subscriptions (email);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
drop policy if exists "push_le_proprio" on public.push_subscriptions;
drop policy if exists "push_cria_proprio" on public.push_subscriptions;
drop policy if exists "push_edita_proprio" on public.push_subscriptions;
drop policy if exists "push_apaga_proprio" on public.push_subscriptions;
create policy "push_le_proprio" on public.push_subscriptions for select to authenticated
  using (email = public.jwt_email());
create policy "push_cria_proprio" on public.push_subscriptions for insert to authenticated
  with check (email = public.jwt_email() and public.is_team_member());
create policy "push_edita_proprio" on public.push_subscriptions for update to authenticated
  using (email = public.jwt_email()) with check (email = public.jwt_email());
create policy "push_apaga_proprio" on public.push_subscriptions for delete to authenticated
  using (email = public.jwt_email());

create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  vapid_public text,
  vapid_private text,
  cron_secret text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
insert into public.push_config (id) values (1) on conflict (id) do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- agendamento diário (8h de Brasília)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.unschedule('rabbitech-avisos-diarios') where exists (select 1 from cron.job where jobname = 'rabbitech-avisos-diarios');
select cron.schedule('rabbitech-avisos-diarios', '0 11 * * *', $job$
  select net.http_post(
    url := 'https://gfunjxrpermmzusklfyn.supabase.co/functions/v1/push-send',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', (select cron_secret from public.push_config where id = 1)),
    body := '{"action":"digest"}'::jsonb
  );
$job$);

notify pgrst, 'reload schema';

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

create table if not exists public.user_prefs (
  email text primary key check (email = lower(email)),
  tema jsonb not null default '{}'::jsonb check (jsonb_typeof(tema) = 'object' and length(tema::text) < 500),
  updated_at timestamptz not null default now()
);

alter table public.user_prefs enable row level security;
revoke all on public.user_prefs from anon;
grant select, insert, update on public.user_prefs to authenticated;
drop policy if exists "prefs_le_proprio" on public.user_prefs;
drop policy if exists "prefs_cria_proprio" on public.user_prefs;
drop policy if exists "prefs_edita_proprio" on public.user_prefs;
create policy "prefs_le_proprio" on public.user_prefs for select to authenticated using (email = public.jwt_email());
create policy "prefs_cria_proprio" on public.user_prefs for insert to authenticated
  with check (email = public.jwt_email() and public.is_team_member());
create policy "prefs_edita_proprio" on public.user_prefs for update to authenticated
  using (email = public.jwt_email()) with check (email = public.jwt_email());

notify pgrst, 'reload schema';

alter table public.strategies
  add column if not exists extras jsonb not null
  default '{"tokens": true, "inspection": true, "m10": true, "shared": false}'::jsonb
  check (jsonb_typeof(extras) = 'object');

notify pgrst, 'reload schema';
