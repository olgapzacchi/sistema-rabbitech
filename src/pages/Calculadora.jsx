import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Save } from 'lucide-react';
import { missions, PRECISION, emptyRound, missionResult, scoreRound, extraChecks } from '../lib/scoring.js';
import { useTable, insert } from '../lib/db.js';
import { PageHead } from '../components/ui.jsx';

const MATCH = 150; // 2:30

export default function Calculadora() {
  const strategies = useTable('strategies');
  const [round, setRound] = useState(emptyRound);
  const [strategyId, setStrategyId] = useState('');
  const [notes, setNotes] = useState('');
  const [left, setLeft] = useState(MATCH);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState('');
  const tick = useRef();

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => setLeft((s) => (s <= 1 ? (setRunning(false), 0) : s - 1)), 1000);
    return () => clearInterval(tick.current);
  }, [running]);

  const s = scoreRound(round);
  const setVal = (k, v) => setRound((r) => ({ ...r, values: { ...r.values, [k]: v } }));

  async function save() {
    await insert('rounds', {
      total: s.total, mission_total: s.missionTotal, token_points: s.tokenPoints, inspection_points: s.inspectionPoints,
      missions_done: s.done, values: round, strategy_id: strategyId || null, notes, duration_s: MATCH - left,
    });
    setSaved(`Round salvo com ${s.total} pontos.`);
    setRound(emptyRound()); setNotes(''); setLeft(MATCH); setRunning(false);
    setTimeout(() => setSaved(''), 4000);
  }

  const mm = String(Math.floor(left / 60)), ss = String(left % 60).padStart(2, '0');

  return (
    <>
      <PageHead title="Calculadora de pontos" desc="Marque o que o robô fez no round. Ao salvar, o round vai direto para o histórico." />
      <div className="split">
        <div className="stack">
          {missions.map((m) => {
            const res = missionResult(round, m);
            return (
              <div key={m.id} className="card mission">
                <img src={`/missions/m${m.id}.jpg`} alt="" loading="lazy" />
                <div>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <span className="tag dark">M{String(m.id).padStart(2, '0')}</span>
                    <strong>{m.name}</strong>
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{m.desc}</div>
                  {m.criteria.map((c) => {
                    const k = `m${m.id}_${c.key}`;
                    if (c.count) return (
                      <div key={k} className="cond" style={{ alignItems: 'center' }}>
                        <div className="stepper">
                          <button onClick={() => setVal(k, Math.max(0, (round.values[k] || 0) - 1))}>−</button>
                          <span>{round.values[k] || 0}</span>
                          <button onClick={() => setVal(k, Math.min(3, (round.values[k] || 0) + 1))}>+</button>
                        </div>
                        <span>{c.label}</span>
                      </div>
                    );
                    if (c.choice) return (
                      <div key={k} className="cond">
                        <select aria-label={c.label} value={round.values[k] || 0} onChange={(e) => setVal(k, Number(e.target.value))} style={{ maxWidth: 280 }}>
                          {c.choice.map(([label, pts], i) => <option key={i} value={i}>{label} ({pts} pts)</option>)}
                        </select>
                      </div>
                    );
                    return (
                      <label key={k} className="cond">
                        <input type="checkbox" checked={!!round.values[k]} onChange={(e) => setVal(k, e.target.checked)} />
                        <span>{c.label}{c.points ? <b> · {c.points} pts</b> : null}</span>
                      </label>
                    );
                  })}
                  {m.special === 'architecture' && (
                    <div className="cond">
                      <span>Dock da arquitetura:</span>
                      <select aria-label="Dock da arquitetura" value={round.dock15} onChange={(e) => setRound((r) => ({ ...r, dock15: e.target.value }))} style={{ width: 'auto' }}>
                        <option value="mine">Mina</option><option value="city">Cidade</option><option value="farm">Fazenda</option>
                      </select>
                    </div>
                  )}
                  {extraChecks(m).map(([k, label]) => (
                    <label key={k} className="cond muted">
                      <input type="checkbox" checked={!!round.values[k]} onChange={(e) => setVal(k, e.target.checked)} />
                      <span>{label}</span>
                    </label>
                  ))}
                  {res.reason && <span className="tag red">{res.reason}</span>}
                </div>
                <div className="pts"><strong>{res.total}</strong><div className="muted">de {m.max}</div></div>
              </div>
            );
          })}
        </div>

        <div className="stack sticky">
          <div className="score-box">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#b4bccb' }}>Pontuação</div>
                <div className="big">{s.total}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="timer" style={{ color: left <= 30 ? '#ff8a80' : '#fff' }}>{mm}:{ss}</div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn sm" onClick={() => setRunning((r) => !r)}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Pausar' : 'Iniciar'}</button>
                  <button className="btn sm" title="Zerar cronômetro" aria-label="Zerar cronômetro" onClick={() => { setRunning(false); setLeft(MATCH); }}><RotateCcw size={14} /></button>
                </div>
              </div>
            </div>
            <div style={{ color: '#b4bccb', marginTop: 10, fontSize: 13 }}>
              Missões {s.missionTotal} · precisão {s.tokenPoints} · inspeção {s.inspectionPoints} · {s.done}/15 missões
            </div>
          </div>

          <div className="card">
            <h2>Fichas de precisão restantes</h2>
            <div className="row">
              {PRECISION.map((p, n) => (
                <button key={n} className={'btn sm' + (round.tokens === n ? ' primary' : '')} onClick={() => setRound((r) => ({ ...r, tokens: n }))}>
                  {n} <span style={{ opacity: .7, fontWeight: 500 }}>· {p}</span>
                </button>
              ))}
            </div>
            <label className="cond" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={round.inspection} onChange={(e) => setRound((r) => ({ ...r, inspection: e.target.checked }))} />
              <span>Inspeção de equipamento aprovada (+20)</span>
            </label>
          </div>

          <div className="card stack">
            <label className="field">Estratégia usada
              <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
                <option value="">— não informar —</option>
                {strategies.rows.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </label>
            <label className="field">Observações do round<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
            <div className="row">
              <button className="btn primary" onClick={save}><Save size={16} /> Salvar round</button>
              <button className="btn" onClick={() => setRound(emptyRound())}>Limpar</button>
            </div>
            {saved && <span className="tag green">{saved}</span>}
          </div>
        </div>
      </div>
    </>
  );
}
