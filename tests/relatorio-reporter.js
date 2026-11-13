// Gera test-results/RELATORIO.md: o que quebrou + o que pode melhorar, em português.
import fs from 'node:fs';
import path from 'node:path';

export default class RelatorioReporter {
  constructor() { this.results = []; }
  onTestEnd(test, result) {
    this.results.push({
      title: test.title, project: test.parent?.project()?.name ?? '', status: result.status,
      ok: result.status === test.expectedStatus,
      error: result.error?.message?.replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 6).join('\n') ?? '',
      ms: result.duration,
    });
  }
  onEnd() {
    const dir = path.resolve('test-results', 'achados');
    const findings = fs.existsSync(dir)
      ? fs.readdirSync(dir).flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)))
      : [];
    const failed = this.results.filter((r) => !r.ok);
    const passed = this.results.length - failed.length;
    // agrupa achados iguais vistos no computador e no celular
    const grouped = new Map();
    for (const f of findings) {
      const key = `${f.severity}|${f.page}|${f.kind}|${f.detail.replace(/\(\d+ elemento\(s\)\)/, '')}`;
      if (!grouped.has(key)) grouped.set(key, { ...f, where: new Set() });
      grouped.get(key).where.add(f.project);
    }
    const list = [...grouped.values()];
    const probs = list.filter((f) => f.severity === 'problema');
    const melh = list.filter((f) => f.severity === 'melhoria');
    const line = (f) => `- **${f.page}** · ${f.kind} (${[...f.where].join(', ')}): ${f.detail}`;
    const md = [
      `# Relatório de testes — Rabbitech`,
      ``,
      `Gerado em ${new Date().toLocaleString('pt-BR')}.`,
      ``,
      `| | Quantidade |`, `|---|---|`,
      `| ✅ Testes que passaram | ${passed} |`,
      `| ❌ Testes que falharam | ${failed.length} |`,
      `| 🔴 Problemas encontrados pelo explorador | ${probs.length} |`,
      `| 🟡 Sugestões de melhoria | ${melh.length} |`,
      ``,
      `## ❌ O que está dando errado`,
      failed.length ? failed.map((r) => `### ${r.title} (${r.project})\n\`\`\`\n${r.error}\n\`\`\``).join('\n\n') : '_Nenhum teste falhou._',
      ``,
      `## 🔴 Problemas encontrados ao explorar as telas`,
      probs.length ? probs.map(line).join('\n') : '_Nenhum problema encontrado._',
      ``,
      `## 🟡 O que pode melhorar`,
      melh.length ? melh.map(line).join('\n') : '_Nenhuma sugestão._',
      ``,
      `---`,
      `Detalhes visuais (prints das falhas): \`npm run test:report\`.`,
    ].join('\n');
    fs.mkdirSync('test-results', { recursive: true });
    fs.writeFileSync(path.join('test-results', 'RELATORIO.md'), md);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
    console.log(`\nRelatório salvo em test-results/RELATORIO.md (${failed.length} falha(s), ${probs.length} problema(s), ${melh.length} melhoria(s)).`);
  }
}
