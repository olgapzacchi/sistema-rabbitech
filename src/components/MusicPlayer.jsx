// Player global da Rabbitech Music (músicas do YouTube).
// Fica fora das páginas: a música continua quando a pessoa troca de tela.
// Usa o player oficial do YouTube (IFrame API): toca a música inteira, sem login,
// no computador e no celular, e passa sozinho para a próxima da playlist.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Music, SkipBack, SkipForward, X, ListVideo, ChevronDown, ChevronUp, Play, Pause, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { youtubeId } from '../lib/media.js';

const Ctx = createContext({ playing: null, setPlaying: () => {} });
export const useMusicPlayer = () => useContext(Ctx);

export function MusicPlayerProvider({ children }) {
  const [playing, setPlaying] = useState(null); // { video, queue?, playlistName? }
  return <Ctx.Provider value={{ playing, setPlaying }}>{children}</Ctx.Provider>;
}

let apiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { apiPromise = null; reject(new Error('Não foi possível carregar o player do YouTube.')); };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

const mmss = (sec) => { const s = Math.max(0, Math.floor(sec || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function MiniPlayer() {
  const { playing, setPlaying } = useMusicPlayer();
  const [open, setOpen] = useState(true);
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [error, setError] = useState('');
  const hostRef = useRef(null);
  const ytRef = useRef(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const track = playing?.video;
  const vid = track ? youtubeId(track.url) : null;
  const queue = playing?.queue || [];
  const idx = queue.findIndex((v) => v.id === track?.id);

  const go = (d) => {
    const p = playingRef.current;
    const q = p?.queue || [];
    const i = q.findIndex((v) => v.id === p?.video?.id);
    if (i >= 0 && q[i + d]) setPlaying({ ...p, video: q[i + d] });
  };

  // Cria o player do YouTube uma vez; depois só troca o vídeo
  useEffect(() => {
    if (!vid) { ytRef.current?.destroy?.(); ytRef.current = null; return; }
    setError('');
    setOpen(true);
    if (ytRef.current?.loadVideoById) { ytRef.current.loadVideoById(vid); return; }
    let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const el = document.createElement('div');
      hostRef.current.replaceChildren(el);
      ytRef.current = new YT.Player(el, {
        width: '100%', height: '100%', videoId: vid,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e) => e.target.playVideo(),
          onStateChange: (e) => {
            if (e.data === 1) setPaused(false);
            if (e.data === 2 || e.data === 5) setPaused(true);
            if (e.data === 0) { setPaused(true); go(1); } // acabou: próxima da playlist
          },
          onError: (e) => {
            setError(e.data === 101 || e.data === 150
              ? 'O dono deste vídeo não deixa tocar fora do YouTube. Tente outra versão da música.'
              : 'Não foi possível tocar este vídeo.');
            setTimeout(() => go(1), 2500);
          },
        },
      });
    }).catch((e) => setError(e.message));
    return () => { cancelled = true; };
  }, [vid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Destrói o player quando fecha
  useEffect(() => () => { ytRef.current?.destroy?.(); ytRef.current = null; }, []);

  // Barra de tempo
  useEffect(() => {
    if (!vid) return undefined;
    const t = setInterval(() => {
      const p = ytRef.current;
      if (p?.getCurrentTime) setTime({ cur: p.getCurrentTime() || 0, dur: p.getDuration() || 0 });
    }, 1000);
    return () => clearInterval(t);
  }, [vid]);

  if (!track) return null;

  const toggle = () => {
    const p = ytRef.current;
    if (!p?.getPlayerState) return;
    if (p.getPlayerState() === 1) p.pauseVideo(); else p.playVideo();
  };
  const close = () => { ytRef.current?.destroy?.(); ytRef.current = null; setPlaying(null); };
  const cover = track.thumbnail || (vid ? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` : '');

  return (
    <div className={'glass-player' + (open ? ' open' : '')}>
      {open ? (
        /* ---- stacked (expandido) ---- */
        <>
          <div className="glass-stack-cover">
            {cover ? <img src={cover} alt="" /> : <Music size={40} />}
            {!paused && <span className="eq glass-stack-eq" aria-hidden="true"><i /><i /><i /></span>}
          </div>
          <div className="glass-stack-info">
            <span className="ellipsis glass-title">{track.title}</span>
            <span className="ellipsis glass-sub">
              {playing.playlistName ? `${playing.playlistName} · ${idx + 1}/${queue.length}` : track.channel}
            </span>
          </div>
          {time.dur > 0 && (
            <div className="glass-stack-seek">
              <small>{mmss(time.cur)}</small>
              <input type="range" aria-label="Posição da música" min={0} max={Math.floor(time.dur)} value={Math.floor(time.cur)}
                onChange={(e) => { ytRef.current?.seekTo?.(Number(e.target.value), true); setTime((t) => ({ ...t, cur: Number(e.target.value) })); }}
                style={{ flex: 1 }} />
              <small>{mmss(time.dur)}</small>
            </div>
          )}
          <div className="glass-stack-controls">
            <button className="glass-btn" disabled={idx <= 0} title="Anterior" onClick={() => go(-1)}><SkipBack size={15} /></button>
            <button className="glass-btn glass-btn-main" title={paused ? 'Tocar' : 'Pausar'} onClick={toggle}>
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button className="glass-btn" disabled={idx < 0 || idx >= queue.length - 1} title="Próxima" onClick={() => go(1)}><SkipForward size={15} /></button>
            <Link to="/music" className="glass-btn" title="Ir para a Rabbitech Music" aria-label="Ir para a Rabbitech Music"><ListVideo size={14} /></Link>
            <button className="glass-btn" title="Minimizar" onClick={() => setOpen(false)}><ChevronDown size={15} /></button>
            <button className="glass-btn" title="Fechar player" onClick={close}><X size={14} /></button>
          </div>
          {error && (
            <div className="glass-hint" style={{ background: 'var(--red-2)', color: 'var(--red)' }}>
              {error} <a href={track.url} target="_blank" rel="noreferrer">Abrir no YouTube <ExternalLink size={11} /></a>
            </div>
          )}
        </>
      ) : (
        /* ---- pílula (minimizado) ---- */
        <div className="glass-row">
          <button className="glass-cover" onClick={() => setOpen(true)} title="Abrir player">
            {cover ? <img src={cover} alt="" /> : <Music size={16} />}
          </button>
          <button className="glass-text" onClick={() => setOpen(true)} title="Abrir player">
            <span className="ellipsis glass-title">{track.title}</span>
          </button>
          {!paused && <span className="eq" aria-hidden="true" style={{ display: 'inline-flex' }}><i /><i /><i /></span>}
          <button className="glass-btn" title={paused ? 'Tocar' : 'Pausar'} onClick={toggle}>{paused ? <Play size={14} /> : <Pause size={14} />}</button>
          <button className="glass-btn" title="Abrir" onClick={() => setOpen(true)}><ChevronUp size={15} /></button>
          <button className="glass-btn" title="Fechar player" onClick={close}><X size={14} /></button>
        </div>
      )}
      {/* vídeo sempre montado (mesmo minimizado) para a música não parar */}
      <div className="glass-video" ref={hostRef} />
    </div>
  );
}
