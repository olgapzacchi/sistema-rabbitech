import { useCallback, useEffect, useState } from 'react';
import { Camera, Trash2, Save, Loader2, EyeOff } from 'lucide-react';
import { isCloud, supabase } from '../lib/db.js';
import { PageHead, ErrorBox, initials } from '../components/ui.jsx';
import { useTeam } from '../lib/team.jsx';

const BUCKET = 'avatars';

// Redimensiona para 512×512 em WebP: menor, e o canvas descarta os dados de GPS/câmera da foto
async function toAvatar(file) {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const canvas = Object.assign(document.createElement('canvas'), { width: 512, height: 512 });
  canvas.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512);
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => (blob ? resolve(blob) : reject(new Error('Não consegui processar essa imagem.'))), 'image/webp', 0.85));
}

export default function Perfis() {
  const { team, email, isAdmin } = useTeam();
  const teamId = team?.id;
  const [people, setPeople] = useState([]);
  const [photos, setPhotos] = useState({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  const load = useCallback(async () => {
    if (!isCloud || !teamId) return;
    const [{ data: mem, error: e1 }, { data: prof, error: e2 }] = await Promise.all([
      supabase.from('team_members').select('email').eq('team_id', teamId),
      supabase.from('member_profiles').select('*').eq('team_id', teamId),
    ]);
    if (e1 || e2) { setErr((e1 || e2).message); return; }
    const byEmail = Object.fromEntries((prof || []).map((p) => [p.email, p]));
    const list = (mem || []).map((m) => ({ email: m.email, display_name: '', bio: '', avatar_path: null, ...byEmail[m.email] }))
      .sort((a, b) => (a.display_name || a.email).localeCompare(b.display_name || b.email));
    setPeople(list);
    const paths = list.map((p) => p.avatar_path).filter(Boolean);
    const { data: signed } = paths.length
      ? await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
      : { data: [] };
    setPhotos(Object.fromEntries((signed || []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl])));
  }, [teamId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isCloud || !teamId) return undefined;
    const ch = supabase.channel(`perfis-${teamId}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_profiles', filter: `team_id=eq.${teamId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, teamId]);

  const mine = people.find((p) => p.email === email);
  const others = people.filter((p) => p.email !== email);

  if (!isCloud) return <div className="card empty">Os perfis ficam disponíveis no site publicado.</div>;

  return (
    <>
      <PageHead title="Perfis" desc={`Só os colegas da ${team?.name || 'equipe'} veem estes perfis.`} />
      <ErrorBox error={err} />
      {ok && <div className="tag green" style={{ padding: '8px 12px', marginBottom: 14, whiteSpace: 'normal' }}>{ok}</div>}

      {mine && (
        <MeuPerfil key={mine.updated_at || 'novo'} mine={mine} teamId={teamId} email={email} photoUrl={photos[mine.avatar_path]}
          onSaved={(msg) => { setOk(msg); setErr(''); load(); }} onError={(m) => { setErr(m); setOk(''); }} />
      )}

      <h2 style={{ margin: '24px 0 12px' }}>Colegas</h2>
      <div className="profile-grid">
        {others.map((p) => (
          <div key={p.email} className="card profile-card">
            <Avatar name={p.display_name || p.email} url={photos[p.avatar_path]} />
            <b className="ellipsis">{p.display_name || p.email.split('@')[0]}</b>
            {p.bio ? <p className="profile-bio">{p.bio}</p> : <span className="muted" style={{ fontSize: 13 }}>Sem bio ainda.</span>}
            {isAdmin && (p.avatar_path || p.bio) && (
              <div className="row" style={{ marginTop: 'auto' }}>
                {p.avatar_path && <button className="btn sm" onClick={() => moderar(p, 'foto')}><EyeOff size={13} /> Tirar foto</button>}
                {p.bio && <button className="btn sm" onClick={() => moderar(p, 'bio')}><EyeOff size={13} /> Apagar bio</button>}
              </div>
            )}
          </div>
        ))}
        {!others.length && <div className="card empty">Ainda não tem outros colegas com perfil.</div>}
      </div>
    </>
  );

  // o admin modera (ou o próprio aluno remove a própria foto)
  async function moderar(p, o) {
    if (!confirm(o === 'foto' ? `Tirar a foto de ${p.display_name || p.email}?` : `Apagar a bio de ${p.display_name || p.email}?`)) return;
    setErr(''); setOk('');
    try {
      if (o === 'foto') {
        const { error: se } = await supabase.storage.from(BUCKET).remove([p.avatar_path]);
        if (se) throw se;
        const { error } = await supabase.from('member_profiles').update({ avatar_path: null }).eq('team_id', teamId).eq('email', p.email);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('member_profiles').update({ bio: '' }).eq('team_id', teamId).eq('email', p.email);
        if (error) throw error;
      }
      setOk('Pronto. Removido do perfil.'); load();
    } catch (x) { setErr(x.message); }
  }
}

function Avatar({ name, url }) {
  return url
    ? <img className="profile-avatar" src={url} alt="" />
    : <span className="profile-avatar profile-avatar-init">{initials(name)}</span>;
}

function MeuPerfil({ mine, teamId, email, photoUrl, onSaved, onError }) {
  const [name, setName] = useState(mine.display_name || '');
  const [bio, setBio] = useState(mine.bio || '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const preview = file ? URL.createObjectURL(file) : photoUrl;

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      let avatar_path = mine.avatar_path || null;
      if (file) {
        if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
        if (file.size > 10 * 1024 * 1024) throw new Error('A imagem passa de 10 MB.');
        const blob = await toAvatar(file);
        const path = `${teamId}/${email}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/webp' });
        if (error) throw error;
        avatar_path = path;
      }
      const { error } = await supabase.from('member_profiles').upsert({
        team_id: teamId, email, display_name: name.trim(), bio: bio.trim(), avatar_path, updated_at: new Date().toISOString(),
      }, { onConflict: 'team_id,email' });
      if (error) throw error;
      setFile(null);
      onSaved('Perfil salvo.');
    } catch (x) { onError(x.message); } finally { setBusy(false); }
  }

  async function tirarFoto() {
    if (!mine.avatar_path || !confirm('Tirar sua foto do perfil?')) return;
    try {
      const { error: se } = await supabase.storage.from(BUCKET).remove([mine.avatar_path]);
      if (se) throw se;
      const { error } = await supabase.from('member_profiles').update({ avatar_path: null }).eq('team_id', teamId).eq('email', email);
      if (error) throw error;
      onSaved('Foto removida.');
    } catch (x) { onError(x.message); }
  }

  return (
    <form className="card profile-me" onSubmit={save}>
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 18 }}>
        <Avatar name={name || email} url={preview} />
        <div className="stack" style={{ flex: 1, minWidth: 0 }}>
          <label className="field">Seu nome (como os colegas veem)
            <input type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={email.split('@')[0]} />
          </label>
          <label className="field">Bio
            <textarea rows={3} maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Um pouco sobre você (até 280 caracteres)" />
          </label>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              <Camera size={14} /> {file ? file.name : 'Escolher foto'}
              <input type="file" accept="image/*" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            {mine.avatar_path && !file && <button type="button" className="btn sm" onClick={tirarFoto}><Trash2 size={14} /> Tirar foto</button>}
          </div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
        <small className="muted">Você pode trocar seu nome, bio e foto quando quiser.</small>
        <button className="btn primary" disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Salvar perfil
        </button>
      </div>
    </form>
  );
}
