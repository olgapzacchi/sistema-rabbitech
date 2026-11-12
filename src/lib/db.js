// Camada de dados: usa o Supabase quando VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY
// estão definidos; caso contrário, salva no navegador (modo demonstração).
import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { seedData } from '../data/seed.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const isCloud = !!supabase;

const listeners = new Map(); // table -> Set<fn>
function notify(table) { (listeners.get(table) || new Set()).forEach((fn) => fn()); }
function subscribe(table, fn) {
  if (!listeners.has(table)) listeners.set(table, new Set());
  listeners.get(table).add(fn);
  return () => listeners.get(table).delete(fn);
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
  if (supabase) {
    const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }
  return readLocal(table);
}

export async function insert(table, row) {
  const full = { id: uid(), created_at: new Date().toISOString(), ...row };
  if (supabase) {
    const { data, error } = await supabase.from(table).insert(full).select().single();
    if (error) throw error;
    notify(table);
    return data;
  }
  writeLocal(table, [...readLocal(table), full]);
  notify(table);
  return full;
}

export async function update(table, id, patch) {
  if (supabase) {
    const { error } = await supabase.from(table).update(patch).eq('id', id);
    if (error) throw error;
  } else {
    writeLocal(table, readLocal(table).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  notify(table);
}

export async function remove(table, id) {
  if (supabase) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
  } else {
    writeLocal(table, readLocal(table).filter((r) => r.id !== id));
  }
  notify(table);
}

export async function uploadFile(file) {
  if (!supabase) return URL.createObjectURL(file); // local: só vale nesta sessão
  const path = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
  const { error } = await supabase.storage.from('documentos').upload(path, file);
  if (error) throw error;
  return supabase.storage.from('documentos').getPublicUrl(path).data.publicUrl;
}

// Hook: lista reativa de uma tabela
export function useTable(table) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    list(table)
      .then((d) => { setRows(d || []); setError(null); })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  }, [table]);
  useEffect(() => {
    load();
    const off = subscribe(table, load);
    let channel;
    if (supabase) {
      channel = supabase.channel('rt-' + table)
        .on('postgres_changes', { event: '*', schema: 'public', table }, load)
        .subscribe();
    }
    return () => { off(); if (channel) supabase.removeChannel(channel); };
  }, [table, load]);
  return { rows, loading, error, reload: load };
}
