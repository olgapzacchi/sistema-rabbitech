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

// Valores padrão do projeto Supabase da equipe. São PÚBLICOS por natureza (a chave
// "publishable" sempre vai para o navegador); quem protege os dados são as regras RLS
// do banco (supabase/schema.sql). As variáveis de ambiente, se existirem, têm prioridade.
const DEFAULT_URL = 'https://gfunjxrpermmzusklfyn.supabase.co';
const DEFAULT_KEY = 'sb_publishable__37HA7zZI3ZXNOqyZ0Miaw_-UYrobzR';

// Em `npm run dev` sem .env.local o app usa o modo local (dados no navegador), para testes.
const useDefaults = import.meta.env.PROD || import.meta.env.VITE_USE_DEFAULT_SUPABASE === 'true';

export const SUPABASE_URL = cleanUrl(import.meta.env.VITE_SUPABASE_URL) || (useDefaults ? DEFAULT_URL : '');
export const SUPABASE_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim() || (useDefaults ? DEFAULT_KEY : '');

export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export const isCloud = !!supabase;
// Em produção (Vercel) o Supabase é obrigatório; o modo local só existe em `npm run dev`.
export const missingConfig = !isCloud && import.meta.env.PROD;
