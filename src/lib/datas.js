// Datas no formato AAAA-MM-DD, sempre no horário local (meio-dia evita virar o dia por fuso).
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parse = (s) => new Date(`${s}T12:00:00`);
export const dias = (s) => Math.round((parse(s) - parse(ymd(new Date()))) / 86400000);

const mes = (d) => d.toLocaleDateString('pt-BR', { month: 'long' });

// "29 de janeiro" · "29 e 30 de janeiro" · "19 a 31 de dezembro" · "19 de dezembro a 4 de janeiro"
export function periodo(ini, fim) {
  const a = parse(ini);
  if (!fim || fim === ini) return `${a.getDate()} de ${mes(a)}`;
  const b = parse(fim);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()} ${dias(fim) - dias(ini) === 1 ? 'e' : 'a'} ${b.getDate()} de ${mes(a)}`;
  return `${a.getDate()} de ${mes(a)} a ${b.getDate()} de ${mes(b)}`;
}

// todos os dias de um período (limite de segurança de 120 dias)
export function diasDoPeriodo(ini, fim) {
  const out = [];
  const d = parse(ini), end = parse(fim || ini);
  for (let i = 0; i < 120 && d <= end; i++) { out.push(ymd(d)); d.setDate(d.getDate() + 1); }
  return out;
}
