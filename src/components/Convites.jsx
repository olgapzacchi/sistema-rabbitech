import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Camera, Copy, Check, Plus, RefreshCw, X } from 'lucide-react';
import { supabase } from '../lib/db.js';
import { fmtDate } from './ui.jsx';

const PENDENTE = 'rabbitech.convite';

// aceita o link inteiro (…/?convite=TOKEN) ou só o código de 64 letras/números
export function parseConvite(texto = '') {
  const t = texto.trim();
  const m = t.match(/convite=([0-9a-f]{64})/i) || t.match(/^([0-9a-f]{64})$/i);
  return m ? m[1].toLowerCase() : '';
}

// quem abre o link sem estar logado: guarda o código até a pessoa entrar
export function guardarConvitePendente() {
  const t = parseConvite(new URLSearchParams(window.location.search).get('convite') || '');
  if (t) try { localStorage.setItem(PENDENTE, t); } catch { /* sem armazenamento */ }
}
export function pegarConvitePendente() {
  try {
    const t = localStorage.getItem(PENDENTE) || '';
    localStorage.removeItem(PENDENTE);
    return t;
  } catch { return ''; }
}

export function CriarEquipe({ onDone }) {
  const [nome, setNome] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function criar(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const { data, error } = await supabase.rpc('criar_equipe', { p_name: nome.trim() });
    setBusy(false);
    if (error) return setErr(error.message);
    setNome('');
    onDone?.(data);
  }
  return (
    <form className="card stack" onSubmit={criar}>
      <h2 style={{ margin: 0 }}><Plus size={15} style={{ verticalAlign: -2 }} /> Criar equipe</h2>
      <div className="muted" style={{ fontSize: 13 }}>Você vira a administradora da equipe nova e pode convidar os colegas.</div>
      <input type="text" aria-label="Nome da equipe" value={nome} placeholder="ex.: Rabbitech Future" onChange={(e) => setNome(e.target.value)} />
      {err && <div className="error" style={{ margin: 0 }}>{err}</div>}
      <button className="btn primary" disabled={busy || !nome.trim()} style={{ alignSelf: 'flex-start' }}>Criar equipe</button>
    </form>
  );
}

export function EntrarEquipe({ onDone }) {
  const [texto, setTexto] = useState('');
  const [lendo, setLendo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function entrar(valor) {
    const token = parseConvite(valor);
    if (!token) { setErr('Esse código não parece um convite. Cole o link inteiro ou leia o QR Code.'); return; }
    setBusy(true); setErr(''); setLendo(false);
    const { data, error } = await supabase.rpc('entrar_por_convite', { p_token: token });
    setBusy(false);
    if (error) return setErr(error.message);
    setTexto('');
    onDone?.(data?.[0]?.out_team_id);
  }

  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); entrar(texto); }}>
      <h2 style={{ margin: 0 }}><Camera size={15} style={{ verticalAlign: -2 }} /> Entrar em uma equipe</h2>
      <div className="muted" style={{ fontSize: 13 }}>Cole o link de convite ou leia o QR Code que o administrador mostrar.</div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="text" aria-label="Link ou código do convite" value={texto} placeholder="Cole o link ou o código"
          onChange={(e) => setTexto(e.target.value)} />
        <button className="btn primary" disabled={busy || !texto.trim()}>Entrar</button>
      </div>
      <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setLendo((v) => !v)}>
        {lendo ? <X size={14} /> : <Camera size={14} />} {lendo ? 'Fechar leitor' : 'Ler QR Code com a câmera'}
      </button>
      {lendo && <LeitorQR onCode={entrar} />}
      {err && <div className="error" style={{ margin: 0 }}>{err}</div>}
    </form>
  );
}

// leitor pela câmera: lê quadro a quadro até achar um QR Code, depois para a câmera sozinho
function LeitorQR({ onCode }) {
  const videoRef = useRef(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [erro, setErro] = useState('');

  useEffect(() => {
    let stream = null;
    let frame = 0;
    let pronto = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    (async () => {
      try {
        const { default: jsQR } = await import('jsqr');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (pronto) return;
          if (v.readyState >= 2 && v.videoWidth) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const achou = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (achou?.data) { pronto = true; onCodeRef.current(achou.data); return; }
          }
          frame = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setErro('Não consegui abrir a câmera. Confira a permissão do navegador ou cole o link.');
      }
    })();

    return () => {
      pronto = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div>
      {erro ? <div className="muted" style={{ fontSize: 13 }}>{erro}</div> : (
        <video ref={videoRef} playsInline muted aria-label="Câmera para ler o QR Code"
          style={{ width: '100%', maxWidth: 260, borderRadius: 12, background: '#000', display: 'block' }} />
      )}
    </div>
  );
}

// convite da equipe (só administradores): link e QR Code válidos por 7 dias
export function ConviteEquipe({ teamId }) {
  const [convite, setConvite] = useState(null);
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [err, setErr] = useState('');
  const link = convite ? `${window.location.origin}/?convite=${convite.token}` : '';

  const carregar = useCallback(async () => {
    setErr('');
    const { data, error } = await supabase.rpc('convite_equipe_atual', { p_team: teamId });
    if (error) return setErr(error.message);
    const r = data?.[0];
    setConvite(r ? { token: r.out_token, expires: r.out_expires } : null);
  }, [teamId]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (!link) { setQr(''); return; }
    QRCode.toDataURL(link, { width: 240, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [link]);

  async function gerarNovo() {
    if (convite && !confirm('Gerar um link novo? O link atual deixa de funcionar.')) return;
    setErr('');
    const { data, error } = await supabase.rpc('gerar_convite_equipe', { p_team: teamId });
    if (error) return setErr(error.message);
    const r = data?.[0];
    setConvite({ token: r.out_token, expires: r.out_expires });
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true); setTimeout(() => setCopiado(false), 1500);
    } catch {
      setErr('Não consegui copiar. Selecione o link no campo e copie.');
    }
  }

  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}>Convidar colegas</h2>
      <div className="muted" style={{ fontSize: 13 }}>
        Mostre o QR Code ou envie o link. Quem entrar vira membro. O convite vale 7 dias.
      </div>
      {err && <div className="error" style={{ margin: 0 }}>{err}</div>}
      {convite ? (
        <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          {qr && <img src={qr} alt="QR Code do convite da equipe" width={160} height={160} style={{ borderRadius: 10, border: '1px solid var(--line)' }} />}
          <div className="stack" style={{ flex: 1, minWidth: 200 }}>
            <input type="text" readOnly aria-label="Link do convite" value={link} onFocus={(e) => e.target.select()} />
            <small className="muted">Válido até {fmtDate(convite.expires, true)}</small>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={copiar}>{copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? 'Copiado' : 'Copiar link'}</button>
              <button className="btn sm" onClick={gerarNovo}><RefreshCw size={14} /> Gerar link novo</button>
            </div>
          </div>
        </div>
      ) : (
        <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={gerarNovo}>Gerar link e QR Code</button>
      )}
    </div>
  );
}
