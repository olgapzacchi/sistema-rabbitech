// Equipe atual da pessoa logada. Tudo no site (dados, Spotify, código do robô) é da equipe atual.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, isCloud } from './supabase.js';
import { setCurrentTeam } from './db.js';

const Ctx = createContext(null);
export const useTeam = () => useContext(Ctx);

const KEY = 'rabbitech.team';
const LOCAL = { teams: [{ id: 'local', name: 'Rabbitech', role: 'admin', github_repo: 'lnzindev/rabbitech-code-for-pybricks' }], platform: true };

export function TeamProvider({ session, children, fallback, denied }) {
  const email = session?.user?.email?.toLowerCase() || '';
  const [state, setState] = useState({ loading: isCloud, teams: isCloud ? [] : LOCAL.teams, platform: !isCloud });
  const [teamId, setTeamId] = useState(() => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } });

  const reload = useCallback(async () => {
    if (!isCloud) return;
    const [{ data, error }, { data: platform }] = await Promise.all([
      supabase.from('team_members').select('role, team_id, teams(id, name, github_repo)').eq('email', email),
      supabase.rpc('is_platform_admin'),
    ]);
    const teams = error ? [] : (data || []).filter((m) => m.teams).map((m) => ({ ...m.teams, role: m.role }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setState({ loading: false, teams, platform: !!platform, error: error?.message });
  }, [email]);
  useEffect(() => { reload(); }, [reload]);

  const team = state.teams.find((t) => t.id === teamId) || state.teams[0] || null;
  setCurrentTeam(team?.id || null); // o banco passa a ler/gravar só nesta equipe

  const switchTeam = (id) => {
    try { localStorage.setItem(KEY, id); } catch { /* ignora */ }
    setTeamId(id);
  };

  if (state.loading) return fallback ?? null;
  if (!team) return denied ?? null;
  const value = {
    teams: state.teams, team, teamId: team.id, role: team.role,
    isAdmin: team.role === 'admin' || state.platform, isPlatformAdmin: state.platform,
    switchTeam, reload,
  };
  return <Ctx.Provider value={value}>{children(value)}</Ctx.Provider>;
}
