-- =====================================================================
-- Rabbitech — criar equipe e entrar por convite (link ou QR Code)
-- =====================================================================
-- Qualquer conta pode criar uma equipe e vira administradora dela.
-- Só administradores geram o convite. Quem entra pelo convite vira membro.
-- O convite vale 7 dias e é trocado sempre que um novo é gerado.
-- Tudo passa por funções com verificação interna; a tabela não é lida pelo site.
-- Idempotente.
-- =====================================================================

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  token text not null unique default (replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')),
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz
);
alter table public.team_invites enable row level security;
revoke all on public.team_invites from anon, authenticated;

create or replace function public.criar_equipe(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  tid uuid;
  me text := public.jwt_email();
begin
  if auth.uid() is null or me = '' then raise exception 'Entre na sua conta primeiro.'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Dê um nome para a equipe.'; end if;
  insert into public.teams (name) values (trim(p_name)) returning id into tid;
  insert into public.team_members (team_id, email, role) values (tid, me, 'admin');
  return tid;
exception when unique_violation then
  raise exception 'Já existe uma equipe com esse nome.';
end $$;

create or replace function public.gerar_convite_equipe(p_team uuid)
returns table (out_token text, out_expires timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_of(p_team) then raise exception 'Só administradores geram o convite.'; end if;
  update public.team_invites set revoked_at = now() where team_id = p_team and revoked_at is null;
  return query
    insert into public.team_invites (team_id, created_by) values (p_team, public.jwt_email())
    returning team_invites.token, team_invites.expires_at;
end $$;

create or replace function public.convite_equipe_atual(p_team uuid)
returns table (out_token text, out_expires timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_of(p_team) then raise exception 'Só administradores veem o convite.'; end if;
  return query
    select i.token, i.expires_at from public.team_invites i
    where i.team_id = p_team and i.revoked_at is null and i.expires_at > now()
    order by i.created_at desc limit 1;
end $$;

create or replace function public.entrar_por_convite(p_token text)
returns table (out_team_id uuid, out_team_name text)
language plpgsql security definer set search_path = public as $$
declare
  inv record;
begin
  if auth.uid() is null or public.jwt_email() = '' then raise exception 'Entre na sua conta primeiro.'; end if;
  select i.team_id, t.name into inv
  from public.team_invites i join public.teams t on t.id = i.team_id
  where i.token = trim(p_token) and i.revoked_at is null and i.expires_at > now();
  if not found then
    raise exception 'Este convite não existe, expirou ou foi trocado. Peça um novo ao administrador.';
  end if;
  insert into public.team_members (team_id, email, role) values (inv.team_id, public.jwt_email(), 'member')
  on conflict (team_id, email) do nothing;
  return query select inv.team_id, inv.name;
end $$;

revoke all on function public.criar_equipe(text), public.gerar_convite_equipe(uuid),
  public.convite_equipe_atual(uuid), public.entrar_por_convite(text) from public, anon;
grant execute on function public.criar_equipe(text), public.gerar_convite_equipe(uuid),
  public.convite_equipe_atual(uuid), public.entrar_por_convite(text) to authenticated;

notify pgrst, 'reload schema';
