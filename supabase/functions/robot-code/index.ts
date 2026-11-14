// Ponte entre o site e o repositório do código do robô (Pybricks) no GitHub — POR EQUIPE.
// Cada equipe define o próprio repositório (teams.github_repo) e, se quiser salvar pelo site,
// o próprio token (guardado em team_integrations, que o site não lê).
// Secrets no Supabase (Edge Functions > Secrets):
//   GITHUB_TOKEN            token da equipe dona do repositório padrão (GITHUB_REPO)
//   GITHUB_REPO             padrão "lnzindev/rabbitech-code-for-pybricks"
//   GITHUB_BRANCH           opcional, padrão "main"
//   VERCEL_DEPLOY_HOOK_URL  opcional, para o botão de redeploy do site
// Só membros DA EQUIPE pedida podem usar (public.is_member_of).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

const DEFAULT_REPO = Deno.env.get("GITHUB_REPO") || "lnzindev/rabbitech-code-for-pybricks";
const BRANCH = Deno.env.get("GITHUB_BRANCH") || "main";
const DEFAULT_TOKEN = Deno.env.get("GITHUB_TOKEN") || "";
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
let REPO = DEFAULT_REPO;
let TOKEN = "";

function keyFrom(name: string, jsonName: string) {
  const direct = Deno.env.get(name);
  if (direct) return direct;
  try { return JSON.parse(Deno.env.get(jsonName) ?? "{}").default ?? ""; } catch { return ""; }
}
const service = () => createClient(Deno.env.get("SUPABASE_URL")!, keyFrom("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS"), { auth: { persistSession: false } });
const HOOK = Deno.env.get("VERCEL_DEPLOY_HOOK_URL") || "";
const EDITABLE = /\.(py|md|txt|json|html|css|js)$/i;

