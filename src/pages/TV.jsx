import { useMemo, useState } from 'react';
import {
  Search, Plus, Trash2, Play, Check, Pin, PinOff, ListPlus, ListVideo, Loader2, Link2,
  ChevronUp, ChevronDown, SkipForward, SkipBack, Pencil, SlidersHorizontal,
} from 'lucide-react';
import { useTable, insert, update, remove, isCloud, supabase } from '../lib/db.js';
import { PageHead, ErrorBox, fmtDate } from '../components/ui.jsx';
import { youtubeEmbed } from './MediaPage.jsx';

export const CATEGORIES = ['Robô', 'Programação', 'Projeto de Inovação', 'Core Values', 'Regras e desafio', 'Geral'];
const SUGGESTIONS = ['SPIKE Prime robot', 'FLL robot game', 'SPIKE Prime attachment', 'Pybricks line following', 'FLL innovation project'];

export function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/);
    return m ? m[2] : u.searchParams.get('v');
  } catch { return null; }
}
const thumbOf = (url) => { const id = youtubeId(url); return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : ''; };

async function searchYoutube(params) {
  const { data, error } = await supabase.functions.invoke('youtube-search', { body: params });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return data;
}

export default function TV() {
  const media = useTable('media_links');
  const playlists = useTable('tv_playlists');
  const items = useTable('tv_playlist_items');
  const videos = media.rows.filter((m) => m.kind === 'youtube');
  const byYtId = useMemo(() => Object.fromEntries(videos.map((v) => [youtubeId(v.url), v])), [videos]);

  const [tab, setTab] = useState('busca');
  const [playing, setPlaying] = useState(null); // { video, queue?: [video], playlistName? }

  // ---------- ações ----------
  async function ensureSaved(item, { pin } = {}) {
    const existing = byYtId[youtubeId(item.url)];
    if (existing) {
      if (pin && !existing.pinned) await update('media_links', existing.id, { pinned: true });
      return { ...existing, pinned: existing.pinned || !!pin };
    }
    return insert('media_links', {
      kind: 'youtube', title: item.title, url: item.url, category: item.category || 'Geral',
      channel: item.channel || '', thumbnail: item.thumbnail || thumbOf(item.url), notes: '', watched: false, pinned: !!pin,
    });
  }
  async function pin(item) {
    const row = await ensureSaved(item, { pin: true });
    if (playing && youtubeId(playing.video.url) === youtubeId(row.url)) setPlaying((p) => ({ ...p, video: row }));
  }
  async function unpin(row) {
    const inPlaylists = items.rows.some((i) => i.media_id === row.id);
    if (inPlaylists) await update('media_links', row.id, { pinned: false });
    else await remove('media_links', row.id);
  }
  async function addToPlaylist(item, playlistId) {
    const row = await ensureSaved(item);
    if (items.rows.some((i) => i.playlist_id === playlistId && i.media_id === row.id)) return alert('Esse vídeo já está nessa playlist.');
    const position = items.rows.filter((i) => i.playlist_id === playlistId).length;
    await insert('tv_playlist_items', { playlist_id: playlistId, media_id: row.id, position });
  }
  async function newPlaylist(name) {
    const n = (name ?? prompt('Nome da nova playlist:'))?.trim();
    if (!n) return null;
    return insert('tv_playlists', { name: n, description: '' });
  }

  const actions = { pin, unpin, addToPlaylist, newPlaylist, playlists: playlists.rows };
  const current = playing?.video ? (byYtId[youtubeId(playing.video.url)] || playing.video) : null;

  return (
    <>
      <PageHead title="Rabbitech TV" desc="Busque vídeos sem precisar de link, fixe os melhores e monte playlists para a equipe.">
        <div className="seg">
          <button className={tab === 'busca' ? 'on' : ''} onClick={() => setTab('busca')}><Search size={14} style={{ verticalAlign: -2 }} /> Buscar</button>
          <button className={tab === 'fixados' ? 'on' : ''} onClick={() => setTab('fixados')}><Pin size={14} style={{ verticalAlign: -2 }} /> Fixados ({videos.filter((v) => v.pinned !== false).length})</button>
          <button className={tab === 'playlists' ? 'on' : ''} onClick={() => setTab('playlists')}><ListVideo size={14} style={{ verticalAlign: -2 }} /> Playlists ({playlists.rows.length})</button>
        </div>
      </PageHead>
      <ErrorBox error={media.error || playlists.error || items.error} />

      <div className="split">
        <Player current={current} playing={playing} setPlaying={setPlaying} actions={actions} />
        {tab === 'busca' && <SearchPanel byYtId={byYtId} onPlay={(v) => setPlaying({ video: v })} actions={actions} />}
        {tab === 'fixados' && <PinnedPanel videos={videos.filter((v) => v.pinned !== false)} current={current} onPlay={(v) => setPlaying({ video: v })} actions={actions} />}
        {tab === 'playlists' && <PlaylistsPanel playlists={playlists.rows} items={items.rows} videos={videos} current={current} setPlaying={setPlaying} actions={actions} />}
      </div>
    </>
  );
}

