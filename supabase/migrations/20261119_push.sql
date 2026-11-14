-- =====================================================================
-- Rabbitech — notificações push (web push) com o navegador fechado
-- =====================================================================
-- push_subscriptions: um aparelho/navegador por linha, de quem ativou os avisos.
-- push_config: chaves do serviço de push e segredo do agendador. SEM políticas:
--   só a Edge Function push-send (chave de serviço) lê. As chaves VAPID são geradas
--   pela própria função na primeira execução; nada é digitado ou guardado no código.
-- Todo dia às 11:00 UTC (8h em Brasília) o pg_cron chama a função, que avisa quem tem
-- prazos de tarefa e eventos chegando (mesmas regras do cartão "Atenção" do Início).
-- Idempotente.
-- =====================================================================

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
