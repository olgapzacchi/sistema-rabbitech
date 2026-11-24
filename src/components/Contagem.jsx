import { Trophy } from 'lucide-react';
import { ymd, dias, parse, periodo } from '../lib/datas.js';

// contagem regressiva para o próximo torneio (ou "acontecendo agora" nos dias do torneio)
export default function Contagem({ eventos }) {
  const hoje = ymd(new Date());
  const alvo = eventos
    .filter((e) => e.kind === 'torneio' && (e.end_date || e.event_date) >= hoje)
    .sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
  if (!alvo) return null;

  const fim = alvo.end_date || alvo.event_date;
  const n = dias(alvo.event_date);
  const diaAtual = 1 - n, total = dias(fim) - n + 1;
  const grande = n > 1 ? `${n} dias` : n === 1 ? 'Amanhã' : n === 0 ? 'É hoje' : 'Acontecendo agora';
  const detalhe = n < 0 || (n === 0 && total > 1) ? `Dia ${diaAtual} de ${total}` : '';

  return (
    <div className="card contagem" role="status">
      <Trophy size={26} aria-hidden="true" />
      <div>
        <div className="muted" style={{ fontSize: 13 }}>Contagem para: {alvo.title}</div>
        <div className="contagem-num">{grande}</div>
      </div>
      <div className="muted contagem-data">
        {detalhe && <div>{detalhe}</div>}
        {periodo(alvo.event_date, alvo.end_date)} de {parse(alvo.event_date).getFullYear()}
      </div>
    </div>
  );
}
