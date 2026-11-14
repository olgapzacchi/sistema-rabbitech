// Player global da Rabbitech Music: fica fora das páginas, então a música
// continua tocando quando a pessoa navega para outras telas.
import { createContext, useContext, useEffect, useState } from 'react';
import { Music, SkipBack, SkipForward, X, ListVideo, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { spotifyEmbed, spotifyOpenUrl, isTouchDevice } from '../lib/media.js';

const Ctx = createContext({ playing: null, setPlaying: () => {} });
export const useMusicPlayer = () => useContext(Ctx);

export function MusicPlayerProvider({ children }) {
  const [playing, setPlaying] = useState(null); // { video, queue?, playlistName? }
  return <Ctx.Provider value={{ playing, setPlaying }}>{children}</Ctx.Provider>;
}

export function MiniPlayer() {
  const { playing, setPlaying } = useMusicPlayer();
  const [open, setOpen] = useState(true);
  const track = playing?.video;
  const url = track?.url;
  // Música nova: abre o player para a pessoa apertar o play do Spotify
  useEffect(() => { if (url) setOpen(true); }, [url]);
  if (!track) return null;
  const src = spotifyEmbed(track.url);
  const queue = playing.queue || [];
  const idx = queue.findIndex((v) => v.id === track.id);
  const go = (d) => setPlaying({ ...playing, video: queue[idx + d] });
  return (
    <div className={'glass-player' + (open ? ' open' : '')}>
      <div className="glass-row">
        <button className="glass-cover" onClick={() => setOpen((o) => !o)} title={open ? 'Minimizar' : 'Abrir player'}>
          {track.thumbnail ? <img src={track.thumbnail} alt="" /> : <Music size={16} />}
        </button>
        <button className="glass-text" onClick={() => setOpen((o) => !o)} title={open ? 'Minimizar' : 'Abrir player'}>
          <span className="ellipsis glass-title">{track.title}</span>
          {open && (
            <span className="ellipsis glass-sub">
              {playing.playlistName ? `${playing.playlistName} · ${idx + 1}/${queue.length}` : track.channel}
            </span>
          )}
        </button>
        <span className="eq" aria-hidden="true"><i /><i /><i /></span>
        {queue.length > 1 && open && <>
          <button className="glass-btn" disabled={idx <= 0} title="Anterior" onClick={() => go(-1)}><SkipBack size={14} /></button>
          <button className="glass-btn" disabled={idx < 0 || idx >= queue.length - 1} title="Próxima" onClick={() => go(1)}><SkipForward size={14} /></button>
        </>}
        {open && <a href={spotifyOpenUrl(track.url)} target="_blank" rel="noreferrer" className="glass-btn" title="Abrir no Spotify (música inteira)" aria-label="Abrir no Spotify"><ExternalLink size={14} /></a>}
        {open && <Link to="/music" className="glass-btn" title="Ir para a Rabbitech Music" aria-label="Ir para a Rabbitech Music"><ListVideo size={14} /></Link>}
        <button className="glass-btn" title={open ? 'Minimizar' : 'Abrir'} onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        <button className="glass-btn" title="Fechar player" onClick={() => setPlaying(null)}><X size={14} /></button>
      </div>
      {open && isTouchDevice() && (
        <a className="glass-hint" href={spotifyOpenUrl(track.url)} target="_blank" rel="noreferrer">
          No celular o Spotify toca só 30 s aqui. <b>Toque para ouvir inteira no app ↗</b>
        </a>
      )}
      {/* o iframe fica sempre montado (mesmo minimizado) para a música não parar */}
      <div className="glass-frame">
        {src && <iframe key={track.url} src={src} title={track.title}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager" />}
      </div>
    </div>
  );
}
