import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTable, insert, remove } from '../lib/db.js';
import { missions, missionResult } from '../lib/scoring.js';
import { PageHead, ErrorBox } from '../components/ui.jsx';

const QUADS = [
  { id: 'forcas', label: 'Forças', color: '#1450d8', hint: 'O que o robô/equipe faz bem' },
  { id: 'fraquezas', label: 'Fraquezas', color: '#0b0f19', hint: 'O que precisa melhorar' },
  { id: 'oportunidades', label: 'Oportunidades', color: '#12805c', hint: 'Missões ou ideias a explorar' },
  { id: 'ameacas', label: 'Ameaças', color: '#d92d20', hint: 'Riscos no dia do torneio' },
];

export default function Analise() {
  const logs = useTable('sortie_logs');
  const rounds = useTable('rounds');
  const swot = useTable('swot_items');

  const stats = missions.map((m) => {
    const tests = logs.rows.filter((l) => (l.mission_ids || []).includes(m.id));
    const score = tests.reduce((a, l) => a + (l.worked === 'sim' ? 1 : l.worked === 'parcial' ? 0.5 : 0), 0);
    const pts = rounds.rows.filter((r) => r.values?.values).map((r) => missionResult(r.values, m).total);
    return {
      m, tests: tests.length,
      rate: tests.length ? Math.round((score / tests.length) * 100) : null,
      avgPts: pts.length ? Math.round(pts.reduce((a, b) => a + b, 0) / pts.length) : null,
    };
  });

  return (
    <>
      <PageHead title="Análise do tapete / SWOT" desc="Taxa de sucesso por missão (dos testes de saída) e média de pontos nos rounds." />
      <ErrorBox error={swot.error} />
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Missões do tapete</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Missão</th><th>Testes</th><th style={{ width: '35%' }}>Taxa de sucesso</th><th>Média nos rounds</th></tr></thead>
            <tbody>
              {stats.map(({ m, tests, rate, avgPts }) => (
                <tr key={m.id}>
                  <td><span className="tag dark">M{String(m.id).padStart(2, '0')}</span> {m.name}</td>
                  <td>{tests}</td>
                  <td>{rate === null ? <span className="muted">sem testes</span> : (
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <div className="bar" style={{ flex: 1 }}><div style={{ width: rate + '%', background: rate >= 70 ? '#1450d8' : rate >= 40 ? '#b54708' : '#d92d20' }} /></div>
                      <b style={{ width: 42, textAlign: 'right' }}>{rate}%</b>
                    </div>)}
                  </td>
                  <td>{avgPts === null ? <span className="muted">—</span> : <><b>{avgPts}</b> <span className="muted">/ {m.max}</span></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="swot">
        {QUADS.map((q) => <Quadrant key={q.id} q={q} items={swot.rows.filter((i) => i.quadrant === q.id)} />)}
      </div>
    </>
  );
}

function Quadrant({ q, items }) {
  const [text, setText] = useState('');
  async function add(e) {
    e.preventDefault();
    if (!text.trim()) return;
    await insert('swot_items', { quadrant: q.id, text: text.trim() });
    setText('');
  }
  return (
    <div className="card" style={{ borderTopColor: q.color }}>
      <h2 style={{ marginBottom: 2 }}>{q.label}</h2>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{q.hint}</div>
      <ul>
        {items.map((i) => (
          <li key={i.id}><span>{i.text}</span><button className="icon-btn" onClick={() => remove('swot_items', i.id)}><X size={14} /></button></li>
        ))}
      </ul>
      <form className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }} onSubmit={add}>
        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Adicionar item…" />
        <button className="btn sm"><Plus size={14} /></button>
      </form>
    </div>
  );
}
