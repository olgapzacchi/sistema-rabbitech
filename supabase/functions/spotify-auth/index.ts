// Conta Spotify (Premium) conectada POR EQUIPE.
// - start:      admin da equipe pede o link de login do Spotify
// - (GET)       o Spotify volta aqui com ?code&state; guardamos os tokens SÓ para aquela equipe
// - status:     membros veem se a equipe tem conta conectada (sem tokens)
// - token:      membros da equipe recebem um token de acesso de curta duração (1 h) para tocar
// - disconnect: admin da equipe desconecta
// Os tokens ficam em public.team_integrations, que o site não consegue ler; só esta função,
// depois de conferir is_member_of / is_admin_of. Uma equipe nunca recebe o token de outra.
// Secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
// No painel do Spotify (Redirect URIs) cadastre: <SUPABASE_URL>/functions/v1/spotify-auth
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const REDIRECT = `${SUPABASE_URL}/functions/v1/spotify-auth`;
const CLIENT_ID = Deno.env.get("SPOTIFY_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("SPOTIFY_CLIENT_SECRET") ?? "";
const SCOPES = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state";
const ALLOWED_RETURN = [/^https:\/\/sistema-rabbitech(-v2)?(-[a-z0-9-]+)?\.vercel\.app$/, /^http:\/\/localhost:\d+$/];
const DEFAULT_RETURN = "https://sistema-rabbitech.vercel.app";

function keyFrom(name: string, jsonName: string) {
  const direct = Deno.env.get(name);
  if (direct) return direct;
  try { return JSON.parse(Deno.env.get(jsonName) ?? "{}").default ?? ""; } catch { return ""; }
}
const service = () => createClient(SUPABASE_URL, keyFrom("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS"), { auth: { persistSession: false } });
const asUser = (auth: string) => createClient(SUPABASE_URL, keyFrom("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS"), { global: { headers: { Authorization: auth } } });
const basic = () => "Basic " + btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

async function spotifyToken(params: Record<string, string>) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error_description || data?.error || `Spotify ${res.status}`);
  return data;
}

