-- =====================================================================
-- Rabbitech — preferências pessoais (tema: modo, cor e fundo)
-- =====================================================================
-- Uma linha por conta. Cada pessoa lê e altera SÓ a própria; ninguém vê a de outro.
-- Idempotente.
-- =====================================================================

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
