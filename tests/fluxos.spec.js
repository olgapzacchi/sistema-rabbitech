// FLUXOS: testa de ponta a ponta o que a equipe faz no dia a dia.
import { test, expect } from '@playwright/test';
import { watchErrors, freshStart } from './helpers.js';

test.beforeEach(async ({ page }) => { await freshStart(page); });
test.afterEach(async ({ page }, info) => { if (info.status !== info.expectedStatus) await page.screenshot({ path: info.outputPath('falha.png') }); });

test('Kanban: criar tarefa, atribuir aluno e concluir', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova tarefa' }).click();
  await page.getByLabel('Título').fill('Ajustar garra da M09');
  await page.getByRole('button', { name: 'Nayon' }).click();
  await page.getByRole('button', { name: 'Salvar tarefa' }).click();
  const card = page.locator('.kcard', { hasText: 'Ajustar garra da M09' });
  await expect(card).toBeVisible();
  await card.getByTitle('Avançar').click();
  await page.locator('.kcard', { hasText: 'Ajustar garra da M09' }).getByTitle('Avançar').click();
  await expect(page.locator('.kcol').nth(2).locator('.kcard', { hasText: 'Ajustar garra da M09' })).toBeVisible();
  await expect(page.locator('.kpi', { hasText: 'Concluídas na semana' })).toContainText('1');
  expect(errors).toEqual([]);
});

test('Calculadora: pontuar, salvar round e ver no Histórico', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/calculadora');
  await expect(page.locator('.score-box .big')).toHaveText('70'); // 6 fichas de precisão (50) + M10 que já começa pontuada (20)
  await page.getByText('Drone já não toca o tapete').click();
  await expect(page.locator('.score-box .big')).toHaveText('90');
  await page.getByRole('button', { name: 'Salvar round' }).click();
  await expect(page.getByText('Round salvo com 90 pontos.')).toBeVisible();
  await page.goto('/historico');
  await expect(page.locator('.kpi', { hasText: 'Melhor round' })).toContainText('90');
  await expect(page.locator('.kpi', { hasText: 'Quantidade de rounds' })).toContainText('1');
  expect(errors).toEqual([]);
});

test('Registro de saídas: tempo inválido é barrado e teste válido é salvo', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/saidas');
  await page.getByRole('button', { name: 'M05', exact: true }).click();
  await page.getByLabel('Tempo gasto (s)').fill('493985');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Registrar teste' }).click();
  await expect(page.getByText('Testes registrados (0)')).toBeVisible(); // nada salvo
  expect(await page.getByLabel('Tempo gasto (s)').evaluate((el) => el.validity.valid)).toBe(false);
  await page.getByLabel('Tempo gasto (s)').fill('23.5');
  await page.getByRole('button', { name: 'Registrar teste' }).click();
  await expect(page.getByText('Testes registrados (1)')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Estratégia: saída com missões aparece marcada no mapa', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/estrategia');
  await page.locator('.card', { hasText: 'Lado vermelho' }).getByRole('button', { name: 'Saída' }).click();
  await page.getByRole('button', { name: 'Concluir' }).click();
  const card = page.locator('.card', { hasText: 'Lado vermelho' });
  await card.getByRole('button', { name: /M03$/ }).click();
  await card.getByRole('button', { name: /M04$/ }).click();
  await expect(card.locator('div', { hasText: /^Rota:/ }).first()).toContainText('M03 → M04');
  // missões 60 + pontos fixos 90 (fichas 50 + inspeção 20 + M10 20)
  await expect(page.locator('.score-box .big')).toHaveText('150');
  await page.getByLabel(/Fichas de precisão/).uncheck();
  await expect(page.locator('.score-box .big')).toHaveText('100');
  await page.getByLabel(/Fichas de precisão/).check();
  await expect(page.getByLabel(/Missão compartilhada/)).toBeDisabled(); // sem a M07 numa saída
  await expect(page.locator('.mapbox polyline')).toHaveCount(2); // rota automática (contorno + linha)
  expect(errors).toEqual([]);
});

test('Análise: classificar missões em fácil, difícil, vantajosa e desvantajosa', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/analise');
  const facil = page.locator('.swot .card').filter({ has: page.getByRole('heading', { name: 'Fácil', exact: true }) });
  await facil.getByLabel('Adicionar missão em Fácil').selectOption({ label: 'M08 · Emaranhado · 30 pts' });
  await expect(facil.getByText('M08 · Emaranhado · 30 pts')).toBeVisible();
  await expect(facil).toContainText('1 missão · 30 pts');
  // a mesma missão pode estar em outra caixa
  const vant = page.locator('.swot .card').filter({ has: page.getByRole('heading', { name: 'Vantajosa', exact: true }) });
  await vant.getByLabel('Adicionar missão em Vantajosa').selectOption({ label: 'M08 · Emaranhado · 30 pts' });
  await expect(vant.getByText('M08 · Emaranhado · 30 pts')).toBeVisible();
  // e some da lista de opções da caixa onde já está
  await expect(facil.getByLabel('Adicionar missão em Fácil').locator('option', { hasText: 'M08' })).toHaveCount(0);
  await facil.getByRole('button', { name: /Tirar Emaranhado de Fácil/ }).click();
  await expect(facil).toContainText('Nenhuma missão ainda.');
  expect(errors).toEqual([]);
});

