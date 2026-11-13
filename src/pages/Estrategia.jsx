import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Pencil, Undo2, Eraser, Check, Copy } from 'lucide-react';
import { useTable, insert, update, remove } from '../lib/db.js';
import { missions, missionById } from '../lib/scoring.js';
import { PageHead, ErrorBox } from '../components/ui.jsx';

const COLORS = ['#1450d8', '#f59e0b', '#e11d48', '#10b981', '#8b5cf6', '#06b6d4', '#f97316', '#0b0f19'];
const SIDES = { vermelho: { label: 'Lado vermelho', cls: 'red' }, azul: { label: 'Lado azul', cls: 'blue' } };

export default function Estrategia() {
  const strategies = useTable('strategies');
  const sorties = useTable('sorties');
  const [currentId, setCurrentId] = useState('');
  const [editing, setEditing] = useState(null); // id da saída com linha em edição

  useEffect(() => {
    if (!currentId && strategies.rows.length) setCurrentId(strategies.rows[0].id);
    if (currentId && strategies.rows.length && !strategies.rows.some((s) => s.id === currentId)) setCurrentId(strategies.rows[0].id);
  }, [strategies.rows, currentId]);

  const current = strategies.rows.find((s) => s.id === currentId);
  const mine = sorties.rows
    .filter((s) => s.strategy_id === currentId)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const totals = useMemo(() => {
    const sum = (list) => [...new Set(list.flatMap((s) => s.mission_ids || []))].reduce((a, id) => a + (missionById[id]?.max || 0), 0);
    return { vermelho: sum(mine.filter((s) => s.side === 'vermelho')), azul: sum(mine.filter((s) => s.side === 'azul')), total: sum(mine) };
  }, [mine]);

  async function newStrategy() {
    const name = prompt('Nome da nova estratégia:', `Estratégia ${strategies.rows.length + 1}`);
    if (!name) return;
    const st = await insert('strategies', { name, notes: '', plan_b: '' });
    setCurrentId(st.id);
  }
  async function duplicate() {
    if (!current) return;
    const st = await insert('strategies', { name: current.name + ' (cópia)', notes: current.notes, plan_b: current.plan_b });
    for (const s of mine) {
      await insert('sorties', { ...s, strategy_id: st.id }); // id/datas são gerados pelo banco
    }
    setCurrentId(st.id);
  }
  async function delStrategy() {
    if (!current || !confirm(`Excluir "${current.name}" e suas saídas?`)) return;
    for (const s of mine) await remove('sorties', s.id);
    await remove('strategies', current.id);
  }
  async function addSortie(side) {
    const s = await insert('sorties', {
      strategy_id: currentId, name: `Saída ${mine.length + 1}`, side, mission_ids: [], path: [],
      color: COLORS[mine.length % COLORS.length], order_index: mine.length,
    });
    setEditing(s.id);
  }

  return (
    <>
      <PageHead title="Estratégia da equipe" desc="Desenhe as saídas no tapete, separe por lado e veja a pontuação planejada.">
        <select value={currentId} onChange={(e) => setCurrentId(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
          {strategies.rows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="btn" onClick={duplicate} title="Duplicar"><Copy size={16} /></button>
        <button className="btn primary" onClick={newStrategy}><Plus size={16} /> Nova estratégia</button>
      </PageHead>
      <ErrorBox error={strategies.error || sorties.error} />

      {!current ? <div className="card empty">Crie a primeira estratégia para começar.</div> : (
        <div className="split">
          <div className="stack">
            <div className="card">
              <div className="card-head">
                <h2>Mapa do tapete</h2>
                {editing && (
                  <div className="row">
                    <span className="tag blue">Clique no mapa para desenhar a linha de “{mine.find((s) => s.id === editing)?.name}”</span>
                    <PathTools sortie={mine.find((s) => s.id === editing)} />
                    <button className="btn sm dark" onClick={() => setEditing(null)}><Check size={14} /> Concluir</button>
                  </div>
                )}
              </div>
              <MatMap sorties={mine} editing={editing} />
            </div>

            <div className="grid g2">
              {Object.entries(SIDES).map(([side, info]) => (
                <div key={side} className="card">
                  <div className="card-head">
                    <h2><span className={'tag ' + info.cls}>{info.label}</span></h2>
                    <button className="btn sm" onClick={() => addSortie(side)}><Plus size={14} /> Saída</button>
                  </div>
                  {mine.filter((s) => s.side === side).length === 0 && <div className="empty">Nenhuma saída neste lado.</div>}
                  <div className="stack" style={{ gap: 10 }}>
                    {mine.filter((s) => s.side === side).map((s) => (
                      <SortieCard key={s.id} s={s} editing={editing === s.id} onEdit={() => setEditing(editing === s.id ? null : s.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="stack sticky">
            <div className="score-box">
              <div style={{ color: '#9aa4b8' }}>Pontuação planejada</div>
              <div className="big">{totals.total}</div>
              <div className="row" style={{ marginTop: 12, gap: 16 }}>
                <div><span className="tag red">Vermelho</span> <b style={{ fontSize: 18, marginLeft: 4 }}>{totals.vermelho}</b></div>
                <div><span className="tag blue">Azul</span> <b style={{ fontSize: 18, marginLeft: 4 }}>{totals.azul}</b></div>
              </div>
              <div style={{ color: '#9aa4b8', fontSize: 12, marginTop: 10 }}>Soma da pontuação máxima das missões planejadas (sem repetir missão).</div>
            </div>
            <StrategyInfo key={current.id} st={current} onDelete={delStrategy} />
          </div>
        </div>
      )}
    </>
  );
}

function StrategyInfo({ st, onDelete }) {
  const [f, setF] = useState({ name: st.name, notes: st.notes || '', plan_b: st.plan_b || '' });
  const save = (k) => f[k] !== (st[k] || '') && update('strategies', st.id, { [k]: f[k] });
  return (
    <div className="card stack">
      <label className="field">Nome<input type="text" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onBlur={() => save('name')} /></label>
      <label className="field">Observações<textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} onBlur={() => save('notes')} /></label>
      <label className="field">Planos B<textarea value={f.plan_b} onChange={(e) => setF({ ...f, plan_b: e.target.value })} onBlur={() => save('plan_b')} /></label>
      <div><button className="btn sm danger" onClick={onDelete}><Trash2 size={14} /> Excluir estratégia</button></div>
    </div>
  );
}

function SortieCard({ s, editing, onEdit }) {
  const [name, setName] = useState(s.name);
  const ids = s.mission_ids || [];
  const toggle = (id) => update('sorties', s.id, { mission_ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].sort((a, b) => a - b) });
  const pts = ids.reduce((a, id) => a + (missionById[id]?.max || 0), 0);
  return (
    <div style={{ border: '1px solid var(--line)', borderLeft: `4px solid ${s.color}`, borderRadius: 10, padding: 10 }}>
      <div className="row">
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== s.name && update('sorties', s.id, { name })} style={{ flex: 1, minWidth: 100 }} />
        <b>{pts} pts</b>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 4 }}>
        {missions.map((m) => (
          <button key={m.id} title={m.name} className={'btn sm' + (ids.includes(m.id) ? ' primary' : '')} style={{ padding: '3px 7px' }} onClick={() => toggle(m.id)}>
            M{String(m.id).padStart(2, '0')}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className={'btn sm' + (editing ? ' dark' : '')} onClick={onEdit}><Pencil size={14} /> {editing ? 'Desenhando…' : 'Desenhar linha'}</button>
        <div className="seg">
          <button className={s.side === 'vermelho' ? 'on' : ''} onClick={() => update('sorties', s.id, { side: 'vermelho' })}>Verm.</button>
          <button className={s.side === 'azul' ? 'on' : ''} onClick={() => update('sorties', s.id, { side: 'azul' })}>Azul</button>
        </div>
        <input type="color" value={s.color} onChange={(e) => update('sorties', s.id, { color: e.target.value })} style={{ width: 32, height: 30, border: 0, background: 'none' }} />
        <span className="spacer" />
        <button className="icon-btn" onClick={() => confirm('Excluir esta saída?') && remove('sorties', s.id)}><Trash2 size={15} /></button>
      </div>
    </div>
  );
}

function PathTools({ sortie }) {
  if (!sortie) return null;
  const path = sortie.path || [];
  return (
    <>
      <button className="btn sm" disabled={!path.length} onClick={() => update('sorties', sortie.id, { path: path.slice(0, -1) })}><Undo2 size={14} /> Desfazer</button>
      <button className="btn sm" disabled={!path.length} onClick={() => update('sorties', sortie.id, { path: [] })}><Eraser size={14} /> Limpar</button>
    </>
  );
}

function MatMap({ sorties, editing }) {
  const ref = useRef();
  const W = 1287, H = 640;
  function click(e) {
    if (!editing) return;
    const s = sorties.find((x) => x.id === editing);
    if (!s) return;
    const r = ref.current.getBoundingClientRect();
    const pt = [+((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)];
    update('sorties', s.id, { path: [...(s.path || []), pt] });
  }
  return (
    <div ref={ref} className={'mapbox' + (editing ? ' editing' : '')} onClick={click}>
      <img src="/tapete.jpg" alt="Tapete BIOGLOW" draggable={false} />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {sorties.map((s) => {
          const pts = (s.path || []).map(([x, y]) => [x * W, y * H]);
          const on = editing === s.id;
          return (
            <g key={s.id} opacity={editing && !on ? 0.45 : 1}>
              {pts.length > 1 && <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth={on ? 12 : 10} strokeLinejoin="round" strokeLinecap="round" />}
              {pts.length > 1 && <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={on ? 7 : 6} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={on ? '0' : '18 10'} />}
              {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 0 ? 11 : 7} fill={s.color} stroke="#fff" strokeWidth="3" />)}
              {pts[0] && <text x={pts[0][0]} y={pts[0][1] - 18} textAnchor="middle" fontSize="22" fontWeight="700" fill="#fff" stroke="#000" strokeWidth="4" paintOrder="stroke">{s.name}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
