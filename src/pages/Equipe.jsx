import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTable, insert, update, remove } from '../lib/db.js';
import { PageHead, ErrorBox, initials } from '../components/ui.jsx';

export default function Equipe() {
  const members = useTable('members');
  const tasks = useTable('team_tasks');
  const [name, setName] = useState('');
  const groups = [...new Set(members.rows.map((m) => m.group_name).filter(Boolean))];

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await insert('members', { name: name.trim(), group_name: '' });
    setName('');
  }

  return (
    <>
      <PageHead title="Equipe" desc="Alunos e grupos. Os grupos aparecem na hora de atribuir tarefas no Kanban." />
      <ErrorBox error={members.error} />
      <div className="split">
        <div className="card">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Aluno</th><th>Grupo</th><th>Tarefas concluídas</th><th /></tr></thead>
              <tbody>
                {members.rows.map((m) => (
                  <tr key={m.id}>
                    <td><div className="row"><span className="avatar">{initials(m.name)}</span><EditText value={m.name} onSave={(v) => update('members', m.id, { name: v })} /></div></td>
                    <td><EditText value={m.group_name || ''} placeholder="ex.: Programação" list="groups" onSave={(v) => update('members', m.id, { group_name: v })} /></td>
                    <td>{tasks.rows.filter((t) => t.status === 'done' && (t.assignee_ids || []).includes(m.id)).length}</td>
                    <td><button className="icon-btn" onClick={() => confirm(`Remover ${m.name}?`) && remove('members', m.id)}><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          </div>
        </div>
        <div className="stack">
          <form className="card stack" onSubmit={add}>
            <h2 style={{ margin: 0 }}>Adicionar aluno</h2>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
            <button className="btn primary"><Plus size={16} /> Adicionar</button>
          </form>
          <div className="card">
            <h2>Grupos</h2>
            {!groups.length && <div className="muted">Digite um nome de grupo na coluna “Grupo” para criar.</div>}
            {groups.map((g) => (
              <div key={g} style={{ marginBottom: 8 }}>
                <span className="tag blue">{g}</span>{' '}
                <span className="muted">{members.rows.filter((m) => m.group_name === g).map((m) => m.name).join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function EditText({ value, onSave, ...rest }) {
  const [v, setV] = useState(value);
  return <input type="text" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() !== value && onSave(v.trim())} {...rest} />;
}
