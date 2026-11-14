import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { estadoPush, ativarPush, desativarPush, testarPush } from '../lib/push.js';

const DICA = {
  instalar: 'No iPhone: toque em Compartilhar › Adicionar à Tela de Início e abra o Rabbitech por lá para ativar os avisos.',
  bloqueado: 'Avisos bloqueados. Libere as notificações deste site nas configurações do navegador.',
};

export default function PushToggle({ email }) {
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

  if (estado === '...' || estado === 'indisponivel') return null;
  return (
    <div style={{ marginBottom: 8 }}>
      {estado === 'ligado' ? (
        <div className="row" style={{ padding: '0 10px', gap: 6 }}>
          <span className="muted-dark" style={{ padding: 0, flex: 1 }}><Bell size={12} style={{ verticalAlign: -2 }} /> Avisos ativos</span>
          <button className="btn sm" disabled={busy} onClick={() => agir(testarPush, 'Teste enviado. Deve chegar em instantes.')}>Testar</button>
          <button className="btn sm" disabled={busy} onClick={() => agir(desativarPush, 'Avisos desativados neste aparelho.')}>Desligar</button>
        </div>
      ) : DICA[estado] ? (
        <small className="muted-dark"><BellOff size={12} style={{ verticalAlign: -2 }} /> {DICA[estado]}</small>
      ) : (
        <button className="nav-link" disabled={busy} onClick={() => agir(() => ativarPush(email), 'Avisos ativados neste aparelho.')}>
          <Bell size={18} /> <span>Ativar avisos no aparelho</span>
        </button>
      )}
      {msg && <small className="muted-dark" style={{ marginTop: 4 }}>{msg}</small>}
    </div>
  );
}
