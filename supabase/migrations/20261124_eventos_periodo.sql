-- =====================================================================
-- Rabbitech — eventos de vários dias (regional de 2 dias, recesso) e tipo "recesso"
-- =====================================================================
-- end_date é opcional: vazio = evento de um dia só.
-- Idempotente.
-- =====================================================================

alter table public.team_events add column if not exists end_date date;
alter table public.team_events drop constraint if exists team_events_periodo_check;
alter table public.team_events add constraint team_events_periodo_check check (end_date is null or end_date >= event_date);

alter table public.team_events drop constraint if exists team_events_kind_check;
alter table public.team_events add constraint team_events_kind_check
  check (kind in ('torneio', 'reuniao', 'treino', 'data', 'recesso', 'outro'));

notify pgrst, 'reload schema';
