import { useMemo, useState } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts';
import { useTable, insert, update, remove } from '../lib/db.js';
import { PageHead, Kpi, ErrorBox, initials, fmtDate } from '../components/ui.jsx';

const COLS = [
  { id: 'todo', label: 'A fazer', dot: '#8a94a6' },
  { id: 'doing', label: 'Fazendo', dot: '#1450d8' },
  { id: 'done', label: 'Concluído', dot: '#12805c' },
];

function weekStart(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export default function Inicio() {
  const tasks = useTable('team_tasks');
  const members = useTable('members');
  const rounds = useTable('rounds');
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');
  const [dragOver, setDragOver] = useState(null);

  const memberMap = useMemo(() => Object.fromEntries(members.rows.map((m) => [m.id, m])), [members.rows]);
  const groups = useMemo(() => [...new Set(members.rows.map((m) => m.group_name).filter(Boolean))], [members.rows]);

  const visible = tasks.rows.filter((t) => !filter || (t.assignee_ids || []).includes(filter));
  const done = tasks.rows.filter((t) => t.status === 'done');
  const thisWeek = done.filter((t) => t.completed_at && new Date(t.completed_at) >= weekStart(new Date()));
  const overdue = tasks.rows.filter((t) => t.status !== 'done' && t.due_date && new Date(t.due_date + 'T23:59') < new Date());
  const best = rounds.rows.reduce((a, r) => Math.max(a, r.total || 0), 0);

  // Produtividade por aluno
  const perMember = members.rows.map((m) => {
    const mine = tasks.rows.filter((t) => (t.assignee_ids || []).includes(m.id));
    return {
      nome: m.name,
      Concluídas: mine.filter((t) => t.status === 'done').length,
      'Em andamento': mine.filter((t) => t.status === 'doing').length,
      'A fazer': mine.filter((t) => t.status === 'todo').length,
    };
  }).sort((a, b) => b.Concluídas - a.Concluídas);

  // Concluídas por semana (últimas 8)
  const weeks = [];
  const w0 = weekStart(new Date());
  for (let i = 7; i >= 0; i--) {
    const start = new Date(w0); start.setDate(start.getDate() - i * 7);
    const end = new Date(start); end.setDate(end.getDate() + 7);
    weeks.push({
      semana: start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      Concluídas: done.filter((t) => t.completed_at && new Date(t.completed_at) >= start && new Date(t.completed_at) < end).length,
    });
  }

  async function move(task, status) {
    if (task.status === status) return;
    await update('team_tasks', task.id, { status, completed_at: status === 'done' ? new Date().toISOString() : null });
  }

  return (
    <>
      <PageHead title="Início" desc="Tarefas da equipe, produtividade e visão geral.">
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}><Plus size={16} /> Nova tarefa</button>
      </PageHead>
      <ErrorBox error={tasks.error || members.error} />

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Kpi label="Tarefas abertas" value={tasks.rows.length - done.length} hint={`${overdue.length} atrasada(s)`} />
        <Kpi label="Concluídas na semana" value={thisWeek.length} hint={`${done.length} no total`} />
        <Kpi label="Rounds registrados" value={rounds.rows.length} />
        <Kpi label="Melhor round" value={best} hint="pontos" />
      </div>

      {showForm && <TaskForm members={members.rows} groups={groups} onClose={() => setShowForm(false)} />}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h2>Kanban</h2>
          <select aria-label="Filtrar por aluno" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Todos os alunos</option>
            {members.rows.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="kanban">
          {COLS.map((col, ci) => (
            <div
              key={col.id}
              className={'kcol' + (dragOver === col.id ? ' over' : '')}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(null);
                const t = tasks.rows.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                if (t) move(t, col.id);
              }}
            >
              <h3><span style={{ width: 8, height: 8, borderRadius: 9, background: col.dot }} />{col.label}
                <span className="muted">{visible.filter((t) => t.status === col.id).length}</span></h3>
              {visible.filter((t) => t.status === col.id).map((t) => {
                const late = t.status !== 'done' && t.due_date && new Date(t.due_date + 'T23:59') < new Date();
                return (
                  <div key={t.id} className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}>
                    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong>{t.title}</strong>
                      <button className="icon-btn" title="Excluir" onClick={() => confirm('Excluir esta tarefa?') && remove('team_tasks', t.id)}><Trash2 size={14} /></button>
                    </div>
                    {t.description && <p>{t.description}</p>}
                    <div className="row" style={{ marginBottom: 6 }}>
                      {t.group_name && <span className="tag blue">{t.group_name}</span>}
                      {t.due_date && <span className={'tag ' + (late ? 'red' : '')}><CalendarDays size={12} />{fmtDate(t.due_date + 'T12:00')}</span>}
                    </div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <div className="row">
                        {(t.assignee_ids || []).map((id) => memberMap[id] && (
                          <span key={id} className="avatar" title={memberMap[id].name}>{initials(memberMap[id].name)}</span>
                        ))}
                      </div>
                      <div className="row">
                        {ci > 0 && <button className="icon-btn" title="Voltar" onClick={() => move(t, COLS[ci - 1].id)}><ChevronLeft size={16} /></button>}
                        {ci < 2 && <button className="icon-btn" title="Avançar" onClick={() => move(t, COLS[ci + 1].id)}><ChevronRight size={16} /></button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h2>Produtividade por aluno</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={perMember} margin={{ left: -20 }}>
              <CartesianGrid vertical={false} stroke="#e4e8f0" />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} interval={0} angle={-30} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Concluídas" stackId="a" fill="#1450d8" />
              <Bar dataKey="Em andamento" stackId="a" fill="#0b0f19" />
              <Bar dataKey="A fazer" stackId="a" fill="#c9d1e0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h2>Tarefas concluídas por semana</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeks} margin={{ left: -20 }}>
              <CartesianGrid vertical={false} stroke="#e4e8f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="Concluídas" stroke="#1450d8" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

function TaskForm({ members, groups, onClose }) {
  const [f, setF] = useState({ title: '', description: '', due_date: '', group_name: '', assignee_ids: [] });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const toggle = (id) => set('assignee_ids', f.assignee_ids.includes(id) ? f.assignee_ids.filter((x) => x !== id) : [...f.assignee_ids, id]);
  function pickGroup(g) {
    setF((x) => ({ ...x, group_name: g, assignee_ids: g ? members.filter((m) => m.group_name === g).map((m) => m.id) : x.assignee_ids }));
  }
  async function save(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    await insert('team_tasks', { ...f, due_date: f.due_date || null, status: 'todo', completed_at: null });
    onClose();
  }
  return (
    <form className="card stack" style={{ marginBottom: 16 }} onSubmit={save}>
      <h2 style={{ margin: 0 }}>Nova tarefa</h2>
      <div className="grid g2">
        <label className="field">Título<input type="text" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus /></label>
        <label className="field">Prazo<input type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} /></label>
      </div>
      <label className="field">Descrição<textarea value={f.description} onChange={(e) => set('description', e.target.value)} /></label>
      {groups.length > 0 && (
        <label className="field">Atribuir a um grupo
          <select value={f.group_name} onChange={(e) => pickGroup(e.target.value)}>
            <option value="">— nenhum —</option>
            {groups.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
      )}
      <div className="field">Atribuir a alunos
        <div className="row" style={{ marginTop: 4 }}>
          {members.map((m) => (
            <button type="button" key={m.id} className={'btn sm' + (f.assignee_ids.includes(m.id) ? ' primary' : '')} onClick={() => toggle(m.id)}>{m.name}</button>
          ))}
        </div>
      </div>
      <div className="row"><button className="btn primary">Salvar tarefa</button><button type="button" className="btn" onClick={onClose}>Cancelar</button></div>
    </form>
  );
}
