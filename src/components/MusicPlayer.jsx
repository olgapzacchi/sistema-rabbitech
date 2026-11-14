// Player global da Rabbitech Music: fica fora das páginas, então a música continua
// tocando quando a pessoa navega para outras telas.
//
// Três modos, sempre com a conta da EQUIPE ATUAL:
//   sdk     — equipe com Spotify Premium conectado, no computador: o próprio site vira um
//             aparelho do Spotify (Web Playback SDK) e toca a música inteira pela conta da equipe.
//   connect — equipe conectada, no celular: o site controla o app do Spotify (Spotify Connect).
//   embed   — equipe sem conta conectada: player do Spotify embutido (usa a conta logada no navegador).
// O token vem da função spotify-auth, que só entrega o token da equipe para membros dessa equipe.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Music, SkipBack, SkipForward, X, ListVideo, ChevronDown, ChevronUp, ExternalLink, Play, Pause, RefreshCw, MonitorSpeaker,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { spotifyEmbed, spotifyOpenUrl, spotifyId, isTouchDevice } from '../lib/media.js';
import { isCloud, supabase } from '../lib/supabase.js';
import { useTeam } from '../lib/team.jsx';

const Ctx = createContext({ playing: null, setPlaying: () => {} });
export const useMusicPlayer = () => useContext(Ctx);

async function auth(action, teamId, extra = {}) {
  const { data, error } = await supabase.functions.invoke('spotify-auth', { body: { action, team_id: teamId, ...extra } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return data;
}

let sdkPromise = null;
function loadSdk() {
  if (window.Spotify) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      window.onSpotifyWebPlaybackSDKReady = resolve;
      const s = document.createElement('script');
      s.src = 'https://sdk.scdn.co/spotify-player.js';
      s.onerror = () => reject(new Error('Não foi possível carregar o player do Spotify.'));
      document.body.appendChild(s);
    });
  }
  return sdkPromise;
}

const uriOf = (url) => { const id = spotifyId(url); return id ? `spotify:${id}` : null; };

