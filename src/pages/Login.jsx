import { useState } from 'react';
import { supabase } from '../lib/supabase.js';

const MESSAGES = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail pelo link que enviamos antes de entrar.',
  'User already registered': 'Este e-mail já tem conta. Use “Já tenho conta”.',
  'Signups not allowed for this instance': 'Novas contas estão desativadas. Peça ao responsável para criar a sua.',
};
const translate = (m) => MESSAGES[m] || m;

function Brand() {
  return (
    <div className="row">
      <img src="/logo.jpg" alt="" width="44" height="44" style={{ borderRadius: 10 }} />
      <div><h1 style={{ fontSize: 20 }}>Rabbitech</h1><span className="muted">Plataforma da equipe</span></div>
    </div>
  );
}

export default function Login() {
  const [mode, setMode] = useState('in'); // in | up | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setMsg({ ok: true, text: 'Conta criada! Abra o e-mail de confirmação e depois entre.' });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setMsg({ ok: true, text: 'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.' });
      }
    } catch (err) {
      setMsg({ ok: false, text: translate(err.message) });
    } finally { setBusy(false); }
  }

  const go = (m) => { setMode(m); setMsg(null); };
  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <Brand />
        <h2 style={{ margin: 0, fontSize: 16 }}>{mode === 'in' ? 'Entrar' : mode === 'up' ? 'Criar conta' : 'Recuperar senha'}</h2>
        <label className="field">E-mail<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== 'reset' && (
          <label className="field">Senha
            <input type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {msg && <div className={msg.ok ? 'tag green' : 'error'} style={{ margin: 0, padding: '10px 12px', borderRadius: 8, whiteSpace: 'normal' }}>{msg.text}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : mode === 'up' ? 'Criar conta' : 'Enviar link'}</button>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {mode !== 'in' && <button type="button" className="btn sm" onClick={() => go('in')}>Já tenho conta</button>}
          {mode !== 'up' && <button type="button" className="btn sm" onClick={() => go('up')}>Criar uma conta</button>}
          {mode !== 'reset' && <button type="button" className="btn sm" onClick={() => go('reset')}>Esqueci a senha</button>}
        </div>
      </form>
    </div>
  );
}

export function NewPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  async function submit(e) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMsg(translate(error.message)); else onDone();
  }
  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <Brand />
        <h2 style={{ margin: 0, fontSize: 16 }}>Criar nova senha</h2>
        <label className="field">Nova senha<input type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {msg && <div className="error" style={{ margin: 0 }}>{msg}</div>}
        <button className="btn primary">Salvar senha</button>
      </form>
    </div>
  );
}

export function MissingConfig() {
  return (
    <div className="login">
      <div className="card stack" style={{ maxWidth: 520 }}>
        <Brand />
        <h2 style={{ margin: 0, fontSize: 16 }}>Configuração do Supabase ausente</h2>
        <p style={{ margin: 0 }}>
          Este deploy não encontrou as variáveis <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.
          Cadastre-as na Vercel em <b>Settings → Environment Variables</b> e faça um <b>Redeploy</b>.
        </p>
      </div>
    </div>
  );
}

export function AccessProblem({ kind, email }) {
  return (
    <div className="login">
      <div className="card stack" style={{ maxWidth: 560 }}>
        <Brand />
        {kind === 'denied' ? (
          <>
            <h2 style={{ margin: 0, fontSize: 16 }}>Conta ainda não liberada</h2>
            <p style={{ margin: 0 }}>
              Você entrou como <b>{email}</b>, mas este e-mail não está na lista de acesso da equipe,
              então nada pode ser lido nem salvo. Peça ao responsável para rodar no Supabase (SQL Editor):
            </p>
            <pre style={{ background: 'var(--bg)', padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap', margin: 0 }}>
{`insert into public.allowed_emails (email)\nvalues ('${(email || '').toLowerCase()}');`}
            </pre>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: 16 }}>Banco de dados não configurado</h2>
            <p style={{ margin: 0 }}>
              O Supabase ainda não tem o esquema atual. Rode o arquivo <code>supabase/schema.sql</code> no
              SQL Editor do Supabase e recarregue esta página.
            </p>
          </>
        )}
        <div className="row">
          <button className="btn primary" onClick={() => window.location.reload()}>Tentar de novo</button>
          <button className="btn" onClick={() => supabase.auth.signOut()}>Sair e trocar de conta</button>
        </div>
      </div>
    </div>
  );
}
