# Testes automáticos

Um robô ([Playwright](https://playwright.dev)) abre o site no **computador** e no **celular** e:

- **explora todas as telas**: clica nos botões seguros e procura erros de JavaScript, imagens quebradas,
  páginas mais largas que a tela, lentidão e problemas de acessibilidade ([axe](https://www.deque.com/axe/));
- **testa os fluxos**: Kanban, Calculadora → Histórico, Registro de saídas, Estratégia (mapa), SWOT,
  Melhorias, Equipe, Regras, TV e Music.

Os testes usam o modo local (dados de mentira no navegador) e **nunca mexem no banco real**.

```bash
npm test               # roda tudo e gera test-results/RELATORIO.md
npm run test:report    # abre o relatório visual com prints das falhas
```

## No GitHub

Os testes rodam sozinhos a cada atualização: aba **Actions → Testes automáticos**.
Para rodar na hora: **Run workflow**. O resumo aparece na página da execução e o relatório completo
(com prints) fica em **Artifacts**.

## Arquivos

| Arquivo | O que faz |
| --- | --- |
| `tests/explorador.spec.js` | visita e “cutuca” todas as telas |
| `tests/fluxos.spec.js` | testes de ponta a ponta |
| `tests/relatorio-reporter.js` | escreve o relatório em português |
| `tests/playwright.config.js` | configuração (computador + celular) |
