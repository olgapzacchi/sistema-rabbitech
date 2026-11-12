import { useState } from 'react';
import { supabase } from '../lib/db.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('in');
  const [msg, setMsg] = useState('');
  async function submit(e) {
    e.preventDefault();
    setMsg('');
    const fn = mode === 'in' ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error } = await fn.call(supabase.auth, { email, password });
    if (error) setMsg(error.message);
    else if (mode === 'up') setMsg('Conta criada! Verifique seu e-mail, se a confirmação estiver ativada.');
  }
  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <div className="row"><img src="/logo.jpg" alt="" width="44" height="44" style={{ borderRadius: 10 }} /><div><h1 style={{ fontSize: 20 }}>Rabbitech</h1><span className="muted">Plataforma da equipe</span></div></div>
        <label className="field">E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Senha<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {msg && <div className="error" style={{ margin: 0 }}>{msg}</div>}
        <button className="btn primary">{mode === 'in' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="btn" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'Criar uma conta' : 'Já tenho conta'}</button>
      </form>
    </div>
  );
}
