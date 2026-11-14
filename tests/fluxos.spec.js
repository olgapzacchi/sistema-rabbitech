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
  await expect(page.locator('.score-box .big')).toHaveText('50'); // 6 fichas de precisão = 50
  await page.getByText('Drone já não toca o tapete').click();
  await expect(page.locator('.score-box .big')).toHaveText('70');
  await page.getByRole('button', { name: 'Salvar round' }).click();
  await expect(page.getByText('Round salvo com 70 pontos.')).toBeVisible();
  await page.goto('/historico');
  await expect(page.locator('.kpi', { hasText: 'Melhor round' })).toContainText('70');
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
  await expect(page.locator('.score-box .big')).toHaveText('60');
  await expect(page.locator('.mapbox polyline')).toHaveCount(2); // rota automática (contorno + linha)
  expect(errors).toEqual([]);
});

test('Análise: adicionar item no SWOT', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/analise');
  const forcas = page.locator('.swot .card', { hasText: 'Forças' });
  await forcas.getByPlaceholder('Adicionar item…').fill('Robô rápido na M01');
  await forcas.getByRole('button').last().click();
  await expect(forcas.getByText('Robô rápido na M01')).toBeVisible();
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
