// Camada de dados da aplicação.
// - Com Supabase configurado: lê/grava nas tabelas do banco (ver supabase/schema.sql)
//   e recebe atualizações em tempo real de outros usuários.
// - Sem Supabase em `npm run dev`: modo local, salva no navegador (para testes).
import { useCallback, useEffect, useState } from 'react';
import { supabase, isCloud } from './supabase.js';
import { seedData } from '../data/seed.js';

export { supabase, isCloud };

// Campos controlados pelo banco: nunca são enviados pelo app
const SERVER_FIELDS = ['id', 'created_at', 'updated_at', 'created_by', 'team_id'];

// ---------- equipe atual ----------
// Todas as tabelas de dados são separadas por equipe (coluna team_id + RLS no banco).
const TEAM_TABLES = new Set(['members', 'team_tasks', 'strategies', 'sorties', 'rounds', 'sortie_logs', 'swot_items',
  'improvements', 'documents', 'media_links', 'tv_playlists', 'tv_playlist_items', 'code_changes']);
let currentTeam = null;
export function setCurrentTeam(id) { currentTeam = id; }
export const getCurrentTeam = () => currentTeam;
const scoped = (table) => isCloud && TEAM_TABLES.has(table);
const clean = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !SERVER_FIELDS.includes(k)));

// ---------- avisos entre componentes da mesma aba ----------
const listeners = new Map(); // tabela -> Set<fn>
function notify(table) { (listeners.get(table) || new Set()).forEach((fn) => fn()); }
function subscribe(table, fn) {
  if (!listeners.has(table)) listeners.set(table, new Set());
  listeners.get(table).add(fn);
  return () => listeners.get(table).delete(fn);
}

function fail(action, table, error) {
  const msg = error?.message || String(error);
  console.error(`[db] ${action} ${table}:`, error);
  if (typeof window !== 'undefined') window.alert(`Não foi possível ${action} (${table}): ${msg}`);
  throw error;
}

// ---------- modo local ----------
const LS = 'rabbitech.v2.';
function readLocal(table) {
  try {
    const raw = localStorage.getItem(LS + table);
    if (raw) return JSON.parse(raw);
  } catch { /* ignora */ }
  const seed = seedData[table] || [];
  writeLocal(table, seed);
  return seed;
}
function writeLocal(table, rows) {
  try { localStorage.setItem(LS + table, JSON.stringify(rows)); } catch { /* ignora */ }
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

// ---------- API genérica ----------
export async function list(table) {
  if (!isCloud) return readLocal(table);
  let q = supabase.from(table).select('*').order('created_at', { ascending: true });
  if (scoped(table)) {
    if (!currentTeam) return [];
    q = q.eq('team_id', currentTeam);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function insert(table, row) {
  if (!isCloud) {
    const full = { ...clean(row), id: uid(), created_at: new Date().toISOString() };
    writeLocal(table, [...readLocal(table), full]);
    notify(table);
    return full;
  }
  const payload = scoped(table) ? { ...clean(row), team_id: currentTeam } : clean(row);
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) fail('salvar', table, error);
  notify(table);
  return data;
}

export async function update(table, id, patch) {
  if (!isCloud) {
    writeLocal(table, readLocal(table).map((r) => (r.id === id ? { ...r, ...clean(patch) } : r)));
  } else {
    const { error } = await supabase.from(table).update(clean(patch)).eq('id', id);
    if (error) fail('atualizar', table, error);
  }
  notify(table);
}

export async function remove(table, id) {
  if (!isCloud) {
    writeLocal(table, readLocal(table).filter((r) => r.id !== id));
  } else {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) fail('excluir', table, error);
  }
  notify(table);
}

// Upload para o bucket "documentos" (tela Regras)
export async function uploadFile(file) {
  if (!isCloud) return URL.createObjectURL(file); // local: só vale nesta aba
  const path = `${currentTeam || 'geral'}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
  const { error } = await supabase.storage.from('documentos').upload(path, file, { contentType: file.type });
  if (error) fail('enviar o arquivo', 'documentos', error);
  return supabase.storage.from('documentos').getPublicUrl(path).data.publicUrl;
}

// ---------- hook reativo ----------
let channelSeq = 0;
export function useTable(table) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    list(table)
      .then((d) => { setRows(d); setError(null); })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }, [table]);

  useEffect(() => {
    load();
    const off = subscribe(table, load);
    let channel;
    if (isCloud) {
      channel = supabase
        .channel(`rt-${table}-${++channelSeq}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, ...(scoped(table) && currentTeam ? { filter: `team_id=eq.${currentTeam}` } : {}) }, load)
        .subscribe();
    }
    return () => { off(); if (channel) supabase.removeChannel(channel); };
  }, [table, load]);

  return { rows, loading, error, reload: load };
}
