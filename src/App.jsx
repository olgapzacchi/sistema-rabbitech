import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Calculator, ClipboardList, Map, History, Grid2x2, BookOpen,
  Tv, Music, Wrench, Users, Menu, X, LogOut, Code2, IdCard, CalendarDays, ChevronDown,
} from 'lucide-react';
import { isCloud, supabase, missingConfig } from './lib/supabase.js';
import Login, { NewPassword, MissingConfig, AccessProblem } from './pages/Login.jsx';
import Inicio from './pages/Inicio.jsx';
import Calculadora from './pages/Calculadora.jsx';
import Saidas from './pages/Saidas.jsx';
import Estrategia from './pages/Estrategia.jsx';
import Historico from './pages/Historico.jsx';
import Analise from './pages/Analise.jsx';
import Regras from './pages/Regras.jsx';
import MediaHub from './pages/MediaHub.jsx';
import { MiniPlayer, useMusicPlayer, MusicPlayerProvider } from './components/MusicPlayer.jsx';
import { TeamProvider, useTeam } from './lib/team.jsx';
import Melhorias from './pages/Melhorias.jsx';
import Equipe from './pages/Equipe.jsx';
import Codigo from './pages/Codigo.jsx';
import Perfis from './pages/Perfis.jsx';
import Calendario from './pages/Calendario.jsx';
import PushToggle from './components/PushToggle.jsx';
import { guardarConvitePendente, pegarConvitePendente } from './components/Convites.jsx';

const NAV = [
  { section: 'Geral' },
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/calendario', label: 'Calendário', icon: CalendarDays },
  { section: 'Robô' },
  { to: '/calculadora', label: 'Calculadora', icon: Calculator },
  { to: '/saidas', label: 'Registro de saídas', icon: ClipboardList },
  { to: '/estrategia', label: 'Estratégia', icon: Map },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/analise', label: 'Análise / SWOT', icon: Grid2x2 },
  { to: '/melhorias', label: 'Melhorias', icon: Wrench },
  { to: '/codigo', label: 'Código do robô', icon: Code2 },
  { section: 'Equipe' },
  { to: '/regras', label: 'Regras', icon: BookOpen },
  { to: '/tv', label: 'Rabbitech TV', icon: Tv },
  { to: '/music', label: 'Rabbitech Music', icon: Music },
  { to: '/perfis', label: 'Perfis', icon: IdCard },
  { to: '/equipe', label: 'Equipe', icon: Users },
];

export default function App() {
  const [session, setSession] = useState(undefined);
  const [recovering, setRecovering] = useState(false);
  const [access, setAccess] = useState('checking'); // checking | ok | denied | noschema

  useEffect(() => {
    guardarConvitePendente();
    if (!isCloud) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Confere se a conta logada pertence a alguma equipe (public.is_team_member)
  const userId = session?.user?.id;
  useEffect(() => {
    if (!isCloud || !userId) return;
    setAccess('checking');
    (async () => {
      const convite = pegarConvitePendente();
      if (convite) {
        const { error } = await supabase.rpc('entrar_por_convite', { p_token: convite });
        if (error) alert(error.message);
      }
      const { data, error } = await supabase.rpc('is_team_member');
      if (error) setAccess('noschema');
      else setAccess(data ? 'ok' : 'denied');
    })();
  }, [userId]);

  if (missingConfig) return <MissingConfig />;
  if (isCloud && session === undefined) return null;
  if (isCloud && recovering) return <NewPassword onDone={() => setRecovering(false)} />;
  if (isCloud && !session) return <Login />;
  if (isCloud && access === 'checking') return null;
  if (isCloud && access !== 'ok') return <AccessProblem kind={access} email={session.user?.email} />;

  return (
    <TeamProvider session={session} denied={<AccessProblem kind="denied" email={session?.user?.email} />}>
      {(t) => (
        // trocar de equipe remonta tudo: dados, player e conta do Spotify passam a ser da nova equipe
        <MusicPlayerProvider key={t.teamId}>
          <Shell session={session} />
        </MusicPlayerProvider>
      )}
    </TeamProvider>
  );
}

function Shell({ session }) {
  const [open, setOpen] = useState(false);
  const music = useMusicPlayer();
  const { team, teams, switchTeam } = useTeam();
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  // grupos do menu recolhíveis; o grupo da tela aberta sempre fica à vista
  const [closed, setClosed] = useState(() => { try { return JSON.parse(localStorage.getItem('rabbitech.menu') || '[]'); } catch { return []; } });
  const groups = NAV.reduce((acc, n) => (n.section ? [...acc, { name: n.section, items: [] }] : (acc.at(-1).items.push(n), acc)), []);
  const here = groups.find((g) => g.items.some((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to))))?.name;
  const toggle = (name) => setClosed((c) => {
    const next = c.includes(name) ? c.filter((x) => x !== name) : [...c, name];
    try { localStorage.setItem('rabbitech.menu', JSON.stringify(next)); } catch { /* ignora */ }
    return next;
  });

  return (
    <div className={'shell' + (music.playing ? ' has-player' : '')}>
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="brand">
          <img src="/images/logo.jpg" alt="" />
          <div style={{ minWidth: 0 }}>
            <strong>{team.name}</strong>
            <small>FLL Challenge · v2</small>
          </div>
          <button className="icon-btn only-mobile" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
        </div>
        {teams.length > 1 && (
          <div style={{ padding: '10px 16px 0' }}>
            <select aria-label="Trocar de equipe" className="team-select" value={team.id} onChange={(e) => switchTeam(e.target.value)}>
              {teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        )}
        <nav>
          {groups.map((g) => {
            const aberto = !closed.includes(g.name) || g.name === here;
            return (
              <div key={g.name}>
                <button className="nav-section nav-toggle" aria-expanded={aberto} onClick={() => toggle(g.name)}>
                  <span>{g.name}</span>
                  <ChevronDown size={13} style={{ transform: aberto ? 'none' : 'rotate(-90deg)' }} aria-hidden="true" />
                </button>
                {aberto && g.items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.end} className="nav-link" onClick={() => setOpen(false)}>
                    <n.icon size={18} /> <span>{n.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          {isCloud ? (
            <>
              <PushToggle email={session?.user?.email?.toLowerCase()} />
              <small className="muted-dark" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{session?.user?.email}</small>
              <button className="nav-link" onClick={() => supabase.auth.signOut()}><LogOut size={18} /> <span>Sair</span></button>
            </>
          ) : (
            <small className="muted-dark">Modo local: dados salvos neste navegador.</small>
          )}
        </div>
      </aside>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <main className="content">
        <div className="mobile-bar only-mobile">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <strong>{team.name}</strong>
        </div>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/calculadora" element={<Calculadora />} />
          <Route path="/saidas" element={<Saidas />} />
          <Route path="/estrategia" element={<Estrategia />} />
          <Route path="/historico" element={<Historico />} />
          <Route path="/analise" element={<Analise />} />
          <Route path="/melhorias" element={<Melhorias />} />
          <Route path="/regras" element={<Regras />} />
          <Route path="/tv" element={<MediaHub kind="youtube" />} />
          <Route path="/music" element={<MediaHub kind="ytmusic" />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/perfis" element={<Perfis />} />
          <Route path="/equipe" element={<Equipe />} />
          <Route path="/codigo" element={<Codigo />} />
          <Route path="*" element={<Inicio />} />
        </Routes>
      </main>
      <MiniPlayer />
    </div>
  );
}
