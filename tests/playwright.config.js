// Testes automáticos da plataforma (Playwright).
//   npm test              → roda tudo e gera o relatório (test-results/RELATORIO.md)
//   npm run test:report   → abre o relatório visual (HTML)
// Este arquivo fica dentro de tests/; os caminhos abaixo são relativos a esta pasta.
// O site é aberto em modo local (dados no navegador), então os testes nunca mexem no banco real.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results/artefatos',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../playwright-report', open: 'never' }],
    ['./relatorio-reporter.js'],
  ],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 800 } } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // servidor de desenvolvimento sem variáveis do Supabase = modo local
    command: 'npx vite --port 4173 --strictPort',
    url: 'http://localhost:4173',
    cwd: '..',
    reuseExistingServer: !process.env.CI,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});
