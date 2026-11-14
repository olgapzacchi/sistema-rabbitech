// EXPLORADOR: visita todas as telas, clica em tudo que é seguro e procura problemas.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PAGES, watchErrors, freshStart, addFinding } from './helpers.js';

const TRAD = {
  'color-contrast': 'Texto com pouco contraste com o fundo (difícil de ler)',
  'button-name': 'Botão sem nome para leitores de tela',
  'select-name': 'Lista de seleção sem rótulo',
  'label': 'Campo de formulário sem rótulo',
  'scrollable-region-focusable': 'Área com rolagem que não dá para acessar pelo teclado',
  'image-alt': 'Imagem sem texto alternativo',
  'link-name': 'Link sem nome',
};
const PERIGOSO = /excluir|remover|apagar|sair|limpar|desafixar|desfavoritar|tirar|fechar/i;

for (const [route, name] of PAGES) {
  test(`explorar: ${name}`, async ({ page }, info) => {
    const errors = watchErrors(page);
    const proj = info.project.name;
    await freshStart(page);

    const t0 = Date.now();
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    const ms = Date.now() - t0;
    if (ms > 3000) addFinding(proj, name, 'melhoria', 'Lentidão', `A tela levou ${ms} ms para abrir.`);

    // Página mais larga que a tela (rolagem lateral)
    const overflow = await page.evaluate(() => Math.max(
      document.documentElement.scrollWidth - window.innerWidth,
      ...[...document.querySelectorAll('main .card, main form')].map((el) => Math.round(el.getBoundingClientRect().right - window.innerWidth)),
    ));
    if (overflow > 2) addFinding(proj, name, 'problema', 'Layout', `A página fica ${overflow}px mais larga que a tela (rolagem para o lado).`);

    // Imagens quebradas
    const broken = await page.evaluate(() => [...document.images]
      .filter((i) => i.complete && i.naturalWidth === 0 && i.src.startsWith(location.origin)).map((i) => i.getAttribute('src')));
    for (const src of broken) addFinding(proj, name, 'problema', 'Imagem quebrada', src);

    // Botões sem nome (leitores de tela não conseguem anunciar)
    const unnamed = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent && !b.textContent.trim() && !b.getAttribute('title') && !b.getAttribute('aria-label')).length);
    if (unnamed) addFinding(proj, name, 'melhoria', 'Acessibilidade', `${unnamed} botão(ões) só com ícone, sem nome (title/aria-label).`);

    // Acessibilidade automática (axe)
    const axe = await new AxeBuilder({ page }).disableRules(['region']).analyze();
    for (const v of axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact))) {
      addFinding(proj, name, 'melhoria', 'Acessibilidade', `${TRAD[v.id] || v.help} (${v.nodes.length} elemento(s)) — regra \`${v.id}\``);
    }

    // Clica em todos os botões seguros, um por um, e confere se nada quebra
    page.on('dialog', (d) => d.dismiss()); // cancela confirmações e perguntas
    const count = await page.locator('main button:visible').count();
    let clicked = 0;
    let repetidos = 0; // listas longas de botões iguais (ex.: dias do calendário): testa só alguns
    for (let i = 0; i < Math.min(count, 40); i++) {
      const btn = page.locator('main button:visible').nth(i);
      if (!(await btn.count())) break;
      const label = ((await btn.textContent()) || (await btn.getAttribute('title')) || '').trim();
      if (PERIGOSO.test(label) || (await btn.isDisabled())) continue;
      if ((await btn.getAttribute('data-repetido')) !== null && ++repetidos > 3) continue;
      const before = errors.length;
      await btn.click({ timeout: 2000 }).catch(() => {});
      clicked++;
      await page.waitForTimeout(120);
      if (errors.length > before) addFinding(proj, name, 'problema', 'Erro ao clicar', `Botão “${label || '(sem nome)'}”: ${errors.at(-1)}`);
      if (!page.url().endsWith(route)) await page.goto(route);
    }
    info.annotations.push({ type: 'cliques', description: String(clicked) });

    for (const e of errors) addFinding(proj, name, 'problema', 'Erro', e);
    expect(errors, 'erros de JavaScript na tela').toEqual([]);
  });
}

test('menu lateral leva a todas as telas', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await freshStart(page);
  for (const [route, name] of PAGES) {
    if (isMobile) await page.getByRole('button', { name: 'Abrir menu' }).click();
    await page.locator('nav').getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(route === '/' ? '/$' : route + '$'));
    await expect(page.locator('h1')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
