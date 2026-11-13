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
cp .env.example .env.local   # preencha com os dados do Supabase (opcional em dev)
npm run dev
```

Sem `.env.local`, o `npm run dev` roda em **modo local** (dados só no navegador). Em produção o Supabase é obrigatório: sem as variáveis o site mostra uma tela avisando.

## Banco de dados (Supabase)

O esquema completo fica em **`supabase/schema.sql`**: 10 tabelas, relacionamentos, índices, RLS, storage e dados iniciais. Pode ser rodado de novo sem perder dados.

| Tabela | Tela | Observações |
| --- | --- | --- |
| `members` | Equipe | 10 alunos já cadastrados |
| `team_tasks` | Início (Kanban) | `assignee_ids` = lista de ids de `members` |
| `strategies` | Estratégia | |
| `sorties` | Estratégia | → `strategies` (apaga junto), lado, missões, linha no mapa |
| `rounds` | Calculadora / Histórico | → `strategies` (opcional) |
| `sortie_logs` | Registro de saídas | → `sorties`, → `members` |
| `swot_items` | Análise / SWOT | |
| `improvements` | Melhorias | → `members` |
| `documents` | Regras | arquivos no bucket `documentos` |
| `media_links` | Rabbitech TV / Music | `kind` = youtube ou spotify |

**Quem acessa:** só usuários logados. Para limitar à equipe, cadastre os e-mails em `allowed_emails`. Enquanto a lista estiver vazia, qualquer conta criada no site entra.

```sql
insert into public.allowed_emails (email) values ('professora@escola.br'), ('aluno@escola.br');
```

## Checklist de configuração

**Supabase**
1. SQL Editor → New query → cole todo o `supabase/schema.sql` → Run (deve aparecer *Success*).
2. Authentication → URL Configuration → *Site URL* = endereço do site na Vercel (ex.: `https://sistema-rabbitech-v2.vercel.app`) e adicione o mesmo em *Redirect URLs*.
3. (Opcional) Authentication → Sign In / Providers → Email → desligue *Confirm email* para entrar sem confirmar.
4. Depois que todos tiverem conta: cadastre os e-mails em `allowed_emails` (SQL acima) e, se quiser, desative novos cadastros (*Allow new users to sign up*).

**Vercel** (Project → Settings → Environment Variables, para Production/Preview/Development)

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` (Data API → Project URL) |
| `VITE_SUPABASE_ANON_KEY` | Publishable key `sb_publishable_...` (API Keys) — **nunca** a Secret key |

Depois: Deployments → ⋯ → **Redeploy**. Framework: Vite (detectado). Build: `npm run build`, saída: `dist`.

## Tecnologia

React 18 + Vite · React Router · Recharts · Supabase (Postgres, Auth, Storage, Realtime) · Vercel.

Código: `src/pages` (uma tela por arquivo), `src/lib/scoring.js` (pontuação), `src/lib/supabase.js` (cliente Supabase) e `src/lib/db.js` (leitura/gravação + tempo real).
