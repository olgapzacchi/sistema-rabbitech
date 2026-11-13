import { useMemo, useState } from 'react';
import { Search, Plus, Trash2, Play, Check, BookmarkPlus, Loader2, Link2 } from 'lucide-react';
import { useTable, insert, update, remove, isCloud, supabase } from '../lib/db.js';
import { PageHead, ErrorBox, fmtDate } from '../components/ui.jsx';
import { youtubeEmbed } from './MediaPage.jsx';

export const CATEGORIES = ['Robô', 'Programação', 'Projeto de Inovação', 'Core Values', 'Regras e desafio', 'Geral'];

export function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/);
    return m ? m[2] : u.searchParams.get('v');
  } catch { return null; }
}
const thumbOf = (url) => { const id = youtubeId(url); return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : ''; };

async function searchYoutube(q, pageToken) {
  const { data, error } = await supabase.functions.invoke('youtube-search', { body: { q, pageToken } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return data;
}

export default function TV() {
  const media = useTable('media_links');
  const videos = media.rows.filter((m) => m.kind === 'youtube');
  const [tab, setTab] = useState('lista');
  const [cat, setCat] = useState('');
  const [currentId, setCurrentId] = useState(null);
  const [preview, setPreview] = useState(null); // vídeo da busca ainda não salvo

  const shown = videos.filter((v) => !cat || (v.category || 'Geral') === cat).slice().reverse();
  const current = preview || videos.find((v) => v.id === currentId) || shown[0] || null;
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c, videos.filter((v) => (v.category || 'Geral') === c).length])), [videos]);

  async function save(item, category) {
    const row = await insert('media_links', {
      kind: 'youtube', title: item.title, url: item.url, category,
      channel: item.channel || '', thumbnail: item.thumbnail || thumbOf(item.url), notes: '', watched: false,
    });
    setPreview(null); setCurrentId(row.id);
    return row;
  }

  return (
    <>
      <PageHead title="Rabbitech TV" desc="Busque vídeos, organize por tema e anote o que a equipe aprendeu.">
        <div className="seg">
          <button className={tab === 'lista' ? 'on' : ''} onClick={() => setTab('lista')}>Nossa lista ({videos.length})</button>
          <button className={tab === 'busca' ? 'on' : ''} onClick={() => setTab('busca')}><Search size={14} style={{ verticalAlign: -2 }} /> Buscar no YouTube</button>
        </div>
      </PageHead>
      <ErrorBox error={media.error} />

      <div className="split">
        <Player video={current} isPreview={!!preview} onSave={(c) => save(preview, c)} />

        {tab === 'lista' ? (
          <div className="stack">
            <div className="card">
              <div className="row" style={{ gap: 6 }}>
                <button className={'btn sm' + (!cat ? ' dark' : '')} onClick={() => setCat('')}>Todas ({videos.length})</button>
                {CATEGORIES.map((c) => (
                  <button key={c} className={'btn sm' + (cat === c ? ' dark' : '')} onClick={() => setCat(c)}>{c} ({counts[c]})</button>
                ))}
              </div>
            </div>
            <div className="card" style={{ padding: 10 }}>
              {!shown.length && <div className="empty">Nenhum vídeo{cat ? ' nesta categoria' : ''}. Use “Buscar no YouTube” ou cole um link abaixo.</div>}
              {shown.map((v) => (
                <VideoRow key={v.id} v={v} active={!preview && current?.id === v.id} onPlay={() => { setPreview(null); setCurrentId(v.id); }} />
              ))}
            </div>
            <AddByLink onAdd={(item, c) => save(item, c)} />
          </div>
        ) : (
          <SearchPanel onPreview={setPreview} onSave={save} savedUrls={new Set(videos.map((v) => youtubeId(v.url)))} />
        )}
      </div>
    </>
  );
}

function Player({ video, isPreview, onSave }) {
  const [saveCat, setSaveCat] = useState('Geral');
  if (!video) return <div className="card empty">Escolha um vídeo para assistir.</div>;
  const src = youtubeEmbed(video.url);
  return (
    <div className="card stack sticky">
      {src
        ? <iframe key={video.url} className="embed" src={src} style={{ aspectRatio: '16 / 9' }} title={video.title}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
        : <div className="empty">Link de vídeo inválido.</div>}
      <div>
        <h2 style={{ margin: 0 }}>{video.title}</h2>
        {video.channel && <span className="muted">{video.channel}</span>}
      </div>
      {isPreview ? (
        <div className="row">
          <select value={saveCat} onChange={(e) => setSaveCat(e.target.value)} style={{ width: 'auto' }}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button className="btn primary" onClick={() => onSave(saveCat)}><BookmarkPlus size={16} /> Salvar na nossa lista</button>
        </div>
      ) : <VideoDetails key={video.id} v={video} />}
    </div>
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
        <span className="spacer" />
        <button className="btn sm danger" onClick={() => confirm('Remover este vídeo da lista?') && remove('media_links', v.id)}><Trash2 size={14} /> Remover</button>
      </div>
      <label className="field">O que aprendemos com este vídeo
        <textarea rows={5} value={notes} placeholder="Ex.: ideia de garra para a M09, dica de calibração do giroscópio…"
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (v.notes || '') && update('media_links', v.id, { notes })} />
      </label>
      <small className="muted">A anotação é salva quando você clica fora da caixa. Adicionado em {fmtDate(v.created_at)}.</small>
    </>
  );
}

