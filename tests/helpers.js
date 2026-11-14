import fs from 'node:fs';
import path from 'node:path';

export const PAGES = [
  ['/', 'Início'], ['/calculadora', 'Calculadora'], ['/saidas', 'Registro de saídas'], ['/estrategia', 'Estratégia'],
  ['/historico', 'Histórico'], ['/analise', 'Análise / SWOT'], ['/melhorias', 'Melhorias'], ['/codigo', 'Código do robô'], ['/regras', 'Regras'],
  ['/tv', 'Rabbitech TV'], ['/music', 'Rabbitech Music'], ['/perfis', 'Perfis'], ['/calendario', 'Calendário'], ['/configuracoes', 'Configurações'], ['/equipe', 'Equipe'],
];

// Coleta erros do navegador enquanto o teste roda
export function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`Erro de JavaScript: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/fonts\.googleapis|ERR_INTERNET_DISCONNECTED|Failed to load resource/i.test(t)) return; // rede externa
    errors.push(`Erro no console: ${t}`);
  });
  return errors;
}

// Começa sempre com dados limpos (modo local)
export async function freshStart(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

// Achados de melhoria (não quebram o teste, vão para o relatório)
const DIR = path.resolve('test-results', 'achados');
export function addFinding(project, pageName, severity, kind, detail) {
  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `${project}-${pageName.replace(/[^\w]+/g, '_')}.jsonl`);
  fs.appendFileSync(file, JSON.stringify({ project, page: pageName, severity, kind, detail }) + '\n');
}
