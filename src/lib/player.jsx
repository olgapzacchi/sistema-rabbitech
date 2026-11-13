// Player global da Rabbitech Music: fica fora das páginas, então a música
// continua tocando quando a pessoa navega para outras telas.
import { createContext, useContext, useState } from 'react';
import { Music, SkipBack, SkipForward, X, ListVideo } from 'lucide-react';
import { Link } from 'react-router-dom';
import { spotifyEmbed } from './media.js';

const Ctx = createContext({ playing: null, setPlaying: () => {} });
export const useMusicPlayer = () => useContext(Ctx);

export function MusicPlayerProvider({ children }) {
  const [playing, setPlaying] = useState(null); // { video, queue?, playlistName? }
  return <Ctx.Provider value={{ playing, setPlaying }}>{children}</Ctx.Provider>;
}

export function MiniPlayer() {
  const { playing, setPlaying } = useMusicPlayer();
  const track = playing?.video;
  if (!track) return null;
  const src = spotifyEmbed(track.url);
  const queue = playing.queue || [];
  const idx = queue.findIndex((v) => v.id === track.id);
  const go = (d) => setPlaying({ ...playing, video: queue[idx + d] });
  return (
    <div className="mini-player">
      <div className="mini-info">
        <Link to="/music" className="row" style={{ flexWrap: 'nowrap', textDecoration: 'none', color: 'inherit', minWidth: 0 }}>
          {track.thumbnail
            ? <img src={track.thumbnail} alt="" width="44" height="44" style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            : <span className="mini-icon"><Music size={18} /></span>}
          <div style={{ minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 600 }}>{track.title}</div>
            <div className="ellipsis muted-dark" style={{ padding: 0 }}>
              {playing.playlistName ? <><ListVideo size={11} style={{ verticalAlign: -1 }} /> {playing.playlistName} · {idx + 1}/{queue.length}</> : track.channel}
            </div>
          </div>
        </Link>
        <div className="row" style={{ flexWrap: 'nowrap', gap: 2 }}>
          {queue.length > 1 && <>
            <button className="icon-btn light" disabled={idx <= 0} title="Anterior" onClick={() => go(-1)}><SkipBack size={16} /></button>
            <button className="icon-btn light" disabled={idx < 0 || idx >= queue.length - 1} title="Próxima" onClick={() => go(1)}><SkipForward size={16} /></button>
          </>}
          <button className="icon-btn light" title="Fechar player" onClick={() => setPlaying(null)}><X size={16} /></button>
        </div>
      </div>
      {src && (
        <iframe key={track.url} src={src} title={track.title} className="mini-frame"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="eager" />
      )}
    </div>
  );
}
