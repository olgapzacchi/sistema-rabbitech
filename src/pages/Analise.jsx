import { X } from 'lucide-react';
import { useTable, insert, remove } from '../lib/db.js';
import { missions, missionById } from '../lib/scoring.js';
import { PageHead, ErrorBox } from '../components/ui.jsx';

const CAIXAS = [
  { id: 'facil', label: 'Fácil', color: 'var(--green)', hint: 'O robô faz sem muito esforço ou teste' },
  { id: 'dificil', label: 'Difícil', color: 'var(--amber)', hint: 'Exige muito teste, precisão ou tempo' },
  { id: 'vantajosa', label: 'Vantajosa', color: 'var(--blue)', hint: 'Compensa: muitos pontos pelo esforço' },
  { id: 'desvantajosa', label: 'Desvantajosa', color: 'var(--red)', hint: 'Não compensa: poucos pontos pelo esforço' },
];

const nome = (m) => `M${String(m.id).padStart(2, '0')} · ${m.name} · ${m.max} pts`;

export default function Analise() {
  const tags = useTable('mission_tags');
  return (
    <>
      <PageHead title="Análise do tapete / SWOT" desc="Antes de montar a estratégia, classifique cada missão: fácil, difícil, vantajosa ou desvantajosa. Uma missão pode ficar em mais de uma caixa." />
      <ErrorBox error={tags.error} />
      <div className="swot">
        {CAIXAS.map((c) => <Caixa key={c.id} c={c} itens={tags.rows.filter((t) => t.tag === c.id)} />)}
      </div>
    </>
  );
}

function Caixa({ c, itens }) {
  const colocadas = new Set(itens.map((i) => i.mission_id));
  const lista = itens.map((i) => ({ ...i, m: missionById[i.mission_id] })).filter((i) => i.m).sort((a, b) => a.mission_id - b.mission_id);
  const pontos = lista.reduce((a, i) => a + i.m.max, 0);
  const livres = missions.filter((m) => !colocadas.has(m.id));

  return (
    <div className="card" style={{ borderTopColor: c.color }}>
      <h2 style={{ marginBottom: 2 }}>{c.label}</h2>
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{c.hint}</div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{lista.length} {lista.length === 1 ? 'missão' : 'missões'} · {pontos} pts</div>
      <ul>
        {lista.map((i) => (
          <li key={i.id}>
            <span>{nome(i.m)}</span>
            <button className="icon-btn" title="Tirar da caixa" aria-label={`Tirar ${i.m.name} de ${c.label}`} onClick={() => remove('mission_tags', i.id)}><X size={14} /></button>
          </li>
        ))}
        {!lista.length && <li className="muted"><span>Nenhuma missão ainda.</span></li>}
      </ul>
      <select aria-label={`Adicionar missão em ${c.label}`} value="" disabled={!livres.length} style={{ marginTop: 8 }}
        onChange={(e) => e.target.value && insert('mission_tags', { mission_id: Number(e.target.value), tag: c.id })}>
        <option value="">{livres.length ? '+ Adicionar missão…' : 'Todas as missões já estão aqui'}</option>
        {livres.map((m) => <option key={m.id} value={m.id}>{nome(m)}</option>)}
      </select>
    </div>
  );
}
