import { Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { useTable, remove } from '../lib/db.js';
import { PageHead, Kpi, ErrorBox, fmtDate } from '../components/ui.jsx';

export default function Historico() {
  const rounds = useTable('rounds');
  const strategies = useTable('strategies');
  const stName = Object.fromEntries(strategies.rows.map((s) => [s.id, s.name]));
  const rows = rounds.rows;
  const best = rows.reduce((a, r) => (!a || r.total > a.total ? r : a), null);
  const avg = rows.length ? Math.round(rows.reduce((a, r) => a + (r.total || 0), 0) / rows.length) : 0;
  const last5 = rows.slice(-5);
  const avg5 = last5.length ? Math.round(last5.reduce((a, r) => a + r.total, 0) / last5.length) : 0;
  const chart = rows.map((r, i) => ({ round: i + 1, Pontos: r.total }));

  const perStrategy = Object.entries(rows.reduce((acc, r) => {
    const k = r.strategy_id || '';
    (acc[k] = acc[k] || []).push(r.total);
    return acc;
  }, {})).map(([id, list]) => ({ name: id ? stName[id] || 'Estratégia excluída' : 'Sem estratégia', n: list.length, avg: Math.round(list.reduce((a, b) => a + b, 0) / list.length), best: Math.max(...list) }));

  return (
    <>
      <PageHead title="Histórico" desc="Todos os rounds salvos na calculadora." />
      <ErrorBox error={rounds.error} />
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Kpi label="Melhor round" value={best ? best.total : '—'} hint={best ? fmtDate(best.created_at) : ''} />
        <Kpi label="Média geral" value={avg} hint="pontos" />
        <Kpi label="Média dos últimos 5" value={avg5} hint={avg5 > avg ? '↑ acima da média' : avg5 < avg ? '↓ abaixo da média' : ''} />
        <Kpi label="Quantidade de rounds" value={rows.length} />
      </div>
      <div className="split" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Evolução da pontuação</h2>
          {rows.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chart} margin={{ left: -20, right: 10 }}>
                <CartesianGrid vertical={false} stroke="#e4e8f0" />
                <XAxis dataKey="round" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={(l) => 'Round ' + l} />
                <ReferenceLine y={avg} stroke="#8a94a6" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="Pontos" stroke="#1450d8" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="empty">Salve rounds na calculadora para ver a evolução.</div>}
        </div>
        <div className="card">
          <h2>Por estratégia</h2>
          <table className="table">
            <thead><tr><th>Estratégia</th><th>Rounds</th><th>Média</th><th>Melhor</th></tr></thead>
            <tbody>{perStrategy.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.n}</td><td>{p.avg}</td><td><b>{p.best}</b></td></tr>)}</tbody>
          </table>
          {!perStrategy.length && <div className="empty">—</div>}
        </div>
      </div>
      <div className="card">
        <h2>Rounds</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Data</th><th>Total</th><th>Missões</th><th>Precisão</th><th>Estratégia</th><th>Observações</th><th /></tr></thead>
            <tbody>
              {rows.map((r, i) => ({ r, i })).reverse().map(({ r, i }) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.created_at, true)}</td>
                  <td><b>{r.total}</b> {best && r.id === best.id && <span className="tag blue">melhor</span>}</td>
                  <td>{r.mission_total} <span className="muted">({r.missions_done ?? '—'}/15)</span></td>
                  <td>{r.token_points}</td>
                  <td>{r.strategy_id ? stName[r.strategy_id] || '—' : '—'}</td>
                  <td>{r.notes}</td>
                  <td><button className="icon-btn" onClick={() => confirm('Excluir round?') && remove('rounds', r.id)}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <div className="empty">Nenhum round salvo.</div>}
        </div>
      </div>
    </>
  );
}