function back(returnTo: string, result: string) {
  const url = new URL("/music", returnTo || DEFAULT_RETURN);
  url.searchParams.set("spotify", result);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ---------- volta do Spotify (sem login do site; validado pelo state de uso único) ----------
  if (req.method === "GET") {
    const u = new URL(req.url);
    const state = u.searchParams.get("state") ?? "";
    const code = u.searchParams.get("code");
    const db = service();
    const { data: row } = await db.from("spotify_oauth_states").select("*").eq("state", state).maybeSingle();
    if (!row) return back(DEFAULT_RETURN, "erro_estado");
    await db.from("spotify_oauth_states").delete().eq("state", state); // uso único
    if (Date.now() - new Date(row.created_at).getTime() > 10 * 60_000) return back(row.return_to, "erro_expirado");
    if (!code) return back(row.return_to, "cancelado");
    try {
      const tok = await spotifyToken({ grant_type: "authorization_code", code, redirect_uri: REDIRECT });
      const me = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
      await db.from("team_integrations").upsert({
        team_id: row.team_id,
        spotify_refresh_token: tok.refresh_token,
        spotify_access_token: tok.access_token,
        spotify_expires_at: new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString(),
        spotify_user: me?.display_name || me?.id || "Spotify",
        spotify_product: me?.product ?? null,
        spotify_connected_by: row.user_email,
        spotify_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      return back(row.return_to, me?.product === "premium" ? "ok" : "ok_sem_premium");
    } catch (e) {
      console.error("spotify-auth callback:", e);
      return back(row.return_to, "erro_spotify");
    }
  }

  if (req.method !== "POST") return reply({ error: "Método não permitido." }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return reply({ error: "Faça login." }, 401);
  if (!CLIENT_ID || !CLIENT_SECRET) return reply({ error: "Faltam SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET no Supabase." }, 503);

  let body: { action?: string; team_id?: string; return_to?: string } = {};
  try { body = await req.json(); } catch { /* vazio */ }
  const teamId = String(body.team_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) return reply({ error: "Equipe inválida." }, 400);

  const user = asUser(auth);
  const { data: member } = await user.rpc("is_member_of", { t: teamId });
  if (!member) return reply({ error: "Você não faz parte dessa equipe." }, 403);
  const db = service();

  switch (body.action) {
    case "status": {
      const { data } = await db.from("team_integrations")
        .select("spotify_user, spotify_product, spotify_connected_by, spotify_connected_at, spotify_refresh_token").eq("team_id", teamId).maybeSingle();
      const { data: admin } = await user.rpc("is_admin_of", { t: teamId });
      return reply({
        connected: !!data?.spotify_refresh_token,
        user: data?.spotify_user ?? null, product: data?.spotify_product ?? null,
        connected_by: data?.spotify_connected_by ?? null, connected_at: data?.spotify_connected_at ?? null,
        can_manage: !!admin,
      });
    }

    case "start": {
      const { data: admin } = await user.rpc("is_admin_of", { t: teamId });
      if (!admin) return reply({ error: "Só o administrador da equipe conecta a conta do Spotify." }, 403);
      const returnTo = ALLOWED_RETURN.some((r) => r.test(String(body.return_to ?? ""))) ? String(body.return_to) : DEFAULT_RETURN;
      const state = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
      const { data: me } = await user.auth.getUser();
      await db.from("spotify_oauth_states").delete().lt("created_at", new Date(Date.now() - 3600_000).toISOString());
      await db.from("spotify_oauth_states").insert({ state, team_id: teamId, user_email: me?.user?.email ?? null, return_to: returnTo });
      const url = new URL("https://accounts.spotify.com/authorize");
      url.search = new URLSearchParams({
        client_id: CLIENT_ID, response_type: "code", redirect_uri: REDIRECT, scope: SCOPES, state,
        show_dialog: "true", // sempre pergunta qual conta: evita conectar sem querer a conta que estava logada no navegador
      }).toString();
      return reply({ url: url.toString() });
    }

    case "token": {
      const { data } = await db.from("team_integrations").select("*").eq("team_id", teamId).maybeSingle();
      if (!data?.spotify_refresh_token) return reply({ error: "A equipe ainda não conectou uma conta do Spotify." }, 404);
      if (data.spotify_access_token && new Date(data.spotify_expires_at).getTime() > Date.now() + 60_000) {
        return reply({ access_token: data.spotify_access_token, expires_at: data.spotify_expires_at });
      }
      try {
        const tok = await spotifyToken({ grant_type: "refresh_token", refresh_token: data.spotify_refresh_token });
        const expires = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
        await db.from("team_integrations").update({
          spotify_access_token: tok.access_token, spotify_expires_at: expires,
          ...(tok.refresh_token ? { spotify_refresh_token: tok.refresh_token } : {}), updated_at: new Date().toISOString(),
        }).eq("team_id", teamId);
        return reply({ access_token: tok.access_token, expires_at: expires });
      } catch (e) {
        console.error("spotify-auth refresh:", e);
        return reply({ error: "A conexão com o Spotify expirou. Peça ao administrador para conectar de novo." }, 401);
      }
    }

    case "disconnect": {
      const { data: admin } = await user.rpc("is_admin_of", { t: teamId });
      if (!admin) return reply({ error: "Só o administrador da equipe desconecta." }, 403);
      await db.from("team_integrations").update({
        spotify_refresh_token: null, spotify_access_token: null, spotify_expires_at: null,
        spotify_user: null, spotify_product: null, spotify_connected_by: null, spotify_connected_at: null,
        updated_at: new Date().toISOString(),
      }).eq("team_id", teamId);
      return reply({ ok: true });
    }

    default:
      return reply({ error: "Ação desconhecida." }, 400);
  }
});
