export function PageHead({ title, desc, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Kpi({ label, value, hint }) {
  return (
    <div className="card kpi">
      <small>{label}</small>
      <strong>{value}</strong>
      {hint && <span>{hint}</span>}
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="error">Erro ao acessar o banco: {error}</div>;
}

export const initials = (name = '') => name.trim().slice(0, 2).toUpperCase();

export function fmtDate(iso, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR');
}

export function fmtSecs(s) {
  if (s === null || s === undefined || s === '') return '—';
  const n = Number(s);
  return n >= 60 ? `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, '0')}s` : `${n}s`;
}
