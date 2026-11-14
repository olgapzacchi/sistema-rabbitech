import { useEffect, useState } from 'react';
import { Bell, BellOff, KeyRound, Loader2, Palette } from 'lucide-react';
import { isCloud, supabase } from '../lib/db.js';
import { PageHead } from '../components/ui.jsx';
import { useTeam } from '../lib/team.jsx';
import { estadoPush, ativarPush, desativarPush, testarPush, CATEGORIAS, lerCategorias, salvarCategorias } from '../lib/push.js';
import { AccessAdmin } from './Equipe.jsx';
import { MODOS, CORES, FUNDOS, PADRAO, temaAtual, definirTema } from '../lib/tema.js';

const AVISO = {
  indisponivel: 'Este navegador não suporta notificações.',
  instalar: 'No iPhone: toque em Compartilhar › Adicionar à Tela de Início e abra o Rabbitech por lá para ativar os avisos.',
  bloqueado: 'As notificações estão bloqueadas. Libere-as nas configurações do navegador para este site.',
};

export default function Configuracoes() {
  const { email } = useTeam() || {};
  return (
    <>
      <PageHead title="Configurações" desc="Aparência, avisos, conta e acesso da equipe." />
      {!isCloud ? (
        <div className="grid g2">
          <Aparencia email={email} />
          <div className="card empty">Avisos, senha e acesso da equipe ficam disponíveis no site publicado.</div>
        </div>
      ) : (
        <>
          <div className="grid g2" style={{ alignItems: 'start' }}>
            <div className="stack">
              <Aparencia email={email} />
              <Senha />
            </div>
            <Notificacoes email={email} />
          </div>
          <AccessAdmin />
        </>
      )}
    </>
  );
}

function Aparencia({ email }) {
  const [t, setT] = useState(temaAtual());
  const [msg, setMsg] = useState('');

  async function escolher(parte) {
    const novo = { ...t, ...parte };
    setT(novo); setMsg('');
    try { await definirTema(novo, email); } catch (e) { setMsg(`Aplicado aqui, mas não consegui salvar na conta: ${e.message}`); }
  }
  const nomeCor = CORES.find(([k]) => k === t.cor)?.[1];

  return (
    <div className="card stack">
      <h2 style={{ margin: 0 }}><Palette size={15} style={{ verticalAlign: -2 }} /> Aparência</h2>
      <div className="muted" style={{ fontSize: 13 }}>Só você vê essa escolha. Ela acompanha a sua conta em qualquer aparelho e não muda nada para os outros.</div>

      <div className="stack" style={{ gap: 6 }}>
        <b style={{ fontSize: 13 }}>Modo</b>
        <div className="seg" role="group" aria-label="Modo" style={{ alignSelf: 'flex-start' }}>
          {MODOS.map(([k, nome]) => <button key={k} type="button" className={t.modo === k ? 'on' : ''} aria-pressed={t.modo === k} onClick={() => escolher({ modo: k })}>{nome}</button>)}
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <b style={{ fontSize: 13 }}>Cor <span className="muted" style={{ fontWeight: 400 }}>· {nomeCor}</span></b>
        <div className="swatches" role="radiogroup" aria-label="Cor de destaque">
          {CORES.map(([k, nome, hex]) => (
            <button key={k} type="button" role="radio" aria-checked={t.cor === k} aria-label={nome} title={nome}
              className="swatch" style={{ '--sw': hex }} onClick={() => escolher({ cor: k })} />
          ))}
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <b style={{ fontSize: 13 }}>Fundo</b>
        <div className="seg" role="group" aria-label="Fundo" style={{ alignSelf: 'flex-start' }}>
          {FUNDOS.map(([k, nome]) => <button key={k} type="button" className={t.fundo === k ? 'on' : ''} aria-pressed={t.fundo === k} onClick={() => escolher({ fundo: k })}>{nome}</button>)}
        </div>
      </div>

      {msg && <div className="error" style={{ margin: 0 }}>{msg}</div>}
      <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => escolher(PADRAO)}>Voltar ao padrão</button>
    </div>
  );
}

function Notificacoes({ email }) {
  const [estado, setEstado] = useState('...');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [cats, setCats] = useState([]);
  useEffect(() => { estadoPush().then(setEstado).catch(() => setEstado('indisponivel')); }, []);
  useEffect(() => { if (estado === 'ligado') lerCategorias().then(setCats).catch(() => {}); }, [estado]);

  async function alternar(chave) {
    const novas = cats.includes(chave) ? cats.filter((c) => c !== chave) : [...cats, chave];
    setCats(novas); setMsg('');
    try { await salvarCategorias(novas); } catch (e) { setCats(cats); setMsg(e.message); }
  }

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
        Você recebe um aviso quando algo novo acontece na equipe, mesmo com o navegador fechado. Escolha o que quer receber. Vale só para este aparelho, e você não recebe aviso do que você mesmo fez.
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
          <div className="stack" style={{ gap: 6 }} role="group" aria-label="O que avisar">
            {CATEGORIAS.map(([chave, nome, desc]) => (
              <label key={chave} className="cond" style={{ padding: 0, alignItems: 'center' }}>
                <input type="checkbox" checked={cats.includes(chave)} onChange={() => alternar(chave)} />
                <span><b>{nome}</b> <span className="muted">· {desc}</span></span>
              </label>
            ))}
          </div>
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
