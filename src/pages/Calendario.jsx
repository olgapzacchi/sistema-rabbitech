import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Trophy, ClipboardCheck, Dumbbell, Users, Coffee, PartyPopper, Star } from 'lucide-react';
import { useTable, insert, remove } from '../lib/db.js';
import { PageHead, ErrorBox } from '../components/ui.jsx';
import Contagem from '../components/Contagem.jsx';
import { ymd, parse, periodo, diasDoPeriodo } from '../lib/datas.js';

const KINDS = { torneio: 'Torneio', reuniao: 'Reunião', treino: 'Treino', data: 'Data comemorativa', recesso: 'Recesso', outro: 'Outro' };
const ICONE = { torneio: Trophy, reuniao: Users, treino: Dumbbell, data: PartyPopper, recesso: Coffee, outro: Star };
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const longDate = (s) => parse(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Calendario() {
  const events = useTable('team_events');
  const tasks = useTable('team_tasks');
  const hoje = ymd(new Date());
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(hoje);

  // data -> itens do dia (eventos, inclusive os de vários dias, e prazos de tarefas ainda abertas)
  const byDay = useMemo(() => {
    const m = {};
    const put = (d, it) => { (m[d] ||= []).push(it); };
    events.rows.forEach((e) => diasDoPeriodo(e.event_date, e.end_date).forEach((dia) => put(dia, {
      type: 'evento', id: e.id, title: e.title, kind: e.kind, time: e.event_time?.slice(0, 5), ini: e.event_date, fim: e.end_date,
    })));
    tasks.rows.filter((t) => t.due_date && t.status !== 'done').forEach((t) => put(t.due_date, { type: 'prazo', id: t.id, title: t.title }));
    return m;
  }, [events.rows, tasks.rows]);

  // próximos: cada item aparece uma vez, no primeiro dia que ainda vai acontecer (treinos ficam só na grade)
  const proximos = useMemo(() => {
    const visto = new Set();
    return Object.entries(byDay)
      .filter(([d]) => d >= hoje).sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([d, list]) => list.map((it) => ({ ...it, date: d })))
      .filter((it) => it.kind !== 'treino' && !visto.has(`${it.type}-${it.id}`) && visto.add(`${it.type}-${it.id}`))
      .slice(0, 6);
  }, [byDay, hoje]);

  // grade do mês: começa no domingo da primeira semana
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + i));
  const mover = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <>
      <PageHead title="Calendário" desc="Torneio, reuniões, treinos, recessos e os prazos das tarefas do Kanban." />
      <ErrorBox error={events.error || tasks.error} />
      <div className="split">
        <div className="card">
          <div className="card-head">
            <h2 className="cap">{MESES[cursor.getMonth()]} de {cursor.getFullYear()}</h2>
            <div className="row">
              <button className="btn sm" onClick={() => { setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSel(hoje); }}>Hoje</button>
              <button className="icon-btn" aria-label="Mês anterior" title="Mês anterior" onClick={() => mover(-1)}><ChevronLeft size={18} /></button>
              <button className="icon-btn" aria-label="Próximo mês" title="Próximo mês" onClick={() => mover(1)}><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="cal-grid" role="group" aria-label="Dias do mês">
            {DIAS.map((d) => <div key={d} className="cal-dow" aria-hidden="true">{d}</div>)}
            {cells.map((d) => {
              const key = ymd(d);
              const list = byDay[key] || [];
              const fora = d.getMonth() !== cursor.getMonth();
              const tipos = [...new Set(list.filter((i) => i.type === 'evento').map((i) => i.kind))].slice(0, 3);
              const nomes = list.map((i) => i.title).join(', ');
              return (
                <button key={key} data-repetido aria-label={`${d.getDate()} de ${MESES[d.getMonth()]}${list.length ? `: ${nomes}` : ''}`}
                  aria-pressed={key === sel}
                  className={'cal-day' + (fora ? ' out' : '') + (key === hoje ? ' today' : '') + (key === sel ? ' sel' : '')}
                  onClick={() => setSel(key)}>
                  <span>{d.getDate()}</span>
                  {list.length > 0 && (
                    <span className="cal-marks">
                      {tipos.map((k) => { const I = ICONE[k] || Star; return <I key={k} size={11} aria-hidden="true" />; })}
                      {list.some((i) => i.type === 'prazo') && <ClipboardCheck size={11} aria-hidden="true" />}
                      {list.length > 1 && <b>{list.length}</b>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 12, fontSize: 12, gap: 12 }}>
            {Object.entries(KINDS).map(([k, nome]) => { const I = ICONE[k]; return <span key={k} className="muted"><I size={11} /> {nome.toLowerCase()}</span>; })}
            <span className="muted"><ClipboardCheck size={11} /> prazo de tarefa</span>
          </div>
        </div>

        <div className="stack">
          <Contagem eventos={events.rows} />
          <Dia dia={sel} itens={byDay[sel] || []} />
          <div className="card">
            <h2>Próximos</h2>
            {!proximos.length && <div className="muted">Nada marcado pela frente.</div>}
            {proximos.map((it) => (
              <button key={`${it.type}-${it.id}`} className="cal-next" onClick={() => { setSel(it.date); setCursor(new Date(parse(it.date).getFullYear(), parse(it.date).getMonth(), 1)); }}>
                <span className="ellipsis" style={{ fontWeight: 600 }}>{it.title}</span>
                <small className="muted">
                  {it.type === 'prazo' ? 'Prazo · ' : `${KINDS[it.kind]} · `}
                  {it.type === 'evento' && it.fim && it.fim !== it.ini ? periodo(it.ini, it.fim) : parse(it.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                </small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Dia({ dia, itens }) {
  const vazio = { title: '', kind: 'reuniao', time: '', fim: '' };
  const [f, setF] = useState(vazio);
  const [aberto, setAberto] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!f.title.trim()) return;
    await insert('team_events', { title: f.title.trim(), kind: f.kind, event_date: dia, end_date: f.fim && f.fim > dia ? f.fim : null, event_time: f.time || null, notes: '' });
    setF(vazio);
    setAberto(false);
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="cap">{longDate(dia)}</h2>
        {!aberto && <button className="btn sm" onClick={() => setAberto(true)}><Plus size={14} /> Evento</button>}
      </div>
      {!itens.length && !aberto && <div className="muted">Nada neste dia.</div>}
      {itens.map((it) => {
        const I = it.type === 'evento' ? ICONE[it.kind] || Star : ClipboardCheck;
        return (
          <div key={`${it.type}-${it.id}`} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap' }}>
            <I size={14} aria-hidden="true" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 600 }}>{it.title}</div>
              <small className="muted">
                {it.type === 'prazo' ? 'Prazo de tarefa' : `${KINDS[it.kind]}${it.time ? ` · ${it.time}` : ''}${it.fim && it.fim !== it.ini ? ` · ${periodo(it.ini, it.fim)}` : ''}`}
              </small>
            </div>
            {it.type === 'evento' && (
              <button className="icon-btn" title="Remover evento" aria-label={`Remover ${it.title}`}
                onClick={() => confirm(`Remover “${it.title}”${it.fim && it.fim !== it.ini ? ' (todos os dias)' : ''}?`) && remove('team_events', it.id)}><Trash2 size={14} /></button>
            )}
          </div>
        );
      })}
      {aberto && (
        <form className="stack" style={{ gap: 10, marginTop: 8 }} onSubmit={add}>
          <input type="text" aria-label="Nome do evento" placeholder="Ex.: Torneio regional" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus />
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <select aria-label="Tipo" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="time" aria-label="Horário (opcional)" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
          </div>
          <label className="field">Até o dia (opcional, para eventos de vários dias)
            <input type="date" min={dia} value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} />
          </label>
          <div className="row">
            <button className="btn primary" disabled={!f.title.trim()}>Salvar</button>
            <button type="button" className="btn" onClick={() => setAberto(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
