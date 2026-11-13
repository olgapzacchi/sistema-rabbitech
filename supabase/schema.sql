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
--   swot_items, documents, media_links (independentes)
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

-- Colunas comuns de auditoria (adicionadas também em bancos já existentes)
do $$
declare t text;
begin
  foreach t in array array['members','team_tasks','strategies','sorties','rounds','sortie_logs',
                           'swot_items','improvements','documents','media_links'] loop
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

-- ---------------------------------------------------------------------
-- Row Level Security + Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['members','team_tasks','strategies','sorties','rounds','sortie_logs',
                           'swot_items','improvements','documents','media_links'] loop
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

-- Faz a API do Supabase enxergar as tabelas na hora
notify pgrst, 'reload schema';
