import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { useTable } from '../lib/db.js';

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dias = (s) => Math.round((new Date(`${s}T12:00:00`) - new Date(`${ymd(new Date())}T12:00:00`)) / 86400000);
const quando = (n) => (n < 0 ? `atrasada há ${-n} dia${n === -1 ? '' : 's'}` : n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`);

const PRAZO_DIAS = 3;
const TORNEIO_DIAS = 14;

// prazos e eventos que chegam em poucos dias; torneio avisa com mais antecedência
export default function Avisos() {
  const events = useTable('team_events');
  const tasks = useTable('team_tasks');

  const itens = useMemo(() => {
    const lista = [];
    tasks.rows.filter((t) => t.due_date && t.status !== 'done' && dias(t.due_date) <= PRAZO_DIAS)
      .forEach((t) => lista.push({ key: `t${t.id}`, tipo: 'prazo', titulo: t.title, n: dias(t.due_date) }));
    events.rows.forEach((e) => {
      const n = dias(e.event_date);
      if (n >= 0 && n <= (e.kind === 'torneio' ? TORNEIO_DIAS : PRAZO_DIAS)) {
        lista.push({ key: `e${e.id}`, tipo: 'evento', titulo: e.title, n, torneio: e.kind === 'torneio' });
      }
    });
    return lista.sort((a, b) => a.n - b.n);
  }, [events.rows, tasks.rows]);

  if (!itens.length) return null;
  return (
    <div className="card aviso" role="region" aria-label="Avisos de prazos e eventos" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h2><AlertTriangle size={15} style={{ verticalAlign: -2 }} aria-hidden="true" /> Atenção</h2>
        <Link to="/calendario" className="btn sm">Ver calendário</Link>
      </div>
      {itens.slice(0, 5).map((i) => (
        <div key={i.key} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--line)', flexWrap: 'nowrap' }}>
          {i.tipo === 'prazo' ? <ClipboardCheck size={14} aria-hidden="true" /> : <Trophy size={14} aria-hidden="true" />}
          <span className="ellipsis" style={{ flex: 1, fontWeight: 600 }}>{i.titulo}</span>
          <span className={'tag ' + (i.n < 0 ? 'red' : i.n <= 1 ? 'amber' : '')}>
            {i.tipo === 'prazo' ? 'Prazo' : i.torneio ? 'Torneio' : 'Evento'} · {quando(i.n)}
          </span>
        </div>
      ))}
      {itens.length > 5 && <small className="muted">e mais {itens.length - 5} no calendário</small>}
    </div>
  );
}