// ---------- player ----------
function Player({ current, playing, setPlaying, actions }) {
  if (!current) return <div className="card empty">Busque um vídeo e clique em <b>Assistir</b>.</div>;
  const src = youtubeEmbed(current.url);
  const queue = playing?.queue || [];
  const idx = queue.findIndex((v) => v.id === current.id);
  const go = (d) => setPlaying({ ...playing, video: queue[idx + d] });
  return (
    <div className="card stack sticky">
      {playing?.playlistName && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="tag blue"><ListVideo size={12} /> {playing.playlistName} · {idx + 1}/{queue.length}</span>
          <div className="row">
            <button className="btn sm" disabled={idx <= 0} onClick={() => go(-1)}><SkipBack size={14} /> Anterior</button>
            <button className="btn sm" disabled={idx < 0 || idx >= queue.length - 1} onClick={() => go(1)}>Próximo <SkipForward size={14} /></button>
          </div>
        </div>
      )}
      {src
        ? <iframe key={current.url} className="embed" src={src} style={{ aspectRatio: '16 / 9' }} title={current.title}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
        : <div className="empty">Link de vídeo inválido.</div>}
      <div>
        <h2 style={{ margin: 0 }}>{current.title}</h2>
        {current.channel && <span className="muted">{current.channel}</span>}
      </div>
      <div className="row">
        <PinButton video={current} actions={actions} />
        <PlaylistPicker video={current} actions={actions} />
      </div>
      {current.created_at && <VideoDetails key={current.id} v={current} />}
    </div>
  );
}

function PinButton({ video, actions, small }) {
  const pinned = !!video.created_at && video.pinned !== false;
  return pinned
    ? <button className={'btn primary' + (small ? ' sm' : '')} title="Desafixar" onClick={() => actions.unpin(video)}><PinOff size={14} /> Desafixar</button>
    : <button className={'btn' + (small ? ' sm' : '')} title="Fixar" onClick={() => actions.pin(video)}><Pin size={14} /> Fixar</button>;
}

function PlaylistPicker({ video, actions, small }) {
  async function pick(e) {
    const val = e.target.value;
    e.target.value = '';
    if (!val) return;
    let id = val;
    if (val === '__new') { const pl = await actions.newPlaylist(); if (!pl) return; id = pl.id; }
    await actions.addToPlaylist(video, id);
  }
  return (
    <label className={'btn' + (small ? ' sm' : '')} style={{ position: 'relative', cursor: 'pointer' }}>
      <ListPlus size={14} /> Playlist
      <select defaultValue="" onChange={pick} aria-label="Adicionar à playlist"
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}>
        <option value="">Adicionar à playlist…</option>
        {actions.playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        <option value="__new">＋ Nova playlist…</option>
      </select>
    </label>
  );
}

function VideoDetails({ v }) {
  const [notes, setNotes] = useState(v.notes || '');
  return (
    <>
      <div className="row">
        <select value={v.category || 'Geral'} onChange={(e) => update('media_links', v.id, { category: e.target.value })} style={{ width: 'auto' }}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className={'btn sm' + (v.watched ? ' primary' : '')} onClick={() => update('media_links', v.id, { watched: !v.watched })}>
          <Check size={14} /> {v.watched ? 'Assistido' : 'Marcar como assistido'}
        </button>
      </div>
      <label className="field">O que aprendemos com este vídeo
        <textarea rows={4} value={notes} placeholder="Ex.: ideia de garra para a M09, dica de calibração do giroscópio…"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (v.notes || '') && update('media_links', v.id, { notes })} />
      </label>
      <small className="muted">A anotação salva quando você clica fora da caixa. Salvo em {fmtDate(v.created_at)}.</small>
    </>
  );
}

