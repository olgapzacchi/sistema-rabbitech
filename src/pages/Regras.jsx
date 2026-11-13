import { useState } from 'react';
import { Upload, Trash2, ExternalLink, FileText } from 'lucide-react';
import { useTable, insert, remove, uploadFile, isCloud } from '../lib/db.js';
import { PageHead, ErrorBox, fmtDate } from '../components/ui.jsx';

const KINDS = { regras: 'Caderno de regras do desafio', montagem: 'Passo a passo da montagem do tapete', outro: 'Outros documentos' };

export default function Regras() {
  const docs = useTable('documents');
  const [view, setView] = useState(null);
  const [f, setF] = useState({ kind: 'regras', title: '', url: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const url = file ? await uploadFile(file) : f.url.trim();
      if (!url) return alert('Envie um arquivo ou cole um link.');
      const row = await insert('documents', { kind: f.kind, title: f.title.trim() || file?.name || 'Documento', url });
      setView(row);
      setF({ ...f, title: '', url: '' }); setFile(null); e.target.reset();
    } catch (err) {
      alert('Falha no envio: ' + err.message);
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="Regras" desc="Caderno de regras do desafio e passo a passo da montagem do tapete, sempre à mão." />
      <ErrorBox error={docs.error} />
      <div className="split">
        <div className="stack">
          {view && (
            <div className="card">
              <div className="card-head">
                <h2>{view.title}</h2>
                <div className="row">
                  <a className="btn sm" href={view.url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir</a>
                  <button className="btn sm" onClick={() => setView(null)}>Fechar</button>
                </div>
              </div>
              <iframe className="embed" src={view.url} title={view.title} style={{ height: '75vh', background: '#fff', border: '1px solid var(--line)' }} />
            </div>
          )}
          {Object.entries(KINDS).map(([k, label]) => {
            const list = docs.rows.filter((d) => d.kind === k);
            return (
              <div key={k} className="card">
                <h2>{label}</h2>
                {!list.length && <div className="muted">Nenhum documento anexado.</div>}
                {list.map((d) => (
                  <div key={d.id} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap' }}>
                    <FileText size={18} color="#1450d8" />
                    <button className="nav-link" style={{ color: 'var(--ink)', padding: 0, flex: 1 }} onClick={() => setView(d)}>{d.title}</button>
                    <span className="muted" style={{ fontSize: 12 }}>{fmtDate(d.created_at)}</span>
                    <button className="icon-btn" title="Remover documento" aria-label="Remover documento" onClick={() => confirm('Remover documento?') && remove('documents', d.id)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <form className="card stack sticky" onSubmit={add}>
          <h2 style={{ margin: 0 }}>Anexar documento</h2>
          <label className="field">Tipo
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <label className="field">Título<input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="field">Arquivo (PDF ou imagem)<input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
          <label className="field">…ou link<input type="url" placeholder="https://…" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} disabled={!!file} /></label>
          {!isCloud && <small className="muted">Modo local: arquivos enviados só ficam disponíveis até fechar a aba. Links ficam salvos.</small>}
          <button className="btn primary" disabled={busy}><Upload size={16} /> {busy ? 'Enviando…' : 'Anexar'}</button>
        </form>
      </div>
    </>
  );
}