function gh(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rabbitech-platform",
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  return fetch(`https://api.github.com/repos/${REPO}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
}
const toB64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromB64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
const safePath = (p: unknown) => {
  const s = String(p ?? "").replace(/^\/+/, "");
  return s && !s.includes("..") && !s.startsWith(".git/") && s.length < 200 ? s : null;
};
async function ghError(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) return "O token do GitHub é inválido ou expirou (GITHUB_TOKEN).";
  if (res.status === 403 && /rate limit/i.test(body?.message ?? "")) return "Limite de consultas do GitHub atingido. Espere alguns minutos (ou configure o GITHUB_TOKEN).";
  if (res.status === 403 || res.status === 404) return "O token não tem permissão de escrita nesse repositório (Contents: Read and write).";
  if (res.status === 409) return "Alguém salvou esse arquivo antes de você. Recarregue o arquivo e faça a mudança de novo.";
  return `GitHub respondeu ${res.status}: ${body?.message ?? ""}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return reply({ error: "Faça login." }, 401);
  let publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!publicKey) { try { publicKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? ""; } catch { /* sem chave */ } }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, publicKey, { global: { headers: { Authorization: auth } } });
  const { data: ok, error: accessError } = await sb.rpc("is_team_member");
  if (accessError || !ok) return reply({ error: "Sua conta não está liberada para a equipe." }, 403);

  let body: { action?: string; path?: string; content?: string; sha?: string; message?: string; team_id?: string; repo?: string; token?: string } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }

  // Equipe: só quem é membro dela usa o repositório e o token dela
  const teamId = String(body.team_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) return reply({ error: "Equipe inválida." }, 400);
  const { data: member } = await sb.rpc("is_member_of", { t: teamId });
  if (!member) return reply({ error: "Você não faz parte dessa equipe." }, 403);
  const { data: team } = await sb.from("teams").select("name, github_repo").eq("id", teamId).maybeSingle();
  REPO = team?.github_repo || "";
  const { data: integ } = await service().from("team_integrations").select("github_token").eq("team_id", teamId).maybeSingle();
  TOKEN = integ?.github_token || (REPO && REPO === DEFAULT_REPO ? DEFAULT_TOKEN : "");

  if (body.action === "set_github") {
    const { data: admin } = await sb.rpc("is_admin_of", { t: teamId });
    if (!admin) return reply({ error: "Só o administrador da equipe muda o repositório." }, 403);
    const repo = String(body.repo ?? "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
    if (repo && !REPO_RE.test(repo)) return reply({ error: "Repositório inválido. Use dono/nome, ex.: lnzindev/rabbitech-code-for-pybricks" }, 400);
    const { error: upErr } = await sb.from("teams").update({ github_repo: repo }).eq("id", teamId);
    if (upErr) return reply({ error: upErr.message }, 400);
    if (typeof body.token === "string") {
      await service().from("team_integrations").upsert({ team_id: teamId, github_token: body.token.trim() || null, updated_at: new Date().toISOString() });
    }
    return reply({ ok: true, repo });
  }
  if (!REPO && body.action !== "status") return reply({ error: "Esta equipe ainda não tem repositório do robô. O administrador configura na tela Equipe." }, 404);

  try {
    switch (body.action) {
      case "status":
      {
        const { data: platformAdmin } = await sb.rpc("is_platform_admin");
        return reply({ repo: REPO, branch: BRANCH, canWrite: !!TOKEN, canRedeploy: !!HOOK && !!platformAdmin, team: team?.name ?? "" });
      }

      case "tree": {
        const res = await gh(`/git/trees/${BRANCH}?recursive=1`);
        if (!res.ok) return reply({ error: await ghError(res) }, 502);
        const data = await res.json();
        const files = (data.tree ?? []).filter((t: any) => t.type === "blob")
          .map((t: any) => ({ path: t.path, size: t.size, sha: t.sha, editable: EDITABLE.test(t.path) }));
        return reply({ repo: REPO, branch: BRANCH, files });
      }

      case "file": {
        const path = safePath(body.path);
        if (!path) return reply({ error: "Arquivo inválido." }, 400);
        const res = await gh(`/contents/${encodeURI(path)}?ref=${BRANCH}`);
        if (!res.ok) return reply({ error: await ghError(res) }, 502);
        const data = await res.json();
        if (Array.isArray(data) || data.encoding !== "base64") return reply({ error: "Não é um arquivo de texto." }, 400);
        return reply({ path, sha: data.sha, content: fromB64(data.content), html_url: data.html_url });
      }

      case "commits": {
        const res = await gh(`/commits?sha=${BRANCH}&per_page=20`);
        if (!res.ok) return reply({ error: await ghError(res) }, 502);
        const data = await res.json();
        return reply({
          commits: data.map((c: any) => ({
            sha: c.sha, message: c.commit?.message ?? "", author: c.commit?.author?.name ?? c.author?.login ?? "",
            date: c.commit?.author?.date, url: c.html_url,
          })),
        });
      }

      case "save": {
        if (!TOKEN) return reply({ error: "Salvar pelo site ainda não está ligado para esta equipe: o administrador cadastra o token do GitHub na tela Equipe." }, 503);
        const path = safePath(body.path);
        if (!path || !EDITABLE.test(path)) return reply({ error: "Só dá para salvar arquivos de texto (.py, .md, ...)." }, 400);
        const content = String(body.content ?? "");
        if (content.length > 200_000) return reply({ error: "Arquivo grande demais." }, 400);
        const { data: user } = await sb.auth.getUser();
        const email = user?.user?.email ?? "equipe";
        const message = `${String(body.message ?? "").trim().slice(0, 200) || `Atualiza ${path}`}\n\nEnviado pela plataforma Rabbitech por ${email}`;
        const res = await gh(`/contents/${encodeURI(path)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, content: toB64(content), branch: BRANCH, ...(body.sha ? { sha: body.sha } : {}) }),
        });
        if (!res.ok) return reply({ error: await ghError(res) }, res.status === 409 ? 409 : 502);
        const data = await res.json();
        await sb.from("code_changes").insert({
          team_id: teamId, repo: REPO, path, message: message.split("\n")[0], commit_sha: data.commit?.sha, commit_url: data.commit?.html_url, author_email: email, kind: "commit",
        });
        return reply({ sha: data.content?.sha, commit: { sha: data.commit?.sha, url: data.commit?.html_url } });
      }

      case "redeploy": {
        if (!HOOK) return reply({ error: "Redeploy ainda não foi configurado: falta o VERCEL_DEPLOY_HOOK_URL no Supabase." }, 503);
        const { data: platformAdmin } = await sb.rpc("is_platform_admin");
        if (!platformAdmin) return reply({ error: "O site é de todas as equipes: só o administrador da plataforma faz redeploy." }, 403);
        const res = await fetch(HOOK, { method: "POST" });
        if (!res.ok) return reply({ error: `A Vercel recusou o pedido (${res.status}).` }, 502);
        const { data: user } = await sb.auth.getUser();
        await sb.from("code_changes").insert({ team_id: teamId, repo: "vercel", path: "site", message: "Redeploy do site pedido pela plataforma", author_email: user?.user?.email ?? "equipe", kind: "redeploy" });
        return reply({ ok: true });
      }

      default:
        return reply({ error: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    console.error("robot-code:", e);
    return reply({ error: "Falha ao falar com o GitHub. Tente de novo." }, 502);
  }
});
