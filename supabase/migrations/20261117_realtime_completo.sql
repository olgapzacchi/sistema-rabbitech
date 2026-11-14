-- =====================================================================
-- Rabbitech — tempo real completo
-- =====================================================================
-- Com o filtro por equipe (team_id=eq.X), o Realtime só entrega exclusões
-- quando a tabela tem REPLICA IDENTITY FULL. Sem isso, o que um colega apaga
-- não some na tela dos outros até recarregar.
-- Idempotente.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['members','team_tasks','strategies','sorties','rounds','sortie_logs','swot_items',
                           'improvements','documents','media_links','tv_playlists','tv_playlist_items','code_changes',
                           'member_profiles','team_members','teams'] loop
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;
