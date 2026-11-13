-- Rabbitech v2 — esquema completo para um NOVO projeto Supabase.
-- Rode no SQL Editor do Supabase (ou com `supabase db push`).
-- Acesso: qualquer usuário logado (conta da equipe) pode ler e escrever.

create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  group_name text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.team_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  status text not null default 'todo' check (status in ('todo','doing','done')),
  assignee_ids jsonb not null default '[]',
  group_name text default '',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text default '',
  plan_b text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sorties (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  name text not null,
  side text not null default 'vermelho' check (side in ('vermelho','azul')),
  mission_ids jsonb not null default '[]',
  path jsonb not null default '[]',
  color text default '#1450d8',
  order_index int default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  total int not null default 0,
  mission_total int default 0,
  token_points int default 0,
  inspection_points int default 0,
  missions_done int default 0,
  values jsonb not null default '{}',
  strategy_id uuid references public.strategies(id) on delete set null,
  notes text default '',
  duration_s int,
  created_at timestamptz not null default now()
);

create table if not exists public.sortie_logs (
  id uuid primary key default gen_random_uuid(),
  sortie_id uuid references public.sorties(id) on delete set null,
  mission_ids jsonb not null default '[]',
  worked text not null check (worked in ('sim','parcial','nao')),
  time_s numeric,
  notes text default '',
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.swot_items (
  id uuid primary key default gen_random_uuid(),
  quadrant text not null check (quadrant in ('forcas','fraquezas','oportunidades','ameacas')),
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.improvements (
  id uuid primary key default gen_random_uuid(),
  area text,
  title text not null,
  before_text text default '',
  after_text text default '',
  result text default 'testando',
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'outro',
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.media_links (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('youtube','spotify')),
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

-- RLS: somente usuários autenticados
do $$
declare t text;
begin
  foreach t in array array['members','team_tasks','strategies','sorties','rounds','sortie_logs','swot_items','improvements','documents','media_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "equipe_acesso_total" on public.%I', t);
    execute format('create policy "equipe_acesso_total" on public.%I for all to authenticated using (true) with check (true)', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Storage para PDFs/imagens das regras
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', true)
on conflict (id) do nothing;
drop policy if exists "equipe_envia_documentos" on storage.objects;
create policy "equipe_envia_documentos" on storage.objects for insert to authenticated with check (bucket_id = 'documentos');
drop policy if exists "equipe_apaga_documentos" on storage.objects;
create policy "equipe_apaga_documentos" on storage.objects for delete to authenticated using (bucket_id = 'documentos');

-- Dados iniciais
insert into public.members (name)
select n from unnest(array['Luiz','Nayon','Arthur','Fernanda','Eduarda','Nayane','Lucas','Laysa','Jamilly','Tayonara']) as n
where not exists (select 1 from public.members);

insert into public.strategies (name)
select 'Estratégia principal' where not exists (select 1 from public.strategies);

-- Faz a API do Supabase enxergar as tabelas novas na hora
notify pgrst, 'reload schema';
