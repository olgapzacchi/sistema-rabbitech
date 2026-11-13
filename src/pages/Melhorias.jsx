import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTable, insert, remove } from '../lib/db.js';
import { PageHead, ErrorBox, fmtDate } from '../components/ui.jsx';

const AREAS = ['Robô (estrutura)', 'Anexo / garra', 'Programação', 'Sensores', 'Estratégia', 'Outro'];
const RESULTS = { melhorou: ['Melhorou', 'green'], igual: ['Sem mudança', ''], piorou: ['Piorou', 'red'], testando: ['Em teste', 'amber'] };

export default function Melhorias() {
  const items = useTable('improvements');
  const members = useTable('members');
  const memberMap = Object.fromEntries(members.rows.map((m) => [m.id, m.name]));
  const blank = { area: AREAS[0], title: '', before_text: '', after_text: '', result: 'testando', member_id: '' };
  const [f, setF] = useState(blank);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    await insert('improvements', { ...f, member_id: f.member_id || null });
    setF(blank);
  }
  return (
    <>
      <PageHead title="Registro de melhorias" desc="O que mudou no robô, por quê, e qual foi o resultado — a evolução da equipe." />
      <ErrorBox error={items.error} />
      <div className="split">
        <div className="stack">
          {!items.rows.length && <div className="card empty">Nenhuma melhoria registrada.</div>}
          {items.rows.slice().reverse().map((i) => (
            <div key={i.id} className="card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row">
                  <span className="tag dark">{i.area}</span>
                  <span className={'tag ' + (RESULTS[i.result]?.[1] || '')}>{RESULTS[i.result]?.[0]}</span>
                  <span className="muted">{fmtDate(i.created_at)}{i.member_id && ` · ${memberMap[i.member_id] || ''}`}</span>
                </div>
                <button className="icon-btn" title="Excluir melhoria" aria-label="Excluir melhoria" onClick={() => confirm('Excluir?') && remove('improvements', i.id)}><Trash2 size={15} /></button>
              </div>
              <h3 style={{ fontSize: 16, margin: '8px 0' }}>{i.title}</h3>
              <div className="grid g2">
                <div><div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>ANTES / PROBLEMA</div>{i.before_text || '—'}</div>
                <div><div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>DEPOIS / SOLUÇÃO</div>{i.after_text || '—'}</div>
              </div>
            </div>
          ))}
        </div>
        <form className="card stack sticky" onSubmit={save}>
          <h2 style={{ margin: 0 }}>Nova melhoria</h2>
          <label className="field">Título<input type="text" value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
          <div className="grid g2">
            <label className="field">Área<select value={f.area} onChange={(e) => set('area', e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></label>
            <label className="field">Responsável
              <select value={f.member_id} onChange={(e) => set('member_id', e.target.value)}>
                <option value="">—</option>{members.rows.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <label className="field">Antes / problema<textarea value={f.before_text} onChange={(e) => set('before_text', e.target.value)} /></label>
          <label className="field">Depois / solução<textarea value={f.after_text} onChange={(e) => set('after_text', e.target.value)} /></label>
          <label className="field">Resultado
            <select value={f.result} onChange={(e) => set('result', e.target.value)}>{Object.entries(RESULTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <button className="btn primary"><Plus size={16} /> Registrar</button>
        </form>
      </div>
    </>
  );
}
