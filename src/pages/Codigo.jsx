import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download, Github, Copy, Check, Save, RefreshCw, FileCode2, ExternalLink, Rocket, History, AlertTriangle, Loader2,
} from 'lucide-react';
import { isCloud, supabase, useTable } from '../lib/db.js';
import { PageHead, fmtDate } from '../components/ui.jsx';

const DEFAULT_REPO = 'lnzindev/rabbitech-code-for-pybricks';

async function call(action, extra = {}) {
  const { data, error } = await supabase.functions.invoke('robot-code', { body: { action, ...extra } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return data;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/x-python;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name.split('/').pop() });
  a.click();
  URL.revokeObjectURL(url);
}

// Conferência rápida de erros comuns em Python antes de publicar (não substitui testar no robô)
export function checkPython(code) {
  const problems = [];
  code.split('\n').forEach((raw, i) => {
    const n = i + 1;
    const line = raw.replace(/#.*$/, '').replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""'); // ignora comentários e textos
    const m = line.match(/\b(true|false|null|none)\b/);
    if (m) problems.push(`Linha ${n}: “${m[1]}” deve ser escrito “${{ true: 'True', false: 'False', null: 'None', none: 'None' }[m[1]]}”.`);
    if (/^\t/.test(raw) && /^ /m.test(code)) problems.push(`Linha ${n}: mistura Tab com espaços na indentação.`);
    const balanced = (line.match(/[([{]/g) || []).length === (line.match(/[)\]}]/g) || []).length; // linha não continua na próxima
    if (balanced && !/\\\s*$/.test(line) && /^\s*(def|if|elif|else|for|while|try|except|finally|with)\b[^:]*$/.test(line) && line.trim()) problems.push(`Linha ${n}: falta “:” no fim da linha.`);
  });
  const opens = (code.replace(/#.*$/gm, '').match(/\(/g) || []).length, closes = (code.replace(/#.*$/gm, '').match(/\)/g) || []).length;
  if (opens !== closes) problems.push(`Parênteses desbalanceados: ${opens} “(” e ${closes} “)”.`);
  return problems.slice(0, 6);
}

// Saídas do robô: saida_1.py ... saida_8.py
const sortieNumber = (path) => Number((path.match(/^saida_(\d+)\.py$/) || [])[1] || 0);

export default function Codigo() {
  const [status, setStatus] = useState(null);
  const [files, setFiles] = useState([]);
  const [commits, setCommits] = useState([]);
  const [current, setCurrent] = useState(null); // { path, sha, content, original, html_url }
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [copied, setCopied] = useState(false);
  const changes = useTable('code_changes');

  const repo = status?.repo || DEFAULT_REPO;
  const branch = status?.branch || 'main';
  const dirty = current && current.content !== current.original;

  const loadAll = useCallback(async () => {
    if (!isCloud) return;
    setErr('');
    try {
      const [st, tree, log] = await Promise.all([call('status'), call('tree'), call('commits')]);
      setStatus(st); setFiles(tree.files || []); setCommits(log.commits || []);
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);
  // Quando alguém da equipe salva pelo site, todos recarregam o histórico na hora (realtime)
  useEffect(() => { if (changes.rows.length) call('commits').then((d) => setCommits(d.commits || [])).catch(() => {}); }, [changes.rows.length]);

  useEffect(() => {
    const warn = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function open(path) {
    if (dirty && !confirm('Você tem mudanças não salvas. Descartar?')) return;
    setBusy('abrir'); setErr(''); setOk('');
    try {
      const f = await call('file', { path });
      setCurrent({ ...f, original: f.content });
      const n = sortieNumber(path);
      setMsg(n ? `Saída ${n}: ` : `Atualiza ${path}`);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  }

  async function save() {
    if (!current || !dirty) return;
    if (current.path.endsWith('.py')) {
      const problems = checkPython(current.content);
      if (problems.length && !confirm(`Encontrei possíveis erros no código:\n\n• ${problems.join('\n• ')}\n\nPublicar mesmo assim?`)) return;
    }
    setBusy('salvar'); setErr(''); setOk('');
    try {
      const r = await call('save', { path: current.path, content: current.content, sha: current.sha, message: msg });
      setCurrent((c) => ({ ...c, sha: r.sha, original: c.content }));
      setOk('Publicado no GitHub!');
      const [tree, log] = await Promise.all([call('tree'), call('commits')]);
      setFiles(tree.files || []); setCommits(log.commits || []);
    } catch (e) { setErr(e.message); } finally { setBusy(''); }
  }

  async function redeploy() {
    if (!confirm('Publicar o site de novo na Vercel?')) return;
    setBusy('deploy'); setErr(''); setOk('');
    try { await call('redeploy'); setOk('Redeploy pedido! Em 1–2 minutos o site atualiza.'); }
    catch (e) { setErr(e.message); } finally { setBusy(''); }
  }

  async function copyClone() {
    try {
      await navigator.clipboard.writeText(cloneCmd);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch {
      // navegador sem permissão para a área de transferência: seleciona o texto para copiar com Ctrl+C
      const el = document.getElementById('clone-cmd');
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
      setOk('Selecionei o comando abaixo: é só apertar Ctrl+C.');
    }
  }

  function onKey(e) {
    // Tab insere 4 espaços (Python depende da indentação)
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const t = e.target;
    // setRangeText mantém o cursor no lugar certo (logo depois dos espaços)
    t.setRangeText('    ', t.selectionStart, t.selectionEnd, 'end');
    setCurrent((c) => ({ ...c, content: t.value }));
  }

  const sorted = useMemo(() => [...files].sort((a, b) => {
    const na = sortieNumber(a.path), nb = sortieNumber(b.path);
    if (na && nb) return na - nb;
    if (na || nb) return na ? 1 : -1;
    return a.path.localeCompare(b.path);
  }), [files]);
  const whoByCommit = Object.fromEntries(changes.rows.filter((c) => c.commit_sha).map((c) => [c.commit_sha, c.author_email]));
  const cloneCmd = `git clone https://github.com/${repo}.git`;
  const lines = current ? current.content.split('\n').length : 0;

  return (
    <>
      <PageHead title="Código do robô" desc="Programação Pybricks da equipe, ligada ao GitHub: veja, baixe, edite e publique pelo site." />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <Github size={20} />
            <a href={`https://github.com/${repo}`} target="_blank" rel="noreferrer"><b>{repo}</b></a>
            <span className="tag">{branch}</span>
            {commits[0] && <span className="muted" style={{ fontSize: 13 }}>última mudança {fmtDate(commits[0].date, true)}</span>}
          </div>
          <div className="row">
            <a className="btn primary" href={`https://github.com/${repo}/archive/refs/heads/${branch}.zip`}><Download size={16} /> Baixar tudo (.zip)</a>
            <button className="btn" onClick={copyClone}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar git clone'}
            </button>
            <a className="btn" href="https://code.pybricks.com" target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir Pybricks</a>
            {status?.canRedeploy && <button className="btn dark" disabled={!!busy} onClick={redeploy}><Rocket size={16} /> Redeploy do site</button>}
            <button className="btn" title="Atualizar" aria-label="Atualizar" onClick={loadAll}><RefreshCw size={16} /></button>
          </div>
        </div>
        <code id="clone-cmd" className="muted" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>{cloneCmd}</code>
      </div>

      {!isCloud && <div className="card empty">Esta tela precisa do Supabase (fica disponível no site publicado).</div>}
      {status && !status.canWrite && (
        <div className="error" style={{ background: 'var(--amber-2)', color: '#93370d' }}>
          <AlertTriangle size={14} style={{ verticalAlign: -2 }} /> Dá para ver e baixar, mas <b>salvar no GitHub</b> ainda não está ligado: falta o <code>GITHUB_TOKEN</code> no Supabase (veja <i>docs/CONFIGURACAO.md</i>).
        </div>
      )}
      {err && <div className="error">{err}</div>}
      {ok && <div className="tag green" style={{ padding: '8px 12px', marginBottom: 14, whiteSpace: 'normal' }}>{ok}</div>}

      {isCloud && (
        <div className="split">
          <div className="card stack">
            {!current ? (
              <div className="empty">Escolha um arquivo ao lado para ver ou editar.{busy === 'abrir' && <> <Loader2 size={14} className="spin" /></>}</div>
            ) : (
              <>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="row"><FileCode2 size={18} /><b>{current.path}</b>{dirty && <span className="tag amber">não salvo</span>}</div>
                  <div className="row">
                    <button className="btn sm" onClick={() => download(current.path, current.content)}><Download size={14} /> Baixar arquivo</button>
                    <a className="btn sm" href={current.html_url} target="_blank" rel="noreferrer"><Github size={14} /> Ver no GitHub</a>
                  </div>
                </div>
                <textarea className="code-editor" spellCheck={false} value={current.content} onKeyDown={onKey}
                  aria-label={`Código de ${current.path}`} rows={Math.min(32, Math.max(12, lines + 1))}
                  onChange={(e) => setCurrent({ ...current, content: e.target.value })} />
                <small className="muted">{lines} linhas · Tab insere 4 espaços</small>
                {current.path.endsWith('.py') && checkPython(current.content).map((pr) => (
                  <div key={pr} className="tag amber" style={{ whiteSpace: 'normal', padding: '6px 10px' }}><AlertTriangle size={12} /> {pr}</div>
                ))}
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input type="text" aria-label="Descrição da mudança" value={msg} onChange={(e) => setMsg(e.target.value)}
                    placeholder="O que mudou? Ex.: Saída 1: ajustei o giro da M03" />
                  <button className="btn primary" disabled={!dirty || !status?.canWrite || !!busy} onClick={save}>
                    {busy === 'salvar' ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Publicar no GitHub
                  </button>
                </div>
                {dirty && <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setCurrent({ ...current, content: current.original })}>Desfazer mudanças</button>}
              </>
            )}
          </div>

          <div className="stack">
            <div className="card" style={{ padding: 8 }}>
              <h2 style={{ padding: '8px 8px 0' }}>Arquivos</h2>
              {sorted.map((f) => {
                const n = sortieNumber(f.path);
                return (
                  <button key={f.path} onClick={() => f.editable && open(f.path)} disabled={!f.editable} className="file-row"
                    style={{ background: current?.path === f.path ? 'var(--blue-2)' : 'none' }}>
                    <FileCode2 size={15} />
                    <span style={{ flex: 1 }}>{f.path}</span>
                    {n > 0 && <span className="tag blue">Saída {n}</span>}
                    {f.path === 'main.py' && <span className="tag dark">principal</span>}
                    {f.path === 'base.py' && <span className="tag">configuração</span>}
                  </button>
                );
              })}
              {!files.length && !err && <div className="empty"><Loader2 size={16} className="spin" /></div>}
            </div>

            <div className="card">
              <h2><History size={15} style={{ verticalAlign: -2 }} /> Histórico do GitHub</h2>
              {commits.slice(0, 12).map((c) => (
                <a key={c.sha} href={c.url} target="_blank" rel="noreferrer" className="commit-row">
                  <span className="ellipsis" style={{ fontWeight: 600 }}>{c.message.split('\n')[0]}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {whoByCommit[c.sha] ? `pelo site · ${whoByCommit[c.sha]}` : c.author} · {fmtDate(c.date, true)} · <code>{c.sha.slice(0, 7)}</code>
                  </span>
                </a>
              ))}
              {!commits.length && <div className="muted">—</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