function VideoRow({ v, active, onPlay }) {
  const thumb = v.thumbnail || thumbOf(v.url);
  return (
    <button onClick={onPlay} className="row" style={{
      width: '100%', flexWrap: 'nowrap', textAlign: 'left', padding: 8, borderRadius: 10, cursor: 'pointer',
      border: '1px solid ' + (active ? 'var(--blue)' : 'transparent'), background: active ? 'var(--blue-2)' : 'none',
    }}>
      {thumb ? <img src={thumb} alt="" width="96" height="54" style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
        : <div style={{ width: 96, height: 54, borderRadius: 6, background: 'var(--bg)', display: 'grid', placeItems: 'center' }}><Play size={18} /></div>}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.title}</div>
        <div className="row" style={{ gap: 4, marginTop: 2 }}>
          <span className="tag">{v.category || 'Geral'}</span>
          {v.watched && <span className="tag green">assistido</span>}
          {v.notes && <span className="tag blue">anotado</span>}
        </div>
      </div>
    </button>
  );
}

function AddByLink({ onAdd }) {
  const [f, setF] = useState({ title: '', url: '', category: 'Geral' });
  async function submit(e) {
    e.preventDefault();
    if (!youtubeEmbed(f.url)) return alert('Cole um link de vídeo ou playlist do YouTube.');
    await onAdd({ title: f.title.trim() || 'Vídeo do YouTube', url: f.url.trim() }, f.category);
    setF({ title: '', url: '', category: f.category });
  }
  return (
    <form className="card stack" onSubmit={submit}>
      <h2 style={{ margin: 0 }}><Link2 size={15} style={{ verticalAlign: -2 }} /> Adicionar por link</h2>
      <input type="url" required placeholder="https://www.youtube.com/watch?v=…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="text" placeholder="Título" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} style={{ width: 'auto' }}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn primary"><Plus size={16} /></button>
      </div>
    </form>
  );
}

const SUGGESTIONS = ['FLL robot game', 'SPIKE Prime tutorial', 'LEGO robot attachment ideas', 'FIRST LEGO League Core Values', 'Pybricks line following'];

function SearchPanel({ onPreview, onSave, savedUrls }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cat, setCat] = useState('Geral');

  async function run(query, pageToken) {
    if (!isCloud) { setErr('A busca funciona só com o Supabase configurado.'); return; }
    setBusy(true); setErr('');
    try {
      const data = await searchYoutube(query, pageToken);
      const found = (data.items || []).map((v) => ({ ...v, title: decode(v.title), channel: decode(v.channel) }));
      setItems((old) => (pageToken ? [...old, ...found] : found));
      setNext(data.nextPageToken);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  const submit = (e) => { e.preventDefault(); if (q.trim().length >= 2) run(q.trim()); };

  return (
    <div className="stack">
      <form className="card stack" onSubmit={submit}>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no YouTube…" autoFocus />
          <button className="btn primary" disabled={busy}>{busy ? <Loader2 size={16} className="spin" /> : <Search size={16} />}</button>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {SUGGESTIONS.map((s) => <button type="button" key={s} className="btn sm" onClick={() => { setQ(s); run(s); }}>{s}</button>)}
        </div>
        <label className="field">Salvar na categoria
          <select value={cat} onChange={(e) => setCat(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
      </form>
      {err && <div className="error" style={{ margin: 0 }}>{err}</div>}
      {items.length > 0 && (
        <div className="card" style={{ padding: 10 }}>
          {items.map((v) => {
            const saved = savedUrls.has(v.id);
            return (
              <div key={v.id} className="row" style={{ flexWrap: 'nowrap', padding: 8, borderBottom: '1px solid var(--line)' }}>
                <img src={v.thumbnail} alt="" width="120" height="68" style={{ borderRadius: 6, objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }} onClick={() => onPreview(v)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{v.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{v.channel}</div>
                  <div className="row" style={{ gap: 4, marginTop: 4 }}>
                    <button className="btn sm" onClick={() => onPreview(v)}><Play size={12} /> Assistir</button>
                    <button className="btn sm" disabled={saved} onClick={() => onSave(v, cat)}>
                      {saved ? <><Check size={12} /> Salvo</> : <><BookmarkPlus size={12} /> Salvar</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {next && <button className="btn" style={{ width: '100%', marginTop: 8 }} disabled={busy} onClick={() => run(q, next)}>Carregar mais</button>}
        </div>
      )}
    </div>
  );
}

// A API do YouTube devolve títulos com entidades HTML (&amp;, &#39;…); converte para texto puro
function decode(text = '') {
  return new DOMParser().parseFromString(String(text), 'text/html').documentElement.textContent || '';
}
