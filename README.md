# Rabbitech v2 — Plataforma da equipe FLL

Nova versão da plataforma da equipe Rabbitech (FIRST LEGO League Challenge — temporada BIOGLOW).
A versão antiga continua em [Rabbitech-calculator-first-lego-league](https://github.com/lnzindev/Rabbitech-calculator-first-lego-league) para mostrar a evolução.

## Telas

| Menu | O que faz |
| --- | --- |
| **Início** | Kanban (tarefas para alunos ou grupos), gráfico de produtividade por aluno e por semana |
| **Calculadora** | Pontuação das 15 missões + cronômetro 2:30; salva o round no histórico com a estratégia usada |
| **Registro de saídas** | Cada teste: missões, funcionou (sim/parcial/não), tempo gasto, observação |
| **Estratégia** | Várias estratégias; saídas no lado vermelho/azul, linhas desenhadas no tapete, pontuação por lado e total, observações e planos B |
| **Histórico** | Melhor round, média, quantidade, evolução e comparação por estratégia |
| **Análise / SWOT** | Taxa de sucesso por missão e quadro SWOT |
| **Melhorias** | Registro de mudanças no robô (antes → depois → resultado) |
| **Regras** | Caderno de regras e passo a passo da montagem do tapete (PDF/imagem/link) |
| **Rabbitech TV** | Vídeos/playlists do YouTube dentro da página |
| **Rabbitech Music** | Playlists do Spotify dentro da página |
| **Equipe** | Alunos e grupos |

Removidos da v1: ranking público e o player de música antigo.

## Rodar no computador

```bash
npm install
npm run dev
```

Sem configurar o Supabase, o site roda em **modo local** (dados salvos só no navegador) — bom para testar.

## Banco de dados (novo projeto Supabase)

1. Crie um projeto novo em https://supabase.com.
2. Em **SQL Editor**, cole e rode `supabase/migrations/20261112000000_rabbitech_v2_schema.sql`.
3. Em **Project Settings → API**, copie a *Project URL* e a *anon public key*.
4. Crie `.env.local` a partir de `.env.example` com esses valores.
5. Em **Authentication → Users**, crie as contas da equipe (ou use “Criar conta” na tela de login).

## Publicar na Vercel

1. Importe este repositório na Vercel (framework: Vite).
2. Em **Settings → Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Deploy. O `vercel.json` já cuida das rotas.

## Tecnologia

React 18 + Vite · React Router · Recharts · Supabase (Postgres, Auth, Storage, Realtime) · Vercel.

Código organizado em `src/pages` (uma tela por arquivo), `src/lib/scoring.js` (regras de pontuação) e `src/lib/db.js` (acesso aos dados).
