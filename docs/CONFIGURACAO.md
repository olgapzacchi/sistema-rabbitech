# Configuração (Supabase, Vercel, YouTube e Spotify)

## 1. Banco de dados (Supabase)

O banco completo está em [`supabase/schema.sql`](../supabase/schema.sql): tabelas, relacionamentos, índices,
segurança (RLS), espaço para PDFs e os 10 alunos já cadastrados. Pode ser rodado de novo sem perder dados.

1. Supabase → **SQL Editor** → **New query** → cole todo o `schema.sql` → **Run**.
2. **Authentication → URL Configuration**: *Site URL* = `https://sistema-rabbitech.vercel.app` e o mesmo
   (com `/**` no fim) em *Redirect URLs*. Sem isso, os e-mails de confirmação apontam para `localhost`.
3. (Opcional) **Authentication → Sign In / Providers → Email** → desligue *Confirm email*.

| Tabela | Tela |
| --- | --- |
| `members` | Equipe |
| `team_tasks` | Início (Kanban) |
| `strategies`, `sorties` | Estratégia |
| `rounds` | Calculadora / Histórico |
| `sortie_logs` | Registro de saídas |
| `swot_items` | Análise / SWOT |
| `improvements` | Melhorias |
| `documents` | Regras (arquivos no bucket `documentos`) |
| `media_links`, `tv_playlists`, `tv_playlist_items` | Rabbitech TV e Music |
| `allowed_emails` | Quem pode usar o site |

### Liberar alunos

Só entram e-mails cadastrados em `allowed_emails`:

```sql
insert into public.allowed_emails (email) values ('aluno@exemplo.com') on conflict do nothing;
```

Se alguém não receber o e-mail de confirmação:

```sql
update auth.users set email_confirmed_at = now() where lower(email) = 'aluno@exemplo.com';
```

## 2. Site (Vercel)

O projeto já usa o Supabase da equipe por padrão (`src/lib/supabase.js`), então **não precisa de variáveis**.
Para apontar para outro projeto, cadastre em *Settings → Environment Variables* e faça *Redeploy*:

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | chave *Publishable* (`sb_publishable_...`), **nunca** a Secret |

A cada atualização na branch `main`, a Vercel publica sozinha.

## 3. Busca da Rabbitech TV (YouTube)

1. [Google Cloud](https://console.cloud.google.com) → ative a **YouTube Data API v3**.
2. *APIs & Services → Credentials → Create credentials → API key*.
3. Na chave: **Application restrictions = None** e **API restrictions = YouTube Data API v3**.
4. Supabase → **Edge Functions → Secrets**: `YOUTUBE_API_KEY` = a chave.

Cota grátis: cerca de 100 buscas por dia.

## 4. Busca da Rabbitech Music (Spotify)

1. [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → **Create app** (marque *Web API*).
2. Em *Settings*, copie **Client ID** e **Client secret**.
3. Supabase → **Edge Functions → Secrets**: `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET`.

O player toca a música inteira no computador para quem está logado no Spotify no navegador. No celular, o
Spotify libera só 30 s dentro de sites; o botão **Abrir no Spotify** abre a música inteira no app.

> As chaves ficam só no Supabase. Nunca coloque chaves secretas no código ou no chat.
