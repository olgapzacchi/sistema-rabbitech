import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTable, insert, remove } from '../lib/db.js';
import { missions, missionById } from '../lib/scoring.js';
import { PageHead, ErrorBox, fmtDate, fmtSecs } from '../components/ui.jsx';

const WORKED = { sim: ['Funcionou', 'green'], parcial: ['Parcial', 'amber'], nao: ['Não funcionou', 'red'] };

export default function Saidas() {
  const logs = useTable('sortie_logs');
  const sorties = useTable('sorties');
  const strategies = useTable('strategies');
  const members = useTable('members');
  const [f, setF] = useState({ sortie_id: '', mission_ids: [], worked: 'sim', time_s: '', notes: '', member_id: '' });
  const [filter, setFilter] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const stName = Object.fromEntries(strategies.rows.map((s) => [s.id, s.name]));
  const sortieMap = Object.fromEntries(sorties.rows.map((s) => [s.id, s]));
  const memberMap = Object.fromEntries(members.rows.map((m) => [m.id, m.name]));

  function pickSortie(id) {
    const s = sortieMap[id];
    setF((x) => ({ ...x, sortie_id: id, mission_ids: s ? [...(s.mission_ids || [])] : x.mission_ids }));
  }
  const toggle = (id) => set('mission_ids', f.mission_ids.includes(id) ? f.mission_ids.filter((x) => x !== id) : [...f.mission_ids, id].sort((a, b) => a - b));

  async function save(e) {
    e.preventDefault();
    if (!f.mission_ids.length) return alert('Escolha ao menos uma missão.');
    if (f.time_s !== '' && (Number(f.time_s) < 0 || Number(f.time_s) > 150)) {
      return alert('O tempo gasto é em segundos e vai de 0 a 150 (um round inteiro tem 2:30 = 150 s). Ex.: 23.5');
    }
    await insert('sortie_logs', { ...f, sortie_id: f.sortie_id || null, member_id: f.member_id || null, time_s: f.time_s === '' ? null : Number(f.time_s) });
    setF((x) => ({ ...x, notes: '', time_s: '' }));
  }

  const shown = logs.rows.filter((l) => !filter || (l.mission_ids || []).includes(Number(filter))).slice().reverse();

  return (
    <>
      <PageHead title="Registro de saídas" desc="Cada teste de saída do robô: quais missões, se funcionou, tempo gasto e observações." />
      <ErrorBox error={logs.error} />
      <div className="split">
        <div className="card">
          <div className="card-head">
            <h2>Testes registrados ({logs.rows.length})</h2>
            <select aria-label="Filtrar por missão" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Todas as missões</option>
              {missions.map((m) => <option key={m.id} value={m.id}>M{String(m.id).padStart(2, '0')} · {m.name}</option>)}
            </select>
          </div>
          <div className="table-wrap" tabIndex={0}>
            <table className="table">
              <thead><tr><th>Data</th><th>Missões</th><th>Resultado</th><th>Tempo</th><th>Observação</th><th /></tr></thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.created_at, true)}
                      {l.sortie_id && sortieMap[l.sortie_id] && <div className="muted" style={{ fontSize: 12 }}>{sortieMap[l.sortie_id].name} · {stName[sortieMap[l.sortie_id].strategy_id]}</div>}
                    </td>
                    <td><div className="row" style={{ gap: 4 }}>{(l.mission_ids || []).map((id) => <span key={id} className="tag" title={missionById[id]?.name}>M{String(id).padStart(2, '0')}</span>)}</div></td>
                    <td><span className={'tag ' + WORKED[l.worked]?.[1]}>{WORKED[l.worked]?.[0]}</span></td>
                    <td>{fmtSecs(l.time_s)}</td>
                    <td>{l.notes}{l.member_id && <div className="muted" style={{ fontSize: 12 }}>por {memberMap[l.member_id]}</div>}</td>
                    <td><button className="icon-btn" title="Excluir registro" aria-label="Excluir registro" onClick={() => confirm('Excluir registro?') && remove('sortie_logs', l.id)}><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!shown.length && <div className="empty">Nenhum teste registrado ainda.</div>}
          </div>
        </div>

        <form className="card stack sticky" onSubmit={save}>
          <h2 style={{ margin: 0 }}>Novo teste</h2>
          <label className="field">Saída da estratégia (opcional)
            <select value={f.sortie_id} onChange={(e) => pickSortie(e.target.value)}>
              <option value="">— avulsa —</option>
              {sorties.rows.map((s) => <option key={s.id} value={s.id}>{s.name} · {stName[s.strategy_id] || ''}</option>)}
            </select>
          </label>
          <div className="field">Quais missões
            <div className="row" style={{ gap: 4, marginTop: 4 }}>
              {missions.map((m) => (
                <button type="button" key={m.id} title={m.name} className={'btn sm' + (f.mission_ids.includes(m.id) ? ' primary' : '')} style={{ padding: '3px 7px' }} onClick={() => toggle(m.id)}>
                  M{String(m.id).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
          <div className="field">Funcionou?
            <div className="seg" style={{ marginTop: 4 }}>
              {Object.entries(WORKED).map(([k, [label]]) => <button type="button" key={k} className={f.worked === k ? 'on' : ''} onClick={() => set('worked', k)}>{label}</button>)}
            </div>
          </div>
          <div className="grid g2">
            <label className="field">Tempo gasto (s)<input type="number" min="0" max="150" step="0.1" placeholder="ex.: 23.5" value={f.time_s} onChange={(e) => set('time_s', e.target.value)} /></label>
            <label className="field">Quem testou
              <select value={f.member_id} onChange={(e) => set('member_id', e.target.value)}>
                <option value="">—</option>
                {members.rows.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <label className="field">Observação (opcional)<textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></label>
          <button className="btn primary"><Plus size={16} /> Registrar teste</button>
        </form>
      </div>
    </>
  );
}
