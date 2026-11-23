import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Pencil, Undo2, Eraser, Check, Copy } from 'lucide-react';
import { useTable, insert, update, remove } from '../lib/db.js';
import { missions, missionById, extrasDe, EXTRAS_PONTOS, plannedMissionPoints } from '../lib/scoring.js';
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

  const extras = extrasDe(current);
  const totals = useMemo(() => {
    const sum = (list) => [...new Set(list.flatMap((s) => s.mission_ids || []))].reduce((a, id) => a + plannedMissionPoints(id, extras), 0);
    const fixos = ['tokens', 'inspection', 'm10'].reduce((acc, k) => acc + (extras[k] ? EXTRAS_PONTOS[k] : 0), 0);
    const missoes = sum(mine);
    return { vermelho: sum(mine.filter((s) => s.side === 'vermelho')), azul: sum(mine.filter((s) => s.side === 'azul')), missoes, fixos, total: missoes + fixos };
  }, [mine, extras]); // eslint-disable-line react-hooks/exhaustive-deps
  const temM07 = mine.some((s) => (s.mission_ids || []).includes(7));
  const marcar = (k) => update('strategies', current.id, { extras: { ...extras, [k]: !extras[k] } });

  async function newStrategy() {
    const name = prompt('Nome da nova estratégia:', `Estratégia ${strategies.rows.length + 1}`);
    if (!name) return;
    const st = await insert('strategies', { name, notes: '', plan_b: '' });
    setCurrentId(st.id);
  }
  async function duplicate() {
    if (!current) return;
    const st = await insert('strategies', { name: current.name + ' (cópia)', notes: current.notes, plan_b: current.plan_b, extras: extrasDe(current) });
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
        <select aria-label="Estratégia" value={currentId} onChange={(e) => setCurrentId(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
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
              <div style={{ color: '#b4bccb' }}>Pontuação planejada</div>
              <div className="big">{totals.total}</div>
              <div className="row" style={{ marginTop: 12, gap: 16 }}>
                <div><span className="tag red">Vermelho</span> <b style={{ fontSize: 18, marginLeft: 4 }}>{totals.vermelho}</b></div>
                <div><span className="tag blue">Azul</span> <b style={{ fontSize: 18, marginLeft: 4 }}>{totals.azul}</b></div>
              </div>
              <div style={{ color: '#b4bccb', fontSize: 12, marginTop: 10 }}>Missões planejadas {totals.missoes} + pontos fixos {totals.fixos}. A pontuação máxima de cada missão, sem repetir missão.</div>
              <div className="stack" style={{ gap: 6, marginTop: 12, paddingTop: 12, borderTop: '1px solid #2a3346' }} role="group" aria-label="Pontos fixos">
                {[['tokens', 'Fichas de precisão (6 fichas)', EXTRAS_PONTOS.tokens], ['inspection', 'Inspeção de equipamento', EXTRAS_PONTOS.inspection],
                  ['m10', 'Missão 10 (já começa feita)', EXTRAS_PONTOS.m10]].map(([k, nome, pts]) => (
                  <label key={k} className="cond" style={{ padding: 0, alignItems: 'center', color: '#e6edf6' }}>
                    <input type="checkbox" checked={!!extras[k]} onChange={() => marcar(k)} style={{ accentColor: '#fff' }} />
                    <span>{nome} <b>· +{pts}</b></span>
                  </label>
                ))}
                <label className="cond" style={{ padding: 0, alignItems: 'center', color: '#e6edf6', opacity: temM07 ? 1 : .6 }}>
                  <input type="checkbox" checked={!!extras.shared && temM07} disabled={!temM07} onChange={() => marcar('shared')} style={{ accentColor: '#fff' }} />
                  <span>Missão compartilhada (cooperação da M07) <b>· +{EXTRAS_PONTOS.shared}</b>{!temM07 && <span style={{ fontSize: 12 }}> · coloque a M07 numa saída</span>}</span>
                </label>
              </div>
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
  const toggle = (id) => update('sorties', s.id, { mission_ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] }); // a ordem do clique é a ordem da rota
  const pts = ids.reduce((a, id) => a + (missionById[id]?.max || 0), 0);
  return (
    <div style={{ border: '1px solid var(--line)', borderLeft: `4px solid ${s.color}`, borderRadius: 10, padding: 10 }}>
      <div className="row">
        <input type="text" aria-label="Nome da saída" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== s.name && update('sorties', s.id, { name })} style={{ flex: 1, minWidth: 100 }} />
        <b>{pts} pts</b>
      </div>
      <div className="row" style={{ marginTop: 8, gap: 4 }}>
        {missions.map((m) => (
          <button key={m.id} title={m.name} className={'btn sm' + (ids.includes(m.id) ? ' primary' : '')} style={{ padding: '3px 7px' }} onClick={() => toggle(m.id)}>
            {ids.includes(m.id) && <span style={{ fontSize: 10, opacity: .8, marginRight: 2 }}>{ids.indexOf(m.id) + 1}º</span>}
            M{String(m.id).padStart(2, '0')}
          </button>
        ))}
      </div>
      {ids.length > 0 && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          <b>Rota:</b> Base {s.side === 'azul' ? 'azul' : 'vermelha'} → {ids.map((id) => 'M' + String(id).padStart(2, '0')).join(' → ')} → Base
          {(s.path || []).length > 1
            ? <> · <span className="tag">linha desenhada à mão</span> <button className="btn sm" style={{ padding: '1px 8px' }} onClick={() => update('sorties', s.id, { path: [] })}>Usar rota automática</button></>
            : <> · <span className="tag blue">rota automática</span></>}
        </div>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <button className={'btn sm' + (editing ? ' dark' : '')} onClick={onEdit}><Pencil size={14} /> {editing ? 'Desenhando…' : 'Desenhar à mão'}</button>
        <div className="seg">
          <button className={s.side === 'vermelho' ? 'on' : ''} onClick={() => update('sorties', s.id, { side: 'vermelho' })}>Verm.</button>
          <button className={s.side === 'azul' ? 'on' : ''} onClick={() => update('sorties', s.id, { side: 'azul' })}>Azul</button>
        </div>
        <input type="color" aria-label="Cor da saída" value={s.color} onChange={(e) => update('sorties', s.id, { color: e.target.value })} style={{ width: 32, height: 30, border: 0, background: 'none' }} />
        <span className="spacer" />
        <button className="icon-btn" title="Excluir saída" aria-label="Excluir saída" onClick={() => confirm('Excluir esta saída?') && remove('sorties', s.id)}><Trash2 size={15} /></button>
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

// Posição de cada missão no tapete (fração da imagem tapete.jpg, 1287×640)
const OLD = { 1: [282, 297], 2: [225, 189], 3: [96, 158], 4: [110, 84], 5: [169, 67], 6: [431, 67], 7: [462, 67], 8: [202, 67],
  9: [230, 67], 10: [331, 136], 11: [406, 176], 12: [529, 138], 13: [310, 169], 14: [522, 76], 15: [379, 295] };
export const MISSION_POS = Object.fromEntries(Object.entries(OLD).map(([id, [x, y]]) => [id, [x / 620, (y - 26) / 308]]));
// Áreas de lançamento (bases) de cada lado
const BASE = { vermelho: [0.21, 0.84], azul: [0.79, 0.84] };

// Rota automática: base → missões na ordem escolhida → volta à base
export function autoRoute(s) {
  const pts = (s.mission_ids || []).map((id) => MISSION_POS[id]).filter(Boolean);
  if (!pts.length) return [];
  const base = BASE[s.side] || BASE.vermelho;
  return [base, ...pts, base];
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
  // de qual saída é cada missão (primeira que a escolheu)
  const owner = {};
  sorties.forEach((s) => (s.mission_ids || []).forEach((id, i) => { if (!owner[id]) owner[id] = { s, order: i + 1 }; }));
  const P = ([x, y]) => [x * W, y * H];
  return (
    <div ref={ref} className={'mapbox' + (editing ? ' editing' : '')} onClick={click}>
      <img src="/images/tapete.jpg" alt="Tapete BIOGLOW" draggable={false} />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {sorties.map((s) => {
          const manual = (s.path || []).length > 1;
          const pts = (manual ? s.path : autoRoute(s)).map(P);
          const on = editing === s.id;
          if (pts.length < 2) return null;
          const line = pts.map((p) => p.join(',')).join(' ');
          return (
            <g key={s.id} opacity={editing && !on ? 0.35 : 1}>
              <polyline points={line} fill="none" stroke="#fff" strokeWidth={on ? 12 : 10} strokeLinejoin="round" strokeLinecap="round" opacity=".9" />
              <polyline points={line} fill="none" stroke={s.color} strokeWidth={on ? 7 : 6} strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={manual ? '0' : '16 10'} />
              {manual && pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 0 ? 10 : 6} fill={s.color} stroke="#fff" strokeWidth="3" />)}
              {!manual && <circle cx={pts[0][0]} cy={pts[0][1]} r="12" fill={s.color} stroke="#fff" strokeWidth="3" />}
              <text x={pts[0][0]} y={pts[0][1] - 20} textAnchor="middle" fontSize="22" fontWeight="700" fill="#fff" stroke="#000" strokeWidth="4" paintOrder="stroke">{s.name}</text>
            </g>
          );
        })}
        {/* marcadores das missões: coloridos = planejados, cinza = livres */}
        {Object.entries(MISSION_POS).map(([id, pos]) => {
          const [x, y] = P(pos);
          const o = owner[id];
          return (
            <g key={id} pointerEvents="none">
              <circle cx={x} cy={y} r={o ? 24 : 15} fill={o ? o.s.color : '#0b0f19'} fillOpacity={o ? 1 : 0.35} stroke="#fff" strokeWidth={o ? 4 : 2} />
              <text x={x} y={y + (o ? 8 : 5)} textAnchor="middle" fontSize={o ? 22 : 14} fontWeight="800" fill="#fff">{String(id).padStart(2, '0')}</text>
              {o && (
                <g>
                  <circle cx={x + 20} cy={y - 20} r="12" fill="#fff" stroke={o.s.color} strokeWidth="3" />
                  <text x={x + 20} y={y - 14} textAnchor="middle" fontSize="15" fontWeight="800" fill="#0b0f19">{o.order}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
