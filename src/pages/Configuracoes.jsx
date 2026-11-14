import { useEffect, useState } from 'react';
import { Bell, BellOff, KeyRound, Loader2 } from 'lucide-react';
import { isCloud, supabase } from '../lib/db.js';
import { PageHead } from '../components/ui.jsx';
import { useTeam } from '../lib/team.jsx';
import { estadoPush, ativarPush, desativarPush, testarPush } from '../lib/push.js';
import { AccessAdmin } from './Equipe.jsx';

const AVISO = {
  indisponivel: 'Este navegador não suporta notificações.',
  instalar: 'No iPhone: toque em Compartilhar › Adicionar à Tela de Início e abra o Rabbitech por lá para ativar os avisos.',
  bloqueado: 'As notificações estão bloqueadas. Libere-as nas configurações do navegador para este site.',
};

export default function Configuracoes() {
  const { email } = useTeam();
  return (
    <>
      <PageHead title="Configurações" desc="Avisos, conta e acesso da equipe." />
      {!isCloud ? (
        <div className="card empty">As configurações ficam disponíveis no site publicado.</div>
      ) : (
        <>
          <div className="grid g2">
            <Notificacoes email={email} />
            <Senha />
          </div>
          <AccessAdmin />
        </>
      )}
    </>
  );
}

function Notificacoes({ email }) {
  const [estado, setEstado] = useState('...');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { estadoPush().then(setEstado).catch(() => setEstado('indisponivel')); }, []);

  async function agir(fn, ok) {
    setBusy(true); setMsg('');
    try { await fn(); if (ok) setMsg(ok); } catch (e) { setMsg(e.message); }
    setEstado(await estadoPush().catch(() => 'indisponivel'));
    setBusy(false);
  }

  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}><Bell size={15} style={{ verticalAlign: -2 }} /> Notificações</h2>
      <div className="muted" style={{ fontSize: 13 }}>
        Todo dia às 8h você recebe um aviso com os prazos e eventos que estão chegando, mesmo com o navegador fechado. Vale só para este aparelho.
      </div>
      {estado === '...' && <Loader2 size={16} className="spin" />}
      {AVISO[estado] && <div className="tag amber" style={{ whiteSpace: 'normal', padding: '8px 12px' }}><BellOff size={13} /> {AVISO[estado]}</div>}
      {estado === 'desligado' && (
        <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={busy}
          onClick={() => agir(() => ativarPush(email), 'Avisos ativados. Toque em Testar para conferir.')}>
          <Bell size={16} /> Ativar avisos neste aparelho
        </button>
      )}
      {estado === 'ligado' && (
        <>
          <span className="tag green" style={{ alignSelf: 'flex-start' }}><Bell size={12} /> Avisos ativos neste aparelho</span>
          <div className="row">
            <button className="btn" disabled={busy} onClick={() => agir(testarPush, 'Teste enviado. Deve chegar em instantes.')}>Testar</button>
            <button className="btn" disabled={busy} onClick={() => agir(desativarPush, 'Avisos desativados neste aparelho.')}>Desligar</button>
          </div>
        </>
      )}
      {msg && <small className="muted">{msg}</small>}
    </div>
  );
}

function Senha() {
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  async function salvar(e) {
    e.preventDefault(); setMsg(''); setErro(''); setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setBusy(false);
    if (error) return setErro(error.message);
    setSenha(''); setMsg('Senha alterada.');
  }
  return (
    <form className="card stack" onSubmit={salvar}>
      <h2 style={{ margin: 0 }}><KeyRound size={15} style={{ verticalAlign: -2 }} /> Trocar senha</h2>
      <label className="field">Nova senha
        <input type="password" minLength={6} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
      </label>
      {erro && <div className="error" style={{ margin: 0 }}>{erro}</div>}
      {msg && <span className="tag green" style={{ alignSelf: 'flex-start' }}>{msg}</span>}
      <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={busy || senha.length < 6}>Salvar senha</button>
    </form>
  );
}
