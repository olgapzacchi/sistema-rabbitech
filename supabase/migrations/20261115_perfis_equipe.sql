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