function VideoRow({ v, active, onPlay, children }) {
  const thumb = v.thumbnail || thumbOf(v.url);
  return (
    <div className="row" style={{
      flexWrap: 'nowrap', padding: 8, borderRadius: 10,
      border: '1px solid ' + (active ? 'var(--blue)' : 'transparent'), background: active ? 'var(--blue-2)' : 'none',
    }}>
      <button onClick={onPlay} style={{ border: 0, padding: 0, background: 'none', cursor: 'pointer', flexShrink: 0 }} title="Assistir">
        {thumb ? <img src={thumb} alt="" width="112" height="63" style={{ borderRadius: 6, objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: 112, height: 63, borderRadius: 6, background: 'var(--bg)', display: 'grid', placeItems: 'center' }}><Play size={18} /></div>}
      </button>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div onClick={onPlay} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title}</div>
        <div className="row" style={{ gap: 4, marginTop: 4 }}>{children}</div>
      </div>
    </div>
  );
}

// ---------- busca ----------
function SearchPanel({ byYtId, onPlay, actions }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState({ precise: true, titleOnly: true, exclude: '', topic: '' });
  const [showOpts, setShowOpts] = useState(false);
  const [res, setRes] = useState({ items: [], next: null, hidden: 0, lastQ: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function run(query, pageToken) {
    if (!isCloud) { setErr('A busca funciona só com o Supabase configurado.'); return; }
    if (query.trim().length < 2) return;
    setBusy(true); setErr('');
    try {
      const data = await searchYoutube({ q: query.trim(), pageToken, ...opts });
      setRes((old) => ({
        items: pageToken ? [...old.items, ...data.items] : data.items,
        next: data.nextPageToken,
        hidden: (pageToken ? old.hidden : 0) + (data.hidden || 0),
        lastQ: query.trim(),
      }));
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); run(q); }}>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: SPIKE Prime robot" autoFocus />
          <button className="btn primary" disabled={busy} title="Buscar">{busy ? <Loader2 size={16} className="spin" /> : <Search size={16} />}</button>
          <button type="button" className={'btn' + (showOpts ? ' dark' : '')} title="Filtros" onClick={() => setShowOpts((v) => !v)}><SlidersHorizontal size={16} /></button>
        </div>
        <label className="cond" style={{ padding: 0 }}>
          <input type="checkbox" checked={opts.precise} onChange={(e) => setOpts({ ...opts, precise: e.target.checked })} />
          <span><b>Busca precisa</b>: só mostra vídeos com <i>todas</i> as palavras buscadas</span>
        </label>
        {showOpts && (
          <div className="stack" style={{ gap: 10, background: 'var(--bg)', padding: 12, borderRadius: 8 }}>
            <label className="cond" style={{ padding: 0 }}>
              <input type="checkbox" checked={opts.titleOnly} disabled={!opts.precise} onChange={(e) => setOpts({ ...opts, titleOnly: e.target.checked })} />
              <span>As palavras precisam estar no <b>título</b> (desmarque para aceitar também a descrição)</span>
            </label>
            <label className="field">Excluir palavras (separe por espaço)
              <input type="text" value={opts.exclude} placeholder="Ex.: carro car nail" onChange={(e) => setOpts({ ...opts, exclude: e.target.value })} />
            </label>
            <label className="field">Tipo de vídeo
              <select value={opts.topic} onChange={(e) => setOpts({ ...opts, topic: e.target.value })}>
                <option value="">Qualquer</option>
                <option value="tech">Ciência e Tecnologia</option>
                <option value="edu">Educação</option>
              </select>
            </label>
          </div>
        )}
        <div className="row" style={{ gap: 4 }}>
          {SUGGESTIONS.map((s) => <button type="button" key={s} className="btn sm" onClick={() => { setQ(s); run(s); }}>{s}</button>)}
        </div>
      </form>

      {err && <div className="error" style={{ margin: 0 }}>{err}</div>}
      {res.lastQ && !busy && !err && (
        <small className="muted">
          {res.items.length} vídeo(s) para “{res.lastQ}”
          {res.hidden > 0 && ` · ${res.hidden} escondido(s) pelo filtro preciso`}
        </small>
      )}
      {res.items.length > 0 && (
        <div className="card" style={{ padding: 8 }}>
          {res.items.map((v) => {
            const saved = byYtId[v.id];
            const shown = saved || v;
            return (
              <VideoRow key={v.id} v={v} onPlay={() => onPlay(shown)}>
                <button className="btn sm" onClick={() => onPlay(shown)}><Play size={12} /> Assistir</button>
                <PinButton video={shown} actions={actions} small />
                <PlaylistPicker video={shown} actions={actions} small />
              </VideoRow>
            );
          })}
          {res.next && <button className="btn" style={{ width: '100%', marginTop: 8 }} disabled={busy} onClick={() => run(res.lastQ, res.next)}>Carregar mais</button>}
        </div>
      )}
      {res.lastQ && !busy && !err && res.items.length === 0 && (
        <div className="card empty">
          Nenhum vídeo com todas as palavras.{res.next ? ' Tente “Carregar mais” ou ' : ' Tente '}
          desmarcar <b>Busca precisa</b> ou usar menos palavras.
          {res.next && <div style={{ marginTop: 10 }}><button className="btn" onClick={() => run(res.lastQ, res.next)}>Carregar mais</button></div>}
        </div>
      )}
    </div>
  );
}

