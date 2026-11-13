// Configuração do cliente Supabase.
// Variáveis (Vercel > Settings > Environment Variables, ou .env.local):
//   VITE_SUPABASE_URL       URL do projeto, ex.: https://abcd1234.supabase.co
//   VITE_SUPABASE_ANON_KEY  chave pública (Publishable key "sb_publishable_..." ou a antiga "anon")
import { createClient } from '@supabase/supabase-js';

// Aceita a URL mesmo se vier com caminho extra (ex.: .../rest/v1/), espaços ou barra no fim
function cleanUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  try { return new URL(v).origin; } catch { return v.replace(/\/+$/, ''); }
}

export const SUPABASE_URL = cleanUrl(import.meta.env.VITE_SUPABASE_URL);
export const SUPABASE_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const isCloud = !!supabase;
// Em produção (Vercel) o Supabase é obrigatório; o modo local só existe em `npm run dev`.
export const missingConfig = !isCloud && import.meta.env.PROD;
