// Busca no Spotify para a Rabbitech Music (músicas, álbuns, playlists e artistas).
// Credenciais só no Supabase (Edge Functions > Secrets):
//   SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET  (app criado em developer.spotify.com)
// Usa o fluxo "Client Credentials": não precisa de login no Spotify para buscar.
// Só membros da equipe logados podem usar (public.is_team_member()).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

const TYPES = ["track", "album", "playlist", "artist"] as const;
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1);

let cached: { token: string; exp: number } | null = null;
async function spotifyToken(id: string, secret: string) {
  if (cached && cached.exp > Date.now() + 30_000) return cached.token;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || "credenciais recusadas");
  cached = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return reply({ error: "Faça login para buscar músicas." }, 401);
  let publicKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!publicKey) {
    try { publicKey = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default ?? ""; } catch { /* sem chave */ }
  }
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, publicKey, { global: { headers: { Authorization: auth } } });
  const { data: ok, error: accessError } = await sb.rpc("is_team_member");
  if (accessError || !ok) return reply({ error: "Sua conta não está liberada para a equipe." }, 403);

  const id = Deno.env.get("SPOTIFY_CLIENT_ID");
  const secret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!id || !secret) return reply({ error: "A busca do Spotify ainda não foi configurada: faltam SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no Supabase." }, 503);

  let body: { q?: string; type?: string; offset?: number; precise?: boolean } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }
  const q = String(body.q ?? "").trim().slice(0, 120);
  if (q.length < 2) return reply({ error: "Digite pelo menos 2 letras para buscar." }, 400);
  const type = TYPES.includes(body.type as any) ? body.type! : "track";
  const offset = Math.max(0, Math.min(Number(body.offset) || 0, 900));

  let token: string;
  try { token = await spotifyToken(id, secret); }
  catch (e) { return reply({ error: `O Spotify recusou as credenciais (${(e as Error).message}). Confira SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET.` }, 502); }

  const url = new URL("https://api.spotify.com/v1/search");
  url.search = new URLSearchParams({ q, type, limit: "20", offset: String(offset), market: "BR" }).toString();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Spotify recusou:", res.status, JSON.stringify(data).slice(0, 300));
    return reply({ error: res.status === 429 ? "Muitas buscas seguidas. Espere um pouco e tente de novo." : `O Spotify recusou a busca (${res.status}).` }, 502);
  }

  const page = data[`${type}s`] ?? { items: [] };
  const all = (page.items ?? []).filter(Boolean).map((it: any) => {
    const images = it.images ?? it.album?.images ?? [];
    const sub = type === "track" ? (it.artists ?? []).map((a: any) => a.name).join(", ")
      : type === "album" ? `${(it.artists ?? []).map((a: any) => a.name).join(", ")} · álbum`
      : type === "playlist" ? `Playlist de ${it.owner?.display_name ?? "Spotify"}`
      : "Artista";
    return {
      id: `${type}:${it.id}`,
      url: it.external_urls?.spotify ?? `https://open.spotify.com/${type}/${it.id}`,
      title: it.name ?? "",
      channel: sub,
      thumbnail: (images[1] ?? images[0])?.url ?? "",
      type,
    };
  });
  // Busca precisa: todas as palavras precisam aparecer no nome ou no artista
  const required = words(q);
  const items = body.precise === false ? all
    : all.filter((v: any) => { const t = new Set(words(`${v.title} ${v.channel}`)); return required.every((w) => t.has(w) || [...t].some((x) => x.startsWith(w))); });
  const next = page.next ? offset + 20 : null;
  return reply({ items, nextPageToken: next, hidden: all.length - items.length });
});