export function MusicPlayerProvider({ children }) {
  const teamCtx = useTeam();
  const teamId = teamCtx?.teamId;
  const teamName = teamCtx?.team?.name || '';
  const [playing, setPlaying] = useState(null); // { video, queue?, playlistName? }
  const [account, setAccount] = useState({ loaded: !isCloud, connected: false });
  const [deviceId, setDeviceId] = useState(null);
  const [devices, setDevices] = useState([]);
  const [pb, setPb] = useState({ paused: true, position: 0, duration: 0 });
  const [error, setError] = useState('');
  const tokenRef = useRef({ token: null, exp: 0 });
  const playerRef = useRef(null);

  const refreshAccount = useCallback(async () => {
    if (!isCloud || !teamId || teamId === 'local') { setAccount({ loaded: true, connected: false }); return; }
    try { setAccount({ loaded: true, ...(await auth('status', teamId)) }); }
    catch (e) { setAccount({ loaded: true, connected: false, error: e.message }); }
  }, [teamId]);
  useEffect(() => { refreshAccount(); }, [refreshAccount]);

  const premium = account.connected && account.product === 'premium';
  const mode = !premium ? 'embed' : isTouchDevice() ? 'connect' : 'sdk';

  const getToken = useCallback(async () => {
    if (tokenRef.current.token && tokenRef.current.exp > Date.now() + 30_000) return tokenRef.current.token;
    const t = await auth('token', teamId);
    tokenRef.current = { token: t.access_token, exp: new Date(t.expires_at).getTime() };
    return t.access_token;
  }, [teamId]);

  const api = useCallback(async (method, path, body) => {
    const token = await getToken();
    const res = await fetch(`https://api.spotify.com/v1${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const reason = data?.error?.reason || data?.error?.message || res.status;
      if (res.status === 404) throw new Error('Nenhum aparelho do Spotify ativo na conta da equipe.');
      if (reason === 'PREMIUM_REQUIRED' || res.status === 403) throw new Error('A conta conectada precisa ser Spotify Premium.');
      throw new Error(`O Spotify recusou (${reason}).`);
    }
    return data;
  }, [getToken]);

  // ---- modo sdk: o site vira um aparelho do Spotify da equipe ----
  useEffect(() => {
    if (mode !== 'sdk') return undefined;
    let cancelled = false;
    loadSdk().then(() => {
      if (cancelled) return;
      const player = new window.Spotify.Player({
        name: `Rabbitech · ${teamName}`,
        getOAuthToken: (cb) => getToken().then(cb).catch((e) => setError(e.message)),
        volume: 0.8,
      });
      player.addListener('ready', ({ device_id }) => setDeviceId(device_id));
      player.addListener('not_ready', () => setDeviceId(null));
      player.addListener('player_state_changed', (st) => {
        if (st) setPb({ paused: st.paused, position: st.position, duration: st.duration, track: st.track_window?.current_track });
      });
      player.addListener('initialization_error', ({ message }) => setError(`Este navegador não suporta o player do Spotify (${message}).`));
      player.addListener('authentication_error', () => { tokenRef.current = { token: null, exp: 0 }; setError('A conexão com o Spotify expirou. O administrador precisa conectar de novo.'); });
      player.addListener('account_error', () => setError('A conta conectada precisa ser Spotify Premium.'));
      player.connect();
      playerRef.current = player;
    }).catch((e) => setError(e.message));
    return () => { cancelled = true; playerRef.current?.disconnect(); playerRef.current = null; setDeviceId(null); };
  }, [mode, teamName, getToken]);

  // posição da música (o SDK só avisa nas mudanças; aqui atualizamos a barra)
  useEffect(() => {
    if (mode !== 'sdk' || pb.paused) return undefined;
    const t = setInterval(() => setPb((p) => ({ ...p, position: Math.min(p.duration, p.position + 1000) })), 1000);
    return () => clearInterval(t);
  }, [mode, pb.paused]);

  // ---- modo connect: aparelhos da conta da equipe (ex.: app do Spotify no celular) ----
  const refreshDevices = useCallback(async () => {
    if (mode !== 'connect') return;
    try {
      const d = await api('GET', '/me/player/devices');
      setDevices(d?.devices || []);
      const active = (d?.devices || []).find((x) => x.is_active) || d?.devices?.[0];
      setDeviceId((cur) => cur && d?.devices?.some((x) => x.id === cur) ? cur : active?.id || null);
    } catch (e) { setError(e.message); }
  }, [mode, api]);
  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  // tocar o que foi escolhido (sdk/connect)
  const url = playing?.video?.url;
  useEffect(() => {
    if (!url || mode === 'embed') return;
    const uri = uriOf(url);
    if (!uri) return;
    if (!deviceId) { setError(mode === 'sdk' ? 'Preparando o player da equipe… tente de novo em alguns segundos.' : 'Abra o app do Spotify (na conta da equipe) e toque em atualizar aparelhos.'); return; }
    setError('');
    const body = uri.startsWith('spotify:track:') ? { uris: [uri] } : { context_uri: uri };
    api('PUT', `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, body)
      .then(() => setPb((p) => ({ ...p, paused: false })))
      .catch((e) => setError(e.message));
  }, [url, mode, deviceId, api]);

  const controls = {
    toggle: async () => {
      try {
        if (mode === 'sdk') await playerRef.current?.togglePlay();
        else { await api('PUT', `/me/player/${pb.paused ? 'play' : 'pause'}?device_id=${deviceId}`); setPb((p) => ({ ...p, paused: !p.paused })); }
      } catch (e) { setError(e.message); }
    },
    next: () => (mode === 'sdk' ? playerRef.current?.nextTrack() : api('POST', `/me/player/next?device_id=${deviceId}`).catch((e) => setError(e.message))),
    prev: () => (mode === 'sdk' ? playerRef.current?.previousTrack() : api('POST', `/me/player/previous?device_id=${deviceId}`).catch((e) => setError(e.message))),
    stop: async () => {
      try { if (mode === 'sdk') await playerRef.current?.pause(); else if (mode === 'connect' && deviceId) await api('PUT', `/me/player/pause?device_id=${deviceId}`); } catch { /* já parado */ }
      setPlaying(null);
    },
    seek: (ms) => { if (mode === 'sdk') { playerRef.current?.seek(ms); setPb((p) => ({ ...p, position: ms })); } },
  };

  const startConnect = async () => {
    const r = await auth('start', teamId, { return_to: window.location.origin });
    window.location.href = r.url;
  };
  const disconnect = async () => {
    await controls.stop();
    await auth('disconnect', teamId);
    tokenRef.current = { token: null, exp: 0 };
    await refreshAccount();
  };

  const value = {
    playing, setPlaying, mode, account, refreshAccount, startConnect, disconnect,
    deviceId, setDeviceId, devices, refreshDevices, pb, controls, error, setError, teamName,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const mmss = (ms) => { const s = Math.floor((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function MiniPlayer() {
  const { playing, setPlaying, mode, pb, controls, error, devices, deviceId, setDeviceId, refreshDevices, account } = useMusicPlayer();
  const [open, setOpen] = useState(true);
  const track = playing?.video;
  const url = track?.url;
  // Música nova: abre o player
  useEffect(() => { if (url) setOpen(true); }, [url]);
  if (!track) return null;
  const queue = playing.queue || [];
  const idx = queue.findIndex((v) => v.id === track.id);
  const go = (d) => setPlaying({ ...playing, video: queue[idx + d] });
  const team = mode !== 'embed';
  const nowTitle = team && pb.track ? pb.track.name : track.title;
  const nowSub = team && pb.track ? pb.track.artists?.map((a) => a.name).join(', ') : track.channel;
  const cover = (team && pb.track?.album?.images?.[0]?.url) || track.thumbnail;
  const prev = () => (queue.length > 1 ? go(-1) : controls.prev());
  const next = () => (queue.length > 1 ? go(1) : controls.next());

  return (
    <div className={'glass-player' + (open ? ' open' : '')}>
      <div className="glass-row">
        <button className="glass-cover" onClick={() => setOpen((o) => !o)} title={open ? 'Minimizar' : 'Abrir player'}>
          {cover ? <img src={cover} alt="" /> : <Music size={16} />}
        </button>
        <button className="glass-text" onClick={() => setOpen((o) => !o)} title={open ? 'Minimizar' : 'Abrir player'}>
          <span className="ellipsis glass-title">{nowTitle}</span>
          {open && (
            <span className="ellipsis glass-sub">
              {playing.playlistName ? `${playing.playlistName} · ${idx + 1}/${queue.length}` : nowSub}
            </span>
          )}
        </button>
        {team ? (
          <>
            {open && <button className="glass-btn" title="Anterior" onClick={prev}><SkipBack size={14} /></button>}
            <button className="glass-btn" title={pb.paused ? 'Tocar' : 'Pausar'} onClick={controls.toggle}>{pb.paused ? <Play size={14} /> : <Pause size={14} />}</button>
            {open && <button className="glass-btn" title="Próxima" onClick={next}><SkipForward size={14} /></button>}
          </>
        ) : (
          <>
            <span className="eq" aria-hidden="true"><i /><i /><i /></span>
            {queue.length > 1 && open && <>
              <button className="glass-btn" disabled={idx <= 0} title="Anterior" onClick={() => go(-1)}><SkipBack size={14} /></button>
              <button className="glass-btn" disabled={idx < 0 || idx >= queue.length - 1} title="Próxima" onClick={() => go(1)}><SkipForward size={14} /></button>
            </>}
            {open && <a href={spotifyOpenUrl(track.url)} target="_blank" rel="noreferrer" className="glass-btn" title="Abrir no Spotify (música inteira)" aria-label="Abrir no Spotify"><ExternalLink size={14} /></a>}
          </>
        )}
        {open && <Link to="/music" className="glass-btn" title="Ir para a Rabbitech Music" aria-label="Ir para a Rabbitech Music"><ListVideo size={14} /></Link>}
        <button className="glass-btn" title={open ? 'Minimizar' : 'Abrir'} onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        <button className="glass-btn" title="Fechar player" onClick={team ? controls.stop : () => setPlaying(null)}><X size={14} /></button>
      </div>

      {open && team && (
        <div className="glass-team">
          {mode === 'sdk' && pb.duration > 0 && (
            <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
              <small>{mmss(pb.position)}</small>
              <input type="range" aria-label="Posição da música" min={0} max={pb.duration} value={pb.position}
                onChange={(e) => controls.seek(Number(e.target.value))} style={{ flex: 1 }} />
              <small>{mmss(pb.duration)}</small>
            </div>
          )}
          {mode === 'connect' && (
            <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <MonitorSpeaker size={14} />
              <select aria-label="Tocar em" value={deviceId || ''} onChange={(e) => setDeviceId(e.target.value)} style={{ flex: 1, padding: '4px 8px' }}>
                {!devices.length && <option value="">Nenhum aparelho — abra o app do Spotify</option>}
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}{d.is_active ? ' (ativo)' : ''}</option>)}
              </select>
              <button className="glass-btn" title="Atualizar aparelhos" onClick={refreshDevices}><RefreshCw size={13} /></button>
            </div>
          )}
          <small className="glass-sub">Conta da equipe: <b>{account.user}</b></small>
        </div>
      )}
      {open && error && <div className="glass-hint" style={{ background: 'rgba(217,45,32,.12)', color: '#912018' }}>{error}</div>}
      {open && !team && isTouchDevice() && (
        <a className="glass-hint" href={spotifyOpenUrl(track.url)} target="_blank" rel="noreferrer">
          No celular o Spotify toca só 30 s aqui. <b>Toque para ouvir inteira no app ↗</b>
        </a>
      )}
      {/* modo embed: o iframe fica sempre montado (mesmo minimizado) para a música não parar */}
      {!team && (
        <div className="glass-frame">
          <iframe key={track.url} src={spotifyEmbed(track.url)} title={track.title}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager" />
        </div>
      )}
    </div>
  );
}
