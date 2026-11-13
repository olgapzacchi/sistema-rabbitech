// Busca de vídeos do YouTube para a Rabbitech TV.
// A chave fica no Supabase (Edge Functions > Secrets > YOUTUBE_API_KEY), nunca no site.
// Só membros da equipe logados podem usar: o token do usuário é validado pelo próprio
// banco ao chamar public.is_team_member() (por isso a função roda com verify_jwt = false,
// que é o recomendado com as novas chaves de assinatura JWT do Supabase).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);

  // Confere se quem chamou é da equipe
  const auth = req.headers.get("Authorization") ?? "";
  let publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!publicKey) {
    try { publicKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? ""; } catch { /* sem chave */ }
  }
  if (!auth.startsWith("Bearer ")) return reply({ error: "Faça login para buscar vídeos." }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, publicKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: ok, error: accessError } = await sb.rpc("is_team_member");
  if (accessError || !ok) return reply({ error: "Sua conta não está liberada para a equipe." }, 403);

  const apiKey = Deno.env.get("YOUTUBE_API_KEY");
  if (!apiKey) return reply({ error: "A busca ainda não foi configurada: falta a chave YOUTUBE_API_KEY no Supabase." }, 503);

  let body: { q?: string; pageToken?: string } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }
  const q = String(body.q ?? "").trim().slice(0, 200);
  if (q.length < 2) return reply({ error: "Digite pelo menos 2 letras para buscar." }, 400);

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams({
    part: "snippet", type: "video", maxResults: "12", safeSearch: "strict",
    relevanceLanguage: "pt", q, key: apiKey,
    ...(body.pageToken ? { pageToken: String(body.pageToken).slice(0, 100) } : {}),
  }).toString();

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      const reason = data?.error?.errors?.[0]?.reason ?? "";
      return reply({
        error: reason === "quotaExceeded"
          ? "A cota diária da busca do YouTube acabou. Tente amanhã."
          : "O YouTube recusou a busca. Confira se a chave YOUTUBE_API_KEY está certa e com a YouTube Data API v3 ativada.",
      }, 502);
    }
    const items = (data.items ?? [])
      .filter((v: any) => v.id?.videoId)
      .map((v: any) => ({
        id: v.id.videoId,
        url: `https://www.youtube.com/watch?v=${v.id.videoId}`,
        title: v.snippet?.title ?? "Vídeo do YouTube",
        channel: v.snippet?.channelTitle ?? "",
        thumbnail: v.snippet?.thumbnails?.medium?.url ?? v.snippet?.thumbnails?.default?.url ?? "",
        publishedAt: v.snippet?.publishedAt ?? null,
      }));
    return reply({ items, nextPageToken: data.nextPageToken ?? null });
  } catch {
    return reply({ error: "Falha ao falar com o YouTube. Tente de novo." }, 502);
  }
});
