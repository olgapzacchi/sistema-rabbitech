-- =====================================================================
-- Rabbitech — pontos fixos da estratégia (fichas, inspeção, M10, missão compartilhada)
-- =====================================================================
-- Cada estratégia marca quais pontos fixos conta no plano. Padrão: fichas, inspeção e M10
-- ligados; missão compartilhada (cooperação da M07) desligada, pois depende da outra equipe.
-- Idempotente.
-- =====================================================================

alter table public.strategies
  add column if not exists extras jsonb not null
  default '{"tokens": true, "inspection": true, "m10": true, "shared": false}'::jsonb
  check (jsonb_typeof(extras) = 'object');

notify pgrst, 'reload schema';
