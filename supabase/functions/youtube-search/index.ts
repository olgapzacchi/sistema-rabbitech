// Busca de vídeos do YouTube para a Rabbitech TV.
// A chave fica no Supabase (Edge Functions > Secrets > YOUTUBE_API_KEY), nunca no site.
// Só membros da equipe logados podem usar: o token do usuário é validado pelo próprio
// banco ao chamar public.is_team_member() (por isso a função roda com verify_jwt = false,
// que é o recomendado com as novas chaves de assinatura JWT do Supabase).
//
// Busca precisa: o YouTube devolve resultados "parecidos" (ex.: "spike prime robots"
// traz carros, pregos...). Por isso buscamos 50 resultados e filtramos aqui:
//   - precisa (padrão): TODAS as palavras importantes precisam aparecer no título
//     (ou no título + descrição, se titleOnly = false)
//   - exclude: palavras proibidas (somem do resultado e vão como -palavra para o YouTube)
//   - topic: "tech" restringe à categoria Ciência e Tecnologia, "edu" a Educação, "music" a Música
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

const STOP = new Set([
  "a", "o", "as", "os", "um", "uma", "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas",
  "para", "pra", "com", "por", "como", "que", "the", "an", "of", "and", "or", "in", "on", "for", "with",
  "to", "how", "is", "video", "videos", "vídeo", "vídeos",
]);
const ENTITIES: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&#39;": "'", "&lt;": "<", "&gt;": ">" };
const decode = (s: string) => s.replace(/&(amp|quot|#39|lt|gt);/g, (m) => ENTITIES[m] ?? m);
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// singular/plural simples: robots ~ robot, robôs ~ robo
const stem = (w: string) => (w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
const tokens = (s: string) => new Set(words(s).map(stem));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);

  // Confere se quem chamou é da equipe
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return reply({ error: "Faça login para buscar vídeos." }, 401);
  let publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!publicKey) {
    try { publicKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? ""; } catch { /* sem chave */ }
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, publicKey, { global: { headers: { Authorization: auth } } });
  const { data: ok, error: accessError } = await sb.rpc("is_team_member");
  if (accessError || !ok) return reply({ error: "Sua conta não está liberada para a equipe." }, 403);

  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return reply({ error: "A busca ainda não foi configurada: falta a chave YOUTUBE_API_KEY no Supabase." }, 503);

  let body: { q?: string; pageToken?: string; precise?: boolean; titleOnly?: boolean; exclude?: string; topic?: string } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }
  const q = String(body.q ?? "").trim().slice(0, 150);
  if (q.length < 2) return reply({ error: "Digite pelo menos 2 letras para buscar." }, 400);
  const precise = body.precise !== false;
  const titleOnly = body.titleOnly !== false;
  const excluded = words(String(body.exclude ?? "").slice(0, 150)).map(stem);
  const required = [...new Set(words(q).filter((w) => !STOP.has(w)).map(stem))];

  const ytQuery = [q, ...excluded.map((w) => `-${w}`)].join(" ");
  const params: Record<string, string> = {
    part: "snippet", type: "video", maxResults: "50", safeSearch: "strict", q: ytQuery, key: apiKey,
  };
  if (body.topic === "tech") params.videoCategoryId = "28";
  if (body.topic === "edu") params.videoCategoryId = "27";
  if (body.topic === "music") params.videoCategoryId = "10";
  if (body.pageToken) params.pageToken = String(body.pageToken).slice(0, 100);
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams(params).toString();

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      const reason = data?.error?.errors?.[0]?.reason ?? data?.error?.status ?? "";
      const detail = String(data?.error?.message ?? "").slice(0, 300);
      console.error("YouTube recusou:", res.status, reason, detail);
      const msgs: Record<string, string> = {
        quotaExceeded: "A cota diária da busca do YouTube acabou. Tente amanhã.",
        keyInvalid: "A chave YOUTUBE_API_KEY é inválida. Copie de novo no Google Cloud (Credentials) e salve no Supabase.",
        API_KEY_INVALID: "A chave YOUTUBE_API_KEY é inválida. Copie de novo no Google Cloud (Credentials) e salve no Supabase.",
        accessNotConfigured: "A YouTube Data API v3 não está ativada no projeto do Google Cloud dessa chave.",
        SERVICE_DISABLED: "A YouTube Data API v3 não está ativada no projeto do Google Cloud dessa chave.",
        forbidden: "A chave tem restrição que bloqueia o servidor. No Google Cloud, em Application restrictions, use “None”.",
        ipRefererBlocked: "A chave tem restrição de site/IP. No Google Cloud, em Application restrictions, use “None”.",
        API_KEY_HTTP_REFERRER_BLOCKED: "A chave tem restrição de site. No Google Cloud, em Application restrictions, use “None”.",
      };
      return reply({ error: msgs[reason] ?? `O YouTube recusou a busca (${reason || res.status}): ${detail}` }, 502);
    }
    const all = (data.items ?? []).filter((v: any) => v.id?.videoId).map((v: any) => ({
      id: v.id.videoId,
      url: `https://www.youtube.com/watch?v=${v.id.videoId}`,
      title: decode(v.snippet?.title ?? "Vídeo do YouTube"),
      channel: decode(v.snippet?.channelTitle ?? ""),
      description: decode(v.snippet?.description ?? ""),
      thumbnail: v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? "",
      publishedAt: v.snippet?.publishedAt ?? null,
    }));
    const items = all.filter((v: any) => {
      const t = tokens(titleOnly ? v.title : `${v.title} ${v.description}`);
      const full = tokens(`${v.title} ${v.description}`);
      if (excluded.some((w) => full.has(w))) return false;
      return !precise || required.every((w) => t.has(w));
    });
    return reply({ items, nextPageToken: data.nextPageToken ?? null, checked: all.length, hidden: all.length - items.length });
  } catch {
    return reply({ error: "Falha ao falar com o YouTube. Tente de novo." }, 502);
  }
});
