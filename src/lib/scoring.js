// Lógica de pontuação portada do Rabbitech v1 (index.html), sem dependência do DOM.
import { missions, PRECISION } from '../data/missions.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));

export function emptyRound() {
  return { values: {}, tokens: 6, inspection: false, dock15: 'mine' };
}

function conditionPoints(round, m, c) {
  const v = round.values;
  const check = (k) => !!v[k];
  const k = 'm' + m.id + '_' + c.key;
  if (c.count) {
    let n = clamp(v[k] || 0, 0, 3);
    if (c.nested) n = Math.min(n, v.m14_stationSeeds || 0);
    if (m.id === 6 && c.key === 'fragments' && !check('m6_ant')) n = 0;
    return n * c.points;
  }
  if (c.choice) return c.choice[clamp(v[k] || 0, 0, c.choice.length - 1)][1];
  if (!check(k)) return 0;
  if (c.requires && c.requires.some((r) => !check('m' + m.id + '_' + r))) return 0;
  if (m.id === 4 && c.key === 'leaf2' && (!check('m4_katStart') || check('m4_katOutsideAny') || check('m4_katOutsideEnd'))) return 0;
  if (m.id === 7 && (c.key === 'bonusOur' || c.key === 'bonusOther') && check('m7_noOpponent')) return 0;
  if (m.id === 15 && c.key === 'envBonus') {
    const dock = round.dock15 || 'mine';
    const required = dock === 'mine' ? 'canopy' : dock === 'farm' ? 'compost' : 'skylight';
    if (!check('m15_' + required)) return 0;
  }
  return c.points;
}

export function missionResult(round, m) {
  const check = (k) => !!round.values[k];
  const scores = {};
  m.criteria.forEach((c) => (scores[c.key] = conditionPoints(round, m, c)));
  let total = Object.values(scores).reduce((a, b) => a + b, 0);
  let reason = '';
  if (m.ne && !['habitats', 'leaf', 'architecture'].includes(m.special) && check('m' + m.id + '_touch')) { total = 0; reason = 'zerada pela restrição de equipamento'; }
  if (m.special === 'leaf' && check('m4_touch')) { total = 0; reason = 'zerada pela restrição de equipamento'; }
  if (m.special === 'leaf' && check('m4_katOutsideEnd')) { total = 0; reason = 'inseto terminou fora do habitat'; }
  if (m.special === 'habitats') {
    if (check('m10_spiderTouch')) scores.spider = 0;
    if (check('m10_snailTouch')) scores.snail = 0;
    total = (scores.spider || 0) + (scores.snail || 0);
  }
  if (m.special === 'architecture' && check('m15_dockTouch')) { total = 0; reason = 'zerada pela restrição de equipamento'; }
  return { total, scores, reason };
}

export function scoreRound(round) {
  let missionTotal = 0, done = 0;
  const rows = missions.map((m) => {
    const res = missionResult(round, m);
    missionTotal += res.total;
    if (res.total > 0) done++;
    return { id: m.id, name: m.name, score: res.total, max: m.max, reason: res.reason };
  });
  const tokenPoints = PRECISION[clamp(round.tokens, 0, 6)] || 0;
  const inspectionPoints = round.inspection ? 20 : 0;
  return { total: missionTotal + tokenPoints + inspectionPoints, missionTotal, tokenPoints, inspectionPoints, done, rows };
}

export const missionById = Object.fromEntries(missions.map((m) => [m.id, m]));
export { missions, PRECISION };

// Caixas extras (restrições/condições especiais) exibidas abaixo de cada missão
export function extraChecks(m) {
  if (m.special === 'leaf') return [
    ['m4_katStart', 'O inseto está na posição inicial (exigido para o bônus)'],
    ['m4_katOutsideAny', 'O inseto saiu completamente do habitat em algum momento (perde o bônus)'],
    ['m4_katOutsideEnd', 'O inseto terminou completamente fora do habitat (zera a M04)'],
    ['m4_touch', 'O modelo toca equipamento no fim (zera a missão)'],
  ];
  if (m.special === 'fungus') return [
    ['m7_noOpponent', 'Round sem equipe adversária (sem bônus de cooperação)'],
    ['m7_touch', 'O micélio toca equipamento no fim (restrição de equipamento)'],
  ];
  if (m.special === 'habitats') return [
    ['m10_spiderTouch', 'Equipamento toca o habitat da aranha no fim (perde 10 pts)'],
    ['m10_snailTouch', 'Equipamento toca o habitat do caracol no fim (perde 10 pts)'],
  ];
  if (m.special === 'architecture') return [['m15_dockTouch', 'O modelo toca equipamento no fim (zera a M15)']];
  if (m.ne) return [['m' + m.id + '_touch', 'O modelo toca equipamento no fim (restrição de equipamento)']];
  return [];
}