// ---------- fixados ----------
function PinnedPanel({ videos, current, onPlay, actions }) {
  const [cat, setCat] = useState('');
  const shown = videos.filter((v) => !cat || (v.category || 'Geral') === cat).slice().reverse();
  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ gap: 6 }}>
          <button className={'btn sm' + (!cat ? ' dark' : '')} onClick={() => setCat('')}>Todos ({videos.length})</button>
          {CATEGORIES.map((c) => {
            const n = videos.filter((v) => (v.category || 'Geral') === c).length;
            return <button key={c} className={'btn sm' + (cat === c ? ' dark' : '')} onClick={() => setCat(c)}>{c} ({n})</button>;
          })}
        </div>
      </div>
      <div className="card" style={{ padding: 8 }}>
        {!shown.length && <div className="empty">Nenhum vídeo fixado{cat ? ' nesta categoria' : ''}. Na busca, clique em <b>Fixar</b>.</div>}
        {shown.map((v) => (
          <VideoRow key={v.id} v={v} active={current?.id === v.id} onPlay={() => onPlay(v)}>
            <span className="tag">{v.category || 'Geral'}</span>
            {v.watched && <span className="tag green">assistido</span>}
            {v.notes && <span className="tag blue">anotado</span>}
            <span className="spacer" />
            <button className="btn sm" onClick={() => actions.unpin(v)} title="Desafixar"><PinOff size={12} /> Desafixar</button>
          </VideoRow>
        ))}
      </div>
      <AddByLink onAdd={(item) => actions.pin(item)} />
    </div>
  );
}

function AddByLink({ onAdd }) {
  const [f, setF] = useState({ title: '', url: '', category: 'Geral' });
  async function submit(e) {
    e.preventDefault();
    if (!youtubeEmbed(f.url)) return alert('Cole um link de vídeo ou playlist do YouTube.');
    await onAdd({ title: f.title.trim() || 'Vídeo do YouTube', url: f.url.trim(), category: f.category });
    setF({ title: '', url: '', category: f.category });
  }
  return (
    <form className="card stack" onSubmit={submit}>
      <h2 style={{ margin: 0 }}><Link2 size={15} style={{ verticalAlign: -2 }} /> Fixar por link (opcional)</h2>
      <input type="url" required placeholder="https://www.youtube.com/watch?v=…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="text" placeholder="Título" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} style={{ width: 'auto' }}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn primary" title="Fixar"><Plus size={16} /></button>
      </div>
    </form>
  );
}

