import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, ShieldCheck, Github, Building2 } from 'lucide-react';
import { useTable, insert, update, remove, isCloud, supabase } from '../lib/db.js';
import { PageHead, ErrorBox, initials } from '../components/ui.jsx';
import { useTeam } from '../lib/team.jsx';
import { ConviteEquipe } from '../components/Convites.jsx';

export default function Equipe() {
  const members = useTable('members');
  const tasks = useTable('team_tasks');
  const [name, setName] = useState('');
  const { team } = useTeam() || {};
  const groups = [...new Set(members.rows.map((m) => m.group_name).filter(Boolean))];

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await insert('members', { name: name.trim(), group_name: '' });
    setName('');
  }

  return (
    <>
      <PageHead title={`Equipe ${team?.name || ''}`} desc="Alunos e grupos. Os grupos aparecem na hora de atribuir tarefas no Kanban." />
      <ErrorBox error={members.error} />
      <div className="split">
        <div className="card">
          <div className="table-wrap" tabIndex={0}>
            <table className="table">
              <thead><tr><th>Aluno</th><th>Grupo</th><th>Tarefas concluídas</th><th /></tr></thead>
              <tbody>
                {members.rows.map((m) => (
                  <tr key={m.id}>
                    <td><div className="row"><span className="avatar">{initials(m.name)}</span><EditText aria-label={`Nome de ${m.name}`} value={m.name} onSave={(v) => update('members', m.id, { name: v })} /></div></td>
                    <td><EditText aria-label={`Grupo de ${m.name}`} value={m.group_name || ''} placeholder="ex.: Programação" list="groups" onSave={(v) => update('members', m.id, { group_name: v })} /></td>
                    <td>{tasks.rows.filter((t) => t.status === 'done' && (t.assignee_ids || []).includes(m.id)).length}</td>
                    <td><button className="icon-btn" title="Remover aluno" aria-label="Remover aluno" onClick={() => confirm(`Remover ${m.name}?`) && remove('members', m.id)}><Trash2 size={15} /></button></td>
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
      {isCloud && <AccessAdmin />}
    </>
  );
}

// ---------- acesso à plataforma (e-mails da equipe) e configurações ----------
function AccessAdmin() {
  const { team, isAdmin, isPlatformAdmin, reload } = useTeam();
  const [people, setPeople] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('team_members').select('*').eq('team_id', team.id).order('role').order('email');
    if (error) setErr(error.message); else setPeople(data);
  }, [team.id]);
  useEffect(() => {
    load();
    const ch = supabase.channel(`tm-${team.id}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members', filter: `team_id=eq.${team.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, team.id]);

  const act = (fn) => async (e) => {
    e?.preventDefault?.(); setErr(''); setMsg('');
    try { await fn(e); } catch (x) { setErr(x.message); }
  };
  const addPerson = act(async () => {
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new Error('E-mail inválido.');
    const { error } = await supabase.from('team_members').insert({ team_id: team.id, email: em, role });
    if (error) throw new Error(error.code === '23505' ? 'Esse e-mail já está na equipe.' : error.message);
    setEmail(''); setMsg(`${em} agora tem acesso à ${team.name}. A pessoa entra criando a conta com esse mesmo e-mail.`);
  });

  return (
    <div className="grid g2" style={{ marginTop: 16 }}>
      <div className="card">
        <h2><ShieldCheck size={15} style={{ verticalAlign: -2 }} /> Acesso à plataforma</h2>
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          Só estes e-mails entram na <b>{team.name}</b> e veem os dados, a Music (com a conta Spotify da equipe) e o código do robô.
          Outras equipes não enxergam nada daqui.
        </div>
        {err && <div className="error">{err}</div>}
        {msg && <div className="tag green" style={{ padding: '8px 12px', marginBottom: 10, whiteSpace: 'normal' }}>{msg}</div>}
        <table className="table">
          <thead><tr><th>E-mail</th><th>Papel</th><th /></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id}>
                <td style={{ wordBreak: 'break-all' }}>{p.email}</td>
                <td>
                  {isAdmin
                    ? <select aria-label={`Papel de ${p.email}`} value={p.role} onChange={act(async (e) => {
                        const { error } = await supabase.from('team_members').update({ role: e.target.value }).eq('id', p.id);
                        if (error) throw error;
                      })} style={{ width: 'auto' }}>
                        <option value="member">Membro</option><option value="admin">Administrador</option>
                      </select>
                    : <span className={'tag ' + (p.role === 'admin' ? 'dark' : '')}>{p.role === 'admin' ? 'Administrador' : 'Membro'}</span>}
                </td>
                <td>{isAdmin && (
                  <button className="icon-btn" title="Tirar acesso" aria-label={`Tirar acesso de ${p.email}`} onClick={act(async () => {
                    if (!confirm(`Tirar o acesso de ${p.email} à ${team.name}?`)) return;
                    const { error } = await supabase.from('team_members').delete().eq('id', p.id);
                    if (error) throw error;
                    await reload();
                  })}><Trash2 size={15} /></button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isAdmin && (
          <form className="row" style={{ marginTop: 12, flexWrap: 'nowrap' }} onSubmit={addPerson}>
            <input type="email" aria-label="E-mail para liberar" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select aria-label="Papel" value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 'auto' }}>
              <option value="member">Membro</option><option value="admin">Administrador</option>
            </select>
            <button className="btn primary"><Plus size={16} /> Liberar</button>
          </form>
        )}
      </div>

      <div className="stack">
        {isAdmin && <ConviteEquipe teamId={team.id} />}
        {isAdmin && <TeamSettings />}
        {isPlatformAdmin && <CreateTeam />}
      </div>
    </div>
  );
}