test('Melhorias: registrar uma melhoria', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/melhorias');
  await page.getByLabel('Título').fill('Garra mais firme');
  await page.getByLabel('Antes / problema').fill('Soltava a peça');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByRole('heading', { name: 'Garra mais firme' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Equipe: 10 alunos cadastrados e adicionar novo', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/equipe');
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByPlaceholder('Nome').fill('Aluno Teste');
  await page.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(11);
  expect(errors).toEqual([]);
});

test('Regras: anexar documento por link', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/regras');
  await page.getByLabel('Título').fill('Caderno de regras');
  await page.getByPlaceholder('https://…').fill('https://example.com/regras.pdf');
  await page.getByRole('button', { name: 'Anexar' }).click();
  await expect(page.getByRole('button', { name: 'Caderno de regras' }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('TV e Music: fixar por link e criar playlist', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/tv');
  await page.getByRole('button', { name: /Fixados/ }).click();
  await page.getByPlaceholder('https://www.youtube.com/watch?v=…').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await page.getByPlaceholder('Título').fill('Vídeo de teste');
  await page.getByTitle('Fixar').click();
  await expect(page.getByText('Vídeo de teste').first()).toBeVisible();
  await page.goto('/music');
  await page.getByRole('button', { name: /^Playlists \(/ }).click();
  await page.getByPlaceholder(/Nome da nova playlist/).fill('Treino');
  await page.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByText('Treino').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('Aparência: escolher modo, cor e fundo e manter ao recarregar', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page);
  await page.goto('/configuracoes');
  await page.getByRole('button', { name: 'Escuro' }).click();
  await page.getByRole('radio', { name: 'Dourado' }).click();
  await page.getByRole('button', { name: 'Liso' }).click();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-modo', 'dark');
  await expect(html).toHaveAttribute('data-cor', 'dourado');
  await expect(html).toHaveAttribute('data-fundo', 'liso');
  await page.reload();
  await expect(html).toHaveAttribute('data-cor', 'dourado');
  await page.getByRole('button', { name: 'Voltar ao padrão' }).click();
  await expect(html).toHaveAttribute('data-modo', 'light');
  await expect(html).toHaveAttribute('data-cor', 'azul');
  expect(errors).toEqual([]);
});

test('Calculadora: rodada perfeita soma o máximo do caderno (450 de missões + 50 + 20 = 520)', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/calculadora');
  // marca tudo que dá pontos (as caixas de restrição, em cinza, ficam desmarcadas)
  const caixas = page.locator('label.cond:not(.muted) input[type=checkbox]');
  for (let i = 0; i < await caixas.count(); i++) await caixas.nth(i).check();
  for (const mais of await page.locator('.stepper button:last-child').all()) for (let i = 0; i < 5; i++) await mais.click(); // passa do limite de propósito
  for (const sel of await page.locator('.mission select').all()) await sel.selectOption({ index: (await sel.locator('option').count()) - 1 }).catch(() => {});
  await page.getByLabel(/Inspeção de equipamento/).check();
  await expect(page.locator('.score-box')).toContainText('Missões 450 · precisão 50 · inspeção 20 · 15/15 missões');
  await expect(page.locator('.score-box .big')).toHaveText('520');
  await expect(page.locator('.mission', { hasText: 'Correria das Formigas' })).toContainText('de 40'); // 4 fragmentos de 10
  expect(errors).toEqual([]);
});

test('Kanban: tarefa com "A decidir integrante" mostra a etiqueta e entra no filtro', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Nova tarefa' }).click();
  await page.getByLabel('Título').fill('Programar saída 1');
  const decidir = page.getByRole('button', { name: 'A decidir integrante' });
  await decidir.click();
  await expect(decidir).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Luiz Narciso' }).or(page.getByRole('button', { name: 'Luiz' }).first()).click(); // escolher um aluno tira o "a decidir"
  await expect(decidir).toHaveAttribute('aria-pressed', 'false');
  await decidir.click();
  await page.getByRole('button', { name: 'Salvar tarefa' }).click();
  await expect(page.locator('.kcard', { hasText: 'Programar saída 1' }).getByText('A decidir integrante')).toBeVisible();
  await page.getByLabel('Filtrar por aluno').selectOption('decidir');
  await expect(page.locator('.kcard', { hasText: 'Programar saída 1' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Calendário: evento de vários dias aparece em cada dia e a contagem do Início o mostra', async ({ page }) => {
  const errors = watchErrors(page);
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hoje = new Date();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 2);
  await page.goto('/calendario');
  await page.getByRole('button', { name: 'Evento' }).click();
  await page.getByLabel('Nome do evento').fill('Regional de teste');
  await page.getByLabel('Tipo').selectOption('torneio');
  await page.getByLabel(/Até o dia/).fill(ymd(fim));
  await page.getByRole('button', { name: 'Salvar' }).click();
  // o evento aparece no dia de hoje e também 2 dias depois
  await expect(page.getByRole('status')).toContainText('Regional de teste');
  await page.getByRole('button', { name: new RegExp(`^${fim.getDate()} de .*Regional de teste`) }).click();
  await expect(page.locator('.card', { hasText: 'Regional de teste' }).getByText(/Torneio · .* a |Torneio · .* e /).first()).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Dia 1 de 3');
  expect(errors).toEqual([]);
});