// ---------- playlists ----------
function PlaylistsPanel({ playlists, items, videos, current, setPlaying, actions }) {
  const [openId, setOpenId] = useState(null);
  const [name, setName] = useState('');
  const videoById = Object.fromEntries(videos.map((v) => [v.id, v]));
  const open = playlists.find((p) => p.id === openId);
  const listOf = (pid) => items.filter((i) => i.playlist_id === pid).sort((a, b) => a.position - b.position)
    .map((i) => ({ item: i, video: videoById[i.media_id] })).filter((x) => x.video);

  async function create(e) {
    e.preventDefault();
    const pl = await actions.newPlaylist(name);
    if (pl) { setName(''); setOpenId(pl.id); }
  }

  if (open) {
    const list = listOf(open.id);
    const queue = list.map((x) => x.video);
    const play = (v) => setPlaying({ video: v, queue, playlistName: open.name });
    async function move(idx, d) {
      const a = list[idx], b = list[idx + d];
      if (!a || !b) return;
      await update('tv_playlist_items', a.item.id, { position: idx + d });
      await update('tv_playlist_items', b.item.id, { position: idx });
    }
    async function removeItem(x) {
      await remove('tv_playlist_items', x.item.id);
      const elsewhere = items.some((i) => i.media_id === x.video.id && i.id !== x.item.id);
      if (!elsewhere && x.video.pinned === false) await remove('media_links', x.video.id);
    }
    async function rename() {
      const n = prompt('Novo nome da playlist:', open.name)?.trim();
      if (n) await update('tv_playlists', open.id, { name: n });
    }
    async function del() {
      if (!confirm(`Excluir a playlist “${open.name}”? Os vídeos fixados continuam fixados.`)) return;
      for (const x of list) if (x.video.pinned === false && !items.some((i) => i.media_id === x.video.id && i.playlist_id !== open.id)) await remove('media_links', x.video.id);
      await remove('tv_playlists', open.id);
      setOpenId(null);
    }
    return (
      <div className="stack">
        <div className="card">
          <div className="card-head">
            <button className="btn sm" onClick={() => setOpenId(null)}>← Playlists</button>
            <div className="row">
              <button className="btn sm" onClick={rename}><Pencil size={12} /> Renomear</button>
              <button className="btn sm danger" onClick={del}><Trash2 size={12} /> Excluir</button>
            </div>
          </div>
          <h2 style={{ margin: 0 }}>{open.name}</h2>
          <div className="muted" style={{ marginBottom: 10 }}>{list.length} vídeo(s)</div>
          <button className="btn primary" disabled={!list.length} onClick={() => play(queue[0])}><Play size={14} /> Assistir em sequência</button>
        </div>
        <div className="card" style={{ padding: 8 }}>
          {!list.length && <div className="empty">Playlist vazia. Na busca ou nos fixados, clique em <b>Playlist</b> para adicionar vídeos.</div>}
          {list.map((x, idx) => (
            <VideoRow key={x.item.id} v={x.video} active={current?.id === x.video.id} onPlay={() => play(x.video)}>
              <span className="tag dark">{idx + 1}</span>
              <button className="icon-btn" disabled={idx === 0} title="Subir" onClick={() => move(idx, -1)}><ChevronUp size={15} /></button>
              <button className="icon-btn" disabled={idx === list.length - 1} title="Descer" onClick={() => move(idx, 1)}><ChevronDown size={15} /></button>
              <span className="spacer" />
              <button className="btn sm" onClick={() => removeItem(x)} title="Tirar da playlist"><Trash2 size={12} /> Tirar</button>
            </VideoRow>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <form className="card row" style={{ flexWrap: 'nowrap' }} onSubmit={create}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da nova playlist (ex.: Garras e anexos)" />
        <button className="btn primary" disabled={!name.trim()}><Plus size={16} /> Criar</button>
      </form>
      <div className="card" style={{ padding: 8 }}>
        {!playlists.length && <div className="empty">Nenhuma playlist ainda.</div>}
        {playlists.map((p) => {
          const list = listOf(p.id);
          const thumb = list[0] ? (list[0].video.thumbnail || thumbOf(list[0].video.url)) : '';
          return (
            <button key={p.id} onClick={() => setOpenId(p.id)} className="row" style={{ width: '100%', flexWrap: 'nowrap', textAlign: 'left', padding: 8, border: 0, background: 'none', cursor: 'pointer', borderRadius: 10 }}>
              {thumb ? <img src={thumb} alt="" width="112" height="63" style={{ borderRadius: 6, objectFit: 'cover' }} />
                : <div style={{ width: 112, height: 63, borderRadius: 6, background: 'var(--bg)', display: 'grid', placeItems: 'center' }}><ListVideo size={20} /></div>}
              <div><strong>{p.name}</strong><div className="muted">{list.length} vídeo(s)</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
