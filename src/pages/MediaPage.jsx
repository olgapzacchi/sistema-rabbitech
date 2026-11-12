import { useEffect, useState } from 'react';
import { Plus, Trash2, Play } from 'lucide-react';
import { useTable, insert, remove } from '../lib/db.js';
import { PageHead, ErrorBox } from '../components/ui.jsx';

export function youtubeEmbed(url) {
  try {
    const u = new URL(url);
    const list = u.searchParams.get('list');
    let id = u.searchParams.get('v');
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/);
    if (m) id = m[2];
    if (id) return `https://www.youtube.com/embed/${id}${list ? '?list=' + list : ''}`;
    if (list) return `https://www.youtube.com/embed/videoseries?list=${list}`;
  } catch { /* url inválida */ }
  return null;
}

export function spotifyEmbed(url) {
  const m = String(url).match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(playlist|album|track|show|episode|artist)\/([A-Za-z0-9]+)/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

const CFG = {
  youtube: {
    title: 'Rabbitech TV', desc: 'Vídeos e playlists do YouTube assistidos aqui mesmo na plataforma.',
    placeholder: 'https://www.youtube.com/watch?v=…', embed: youtubeEmbed, height: null,
    invalid: 'Cole um link de vídeo ou playlist do YouTube.',
  },
  spotify: {
    title: 'Rabbitech Music', desc: 'Playlists da equipe no Spotify, tocando dentro da plataforma.',
    placeholder: 'https://open.spotify.com/playlist/…', embed: spotifyEmbed, height: 480,
    invalid: 'Cole um link de playlist, álbum ou música do Spotify.',
  },
};

export default function MediaPage({ kind }) {
  const cfg = CFG[kind];
  const media = useTable('media_links');
  const items = media.rows.filter((m) => m.kind === kind);
  const [current, setCurrent] = useState(null);
  const [f, setF] = useState({ title: '', url: '' });

  useEffect(() => { setCurrent(null); }, [kind]);
  const playing = items.find((i) => i.id === current) || items[items.length - 1];

  async function add(e) {
    e.preventDefault();
    if (!cfg.embed(f.url)) return alert(cfg.invalid);
    const row = await insert('media_links', { kind, title: f.title.trim() || 'Sem título', url: f.url.trim() });
    setCurrent(row.id);
    setF({ title: '', url: '' });
  }

  return (
    <>
      <PageHead title={cfg.title} desc={cfg.desc} />
      <ErrorBox error={media.error} />
      <div className="split">
        <div className="card">
          {playing ? (
            <>
              <iframe
                key={playing.id}
                className="embed"
                src={cfg.embed(playing.url)}
                style={cfg.height ? { height: cfg.height } : { aspectRatio: '16 / 9' }}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
                loading="lazy"
                title={playing.title}
              />
              <h2 style={{ marginTop: 12, marginBottom: 0 }}>{playing.title}</h2>
            </>
          ) : <div className="empty">Adicione um link ao lado para começar.</div>}
        </div>
        <div className="stack">
          <form className="card stack" onSubmit={add}>
            <h2 style={{ margin: 0 }}>Adicionar</h2>
            <label className="field">Título<input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
            <label className="field">Link<input type="url" required placeholder={cfg.placeholder} value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></label>
            <button className="btn primary"><Plus size={16} /> Adicionar</button>
          </form>
          <div className="card">
            <h2>Lista ({items.length})</h2>
            {items.slice().reverse().map((i) => (
              <div key={i.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap' }}>
                <button className={'btn sm' + (playing?.id === i.id ? ' primary' : '')} onClick={() => setCurrent(i.id)}><Play size={12} /></button>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span>
                <button className="icon-btn" onClick={() => confirm('Remover?') && remove('media_links', i.id)}><Trash2 size={14} /></button>
              </div>
            ))}
            {!items.length && <div className="muted">Nada salvo ainda.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
