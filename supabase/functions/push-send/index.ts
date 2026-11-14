// Notificações push do Rabbitech (funcionam com o navegador fechado).
// Ações (POST JSON):
//   public_key  qualquer pessoa: devolve a chave pública VAPID (gerada aqui na primeira vez)
//   test        pessoa logada: manda um aviso de teste para os próprios aparelhos
//   digest      só o agendador do banco (cabeçalho x-cron-secret): avisa prazos e eventos chegando
// As chaves ficam em public.push_config, tabela que o site não lê. Nenhum segredo é digitado.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

const SUBJECT = "https://sistema-rabbitech.vercel.app";
const PRAZO_DIAS = 3;
const TORNEIO_DIAS = 14;

function keyFrom(name: string, jsonName: string) {
  const direct = Deno.env.get(name);
  if (direct) return direct;
  try { return JSON.parse(Deno.env.get(jsonName) ?? "{}").default ?? ""; } catch { return ""; }
}
const service = () => createClient(Deno.env.get("SUPABASE_URL")!, keyFrom("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS"), { auth: { persistSession: false } });

const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

type Config = { vapid_public: string; vapid_private: string; cron_secret: string };
async function config(): Promise<Config> {
  const db = service();
  const { data } = await db.from("push_config").select("*").eq("id", 1).maybeSingle();
  if (!data) throw new Error("Configuração de push ausente. Rode a migração 20261119_push.sql.");
  if (data.vapid_public && data.vapid_private) return data as Config;
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  const pub = b64(new Uint8Array([4, ...unb64(jwk.x!), ...unb64(jwk.y!)]));
  // só grava se ninguém gravou antes (duas chamadas ao mesmo tempo não trocam a chave)
  await db.from("push_config").update({ vapid_public: pub, vapid_private: jwk.d }).eq("id", 1).is("vapid_public", null);
  const { data: again } = await db.from("push_config").select("*").eq("id", 1).single();
  return again as Config;
}

type Sub = { endpoint: string; p256dh: string; auth: string };
type Payload = { title: string; body: string; url: string; tag: string };
async function send(sub: Sub, payload: Payload) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 43200 });
    return "ok" as const;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) await service().from("push_subscriptions").delete().eq("endpoint", sub.endpoint); // aparelho não existe mais
    return "falhou" as const;
  }
}

const quando = (n: number) => (n < 0 ? `atrasada há ${-n} dia${n === -1 ? "" : "s"}` : n === 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`);

async function digest() {
  const db = service();
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const dia = (s: string) => Date.parse(`${s}T12:00:00Z`);
  const diff = (s: string) => Math.round((dia(s) - dia(hoje)) / 86400000);
  const mais = (n: number) => new Date(dia(hoje) + n * 86400000).toISOString().slice(0, 10);

  const { data: subs } = await db.from("push_subscriptions").select("email, endpoint, p256dh, auth");
  if (!subs?.length) return { pessoas: 0, enviados: 0 };
  const emails = [...new Set(subs.map((s) => s.email))];

  const { data: membros } = await db.from("team_members").select("email, team_id, teams(name)").in("email", emails);
  const teamIds = [...new Set((membros ?? []).map((m) => m.team_id))];
  if (!teamIds.length) return { pessoas: 0, enviados: 0 };
  const [{ data: tasks }, { data: events }] = await Promise.all([
    db.from("team_tasks").select("team_id, title, due_date").in("team_id", teamIds).neq("status", "done").not("due_date", "is", null).lte("due_date", mais(PRAZO_DIAS)),
    db.from("team_events").select("team_id, title, kind, event_date").in("team_id", teamIds).gte("event_date", hoje).lte("event_date", mais(TORNEIO_DIAS)),
  ]);

  let pessoas = 0, enviados = 0;
  for (const email of emails) {
    const meus = (membros ?? []).filter((m) => m.email === email);
    const multi = meus.length > 1;
    const nomeDe = (id: string) => (multi ? `[${(meus.find((m) => m.team_id === id) as { teams?: { name?: string } })?.teams?.name ?? ""}] ` : "");
    const ids = new Set(meus.map((m) => m.team_id));
    const itens: { n: number; texto: string }[] = [];
    for (const t of tasks ?? []) if (ids.has(t.team_id)) itens.push({ n: diff(t.due_date), texto: `${nomeDe(t.team_id)}${t.title} (prazo ${quando(diff(t.due_date))})` });
    for (const e of events ?? []) {
      const n = diff(e.event_date);
      if (ids.has(e.team_id) && n >= 0 && n <= (e.kind === "torneio" ? TORNEIO_DIAS : PRAZO_DIAS)) {
        itens.push({ n, texto: `${nomeDe(e.team_id)}${e.title} (${e.kind === "torneio" ? "torneio" : "evento"} ${quando(n)})` });
      }
    }
    if (!itens.length) continue;
    itens.sort((a, b) => a.n - b.n);
    const resto = itens.length - 3;
    const payload: Payload = {
      title: itens.length === 1 ? "Rabbitech: 1 aviso" : `Rabbitech: ${itens.length} avisos`,
      body: itens.slice(0, 3).map((i) => i.texto).join("\n") + (resto > 0 ? `\n+ ${resto} no calendário` : ""),
      url: "/calendario", tag: "rabbitech-diario",
    };
    pessoas++;
    for (const s of subs.filter((x) => x.email === email)) if ((await send(s, payload)) === "ok") enviados++;
  }
  return { pessoas, enviados };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);

  let body: { action?: string } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }

  let cfg: Config;
  try { cfg = await config(); } catch (e) { return reply({ error: (e as Error).message }, 500); }
  webpush.setVapidDetails(SUBJECT, cfg.vapid_public, cfg.vapid_private);

  if (body.action === "public_key") return reply({ public_key: cfg.vapid_public });

  if (body.action === "digest") {
    if (req.headers.get("x-cron-secret") !== cfg.cron_secret) return reply({ error: "Não autorizado." }, 401);
    return reply({ ok: true, ...(await digest()) });
  }

  if (body.action === "test") {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return reply({ error: "Faça login." }, 401);
    let publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!publicKey) { try { publicKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? ""; } catch { /* sem chave */ } }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, publicKey, { global: { headers: { Authorization: auth } } });
    const { data: ok } = await sb.rpc("is_team_member");
    const { data: u } = await sb.auth.getUser();
    const email = u?.user?.email?.toLowerCase();
    if (!ok || !email) return reply({ error: "Sua conta não está liberada para a equipe." }, 403);
    const { data: subs } = await service().from("push_subscriptions").select("endpoint, p256dh, auth").eq("email", email);
    if (!subs?.length) return reply({ error: "Nenhum aparelho ativado nesta conta." }, 404);
    let enviados = 0;
    for (const s of subs) if ((await send(s, { title: "Rabbitech", body: "Teste: os avisos estão funcionando.", url: "/calendario", tag: "rabbitech-teste" })) === "ok") enviados++;
    return reply({ ok: true, enviados });
  }

  return reply({ error: "Ação desconhecida." }, 400);
});
