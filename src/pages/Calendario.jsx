import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Trophy, ClipboardCheck } from 'lucide-react';
import { useTable, insert, remove } from '../lib/db.js';
import { PageHead, ErrorBox } from '../components/ui.jsx';

const KINDS = { torneio: 'Torneio', reuniao: 'Reunião', treino: 'Treino', data: 'Data comemorativa', outro: 'Outro' };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => new Date(`${s}T12:00:00`);
const longDate = (s) => parse(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const daysUntil = (s) => Math.round((parse(s) - parse(ymd(new Date()))) / 86400000);

export default function Calendario() {
  const events = useTable('team_events');
  const tasks = useTable('team_tasks');
  const hoje = ymd(new Date());
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(hoje);

  // data -> itens do dia (eventos e prazos de tarefas ainda abertas)
  const byDay = useMemo(() => {
    const m = {};
    const put = (d, it) => { (m[d] ||= []).push(it); };
    events.rows.forEach((e) => put(e.event_date, { type: 'evento', id: e.id, title: e.title, kind: e.kind, time: e.event_time?.slice(0, 5) }));
    tasks.rows.filter((t) => t.due_date && t.status !== 'done').forEach((t) => put(t.due_date, { type: 'prazo', id: t.id, title: t.title }));
    return m;
  }, [events.rows, tasks.rows]);

  const proximoTorneio = useMemo(() => events.rows
    .filter((e) => e.kind === 'torneio' && e.event_date >= hoje)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))[0], [events.rows, hoje]);

  const proximos = useMemo(() => Object.entries(byDay)
    .filter(([d]) => d >= hoje).sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([d, list]) => list.map((it) => ({ ...it, date: d }))).slice(0, 6), [byDay, hoje]);

  // grade do mês: começa no domingo da primeira semana
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + i));
  const mover = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <>
      <PageHead title="Calendário" desc="Torneio, reuniões, treinos e os prazos das tarefas do Kanban." />
      <ErrorBox error={events.error || tasks.error} />
      <div className="split">
        <div className="card">
          <div className="card-head">
            <h2 className="cap">{MESES[cursor.getMonth()]} de {cursor.getFullYear()}</h2>
            <div className="row">
              <button className="btn sm" onClick={() => { setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSel(hoje); }}>Hoje</button>
              <button className="icon-btn" aria-label="Mês anterior" title="Mês anterior" onClick={() => mover(-1)}><ChevronLeft size={18} /></button>
              <button className="icon-btn" aria-label="Próximo mês" title="Próximo mês" onClick={() => mover(1)}><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="cal-grid" role="group" aria-label="Dias do mês">
            {DIAS.map((d) => <div key={d} className="cal-dow" aria-hidden="true">{d}</div>)}
            {cells.map((d) => {
              const key = ymd(d);
              const list = byDay[key] || [];
              const fora = d.getMonth() !== cursor.getMonth();
              return (
                <button key={key} data-repetido aria-label={`${d.getDate()} de ${MESES[d.getMonth()]}${list.length ? `, ${list.length} item(ns)` : ''}`}
                  aria-pressed={key === sel}
                  className={'cal-day' + (fora ? ' out' : '') + (key === hoje ? ' today' : '') + (key === sel ? ' sel' : '')}
                  onClick={() => setSel(key)}>
                  <span>{d.getDate()}</span>
                  {list.length > 0 && (
                    <span className="cal-marks">
                      {list.some((i) => i.type === 'evento') && <Trophy size={11} aria-hidden="true" />}
                      {list.some((i) => i.type === 'prazo') && <ClipboardCheck size={11} aria-hidden="true" />}
                      {list.length > 1 && <b>{list.length}</b>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 12, fontSize: 12 }}>
            <span className="muted"><Trophy size={11} /> evento</span>
            <span className="muted"><ClipboardCheck size={11} /> prazo de tarefa</span>
          </div>
        </div>

        <div className="stack">
          {proximoTorneio && <Contagem ev={proximoTorneio} />}
          <Dia dia={sel} itens={byDay[sel] || []} />
          <div className="card">
            <h2>Próximos</h2>
            {!proximos.length && <div className="muted">Nada marcado pela frente.</div>}
            {proximos.map((it) => (
              <button key={`${it.type}-${it.id}`} className="cal-next" onClick={() => { setSel(it.date); setCursor(new Date(parse(it.date).getFullYear(), parse(it.date).getMonth(), 1)); }}>
                <span className="ellipsis" style={{ fontWeight: 600 }}>{it.title}</span>
                <small className="muted">{it.type === 'prazo' ? 'Prazo · ' : `${KINDS[it.kind]} · `}{parse(it.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Contagem({ ev }) {
  const n = daysUntil(ev.event_date);
  return (
    <div className="card kpi">
      <small><Trophy size={12} style={{ verticalAlign: -1 }} /> Próximo torneio</small>
      <strong>{n === 0 ? 'É hoje' : n === 1 ? 'Amanhã' : `${n} dias`}</strong>
      <span>{ev.title} · {parse(ev.event_date).toLocaleDateString('pt-BR')}</span>
    </div>
  );
}

function Dia({ dia, itens }) {
  const [f, setF] = useState({ title: '', kind: 'reuniao', time: '' });
  const [aberto, setAberto] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    await insert('team_events', { title: f.title.trim(), kind: f.kind, event_date: dia, event_time: f.time || null, notes: '' });
    setF({ title: '', kind: 'reuniao', time: '' });
    setAberto(false);
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="cap">{longDate(dia)}</h2>
        {!aberto && <button className="btn sm" onClick={() => setAberto(true)}><Plus size={14} /> Evento</button>}
      </div>
      {!itens.length && !aberto && <div className="muted">Nada neste dia.</div>}
      {itens.map((it) => (
        <div key={`${it.type}-${it.id}`} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap' }}>
          {it.type === 'evento' ? <Trophy size={14} aria-hidden="true" /> : <ClipboardCheck size={14} aria-hidden="true" />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 600 }}>{it.title}</div>
            <small className="muted">{it.type === 'prazo' ? 'Prazo de tarefa' : `${KINDS[it.kind]}${it.time ? ` · ${it.time}` : ''}`}</small>
          </div>
          {it.type === 'evento' && (
            <button className="icon-btn" title="Remover evento" aria-label={`Remover ${it.title}`}
              onClick={() => confirm(`Remover “${it.title}”?`) && remove('team_events', it.id)}><Trash2 size={14} /></button>
          )}
        </div>
      ))}
      {aberto && (
        <form className="stack" style={{ gap: 10 }} onSubmit={add}>
          <input type="text" aria-label="Nome do evento" placeholder="Ex.: Torneio regional" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <select aria-label="Tipo" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="time" aria-label="Horário (opcional)" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
          </div>
          <div className="row">
            <button className="btn primary" disabled={!f.title.trim()}>Salvar</button>
            <button type="button" className="btn" onClick={() => setAberto(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