function TeamSettings() {
  const { team, reload } = useTeam();
  const [name, setName] = useState(team.name);
  const [repo, setRepo] = useState(team.github_repo || '');
  const [token, setToken] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  async function save(e) {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      if (name.trim() !== team.name) {
        const { error } = await supabase.from('teams').update({ name: name.trim() }).eq('id', team.id);
        if (error) throw new Error(error.code === '23505' ? 'Já existe uma equipe com esse nome.' : error.message);
      }
      if (repo.trim() !== (team.github_repo || '') || token) {
        const { data, error } = await supabase.functions.invoke('robot-code', {
          body: { action: 'set_github', team_id: team.id, repo: repo.trim(), ...(token ? { token } : {}) },
        });
        if (error) { let m = error.message; try { m = (await error.context.json()).error || m; } catch { /* */ } throw new Error(m); }
        setRepo(data.repo);
      }
      setToken(''); setMsg('Configurações salvas.'); await reload();
    } catch (x) { setErr(x.message); }
  }
  return (
    <form className="card stack" onSubmit={save}>
      <h2 style={{ margin: 0 }}><Github size={15} style={{ verticalAlign: -2 }} /> Configurações da equipe</h2>
      <label className="field">Nome da equipe<input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">Repositório do código do robô (GitHub)
        <input type="text" value={repo} placeholder="dono/repositorio" onChange={(e) => setRepo(e.target.value)} />
      </label>
      <label className="field">Token do GitHub da equipe (para publicar pelo site)
        <input type="password" autoComplete="off" value={token} placeholder="cole para trocar — fica guardado só no servidor" onChange={(e) => setToken(e.target.value)} />
      </label>
      <small className="muted">O token nunca aparece de volta no site. Use um token “fine-grained” só desse repositório, com Contents: Read and write.</small>
      {err && <div className="error" style={{ margin: 0 }}>{err}</div>}
      {msg && <span className="tag green">{msg}</span>}
      <button className="btn primary" style={{ alignSelf: 'flex-start' }}>Salvar</button>
    </form>
  );
}

function CreateTeam() {
  const { reload, switchTeam } = useTeam();
  const [name, setName] = useState('');
  const [admin, setAdmin] = useState('');
  const [join, setJoin] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  async function create(e) {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      const em = admin.trim().toLowerCase();
      if (!name.trim()) throw new Error('Dê um nome para a equipe.');
      const { data: t, error } = await supabase.from('teams').insert({ name: name.trim() }).select().single();
      if (error) throw new Error(error.code === '23505' ? 'Já existe uma equipe com esse nome.' : error.message);
      const { data: me } = await supabase.auth.getUser();
      const rows = [];
      if (em) rows.push({ team_id: t.id, email: em, role: 'admin' });
      if (join && me?.user?.email && me.user.email.toLowerCase() !== em) rows.push({ team_id: t.id, email: me.user.email.toLowerCase(), role: 'admin' });
      if (rows.length) {
        const { error: e2 } = await supabase.from('team_members').insert(rows);
        if (e2) throw e2;
      }
      setName(''); setAdmin('');
      setMsg(`Equipe ${t.name} criada.`);
      await reload();
      if (join) switchTeam(t.id);
    } catch (x) { setErr(x.message); }
  }
  return (
    <form className="card stack" onSubmit={create}>
      <h2 style={{ margin: 0 }}><Building2 size={15} style={{ verticalAlign: -2 }} /> Criar nova equipe</h2>
      <div className="muted" style={{ fontSize: 13 }}>Cada equipe tem dados, membros, conta Spotify e código do robô separados.</div>
      <label className="field">Nome<input type="text" value={name} placeholder="ex.: Rabbitech Future" onChange={(e) => setName(e.target.value)} /></label>
      <label className="field">E-mail do administrador da nova equipe (opcional)
        <input type="email" value={admin} placeholder="professor@exemplo.com" onChange={(e) => setAdmin(e.target.value)} />
      </label>
      <label className="cond" style={{ padding: 0 }}>
        <input type="checkbox" checked={join} onChange={(e) => setJoin(e.target.checked)} />
        <span>Me colocar como administradora dessa equipe também</span>
      </label>
      {err && <div className="error" style={{ margin: 0 }}>{err}</div>}
      {msg && <span className="tag green">{msg}</span>}
      <button className="btn primary" style={{ alignSelf: 'flex-start' }}><Plus size={16} /> Criar equipe</button>
    </form>
  );
}

function EditText({ value, onSave, ...rest }) {
  const [v, setV] = useState(value);
  return <input type="text" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() !== value && onSave(v.trim())} {...rest} />;
}
