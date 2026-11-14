// Tema pessoal: modo (claro/escuro/automático), cor de destaque e fundo.
// Fica no navegador (aplica na hora, sem piscar) e, com Supabase, na conta de cada pessoa.
import { supabase, isCloud } from './supabase.js';

const KEY = 'rabbitech.tema';
export const PADRAO = { modo: 'claro', cor: 'azul', fundo: 'degrade' };
export const MODOS = [['claro', 'Claro'], ['escuro', 'Escuro'], ['auto', 'Automático']];
export const FUNDOS = [['degrade', 'Degradê'], ['liso', 'Liso']];
export const CORES = [
  ['azul', 'Azul Rabbitech', '#0750ad'],
  ['dourado', 'Dourado', '#a16207'],
  ['vermelho', 'Vermelho', '#b42318'],
  ['verde', 'Verde', '#0f7a55'],
  ['roxo', 'Roxo', '#6d28d9'],
  ['grafite', 'Grafite', '#1f2937'],
];

const valido = (t) => ({
  modo: MODOS.some(([k]) => k === t?.modo) ? t.modo : PADRAO.modo,
  cor: CORES.some(([k]) => k === t?.cor) ? t.cor : PADRAO.cor,
  fundo: FUNDOS.some(([k]) => k === t?.fundo) ? t.fundo : PADRAO.fundo,
});

let atual = PADRAO;
export const temaAtual = () => atual;

export function aplicarTema(t) {
  atual = valido(t);
  const el = document.documentElement;
  const escuro = atual.modo === 'escuro' || (atual.modo === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  el.dataset.modo = escuro ? 'dark' : 'light';
  el.dataset.cor = atual.cor;
  el.dataset.fundo = atual.fundo;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', CORES.find(([k]) => k === atual.cor)[2]);
  return atual;
}

export function iniciarTema() {
  let salvo = {};
  try { salvo = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* ignora */ }
  aplicarTema(salvo);
  // no modo automático, acompanha o sistema quando ele muda
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => aplicarTema(atual));
}

function guardarLocal(t) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* ignora */ } }

// escolha feita pela pessoa: aplica, guarda no navegador e na conta
export async function definirTema(t, email) {
  const novo = aplicarTema(t);
  guardarLocal(novo);
  if (isCloud && email) {
    const { error } = await supabase.from('user_prefs').upsert({ email, tema: novo, updated_at: new Date().toISOString() }, { onConflict: 'email' });
    if (error) throw new Error(error.message);
  }
}

// ao entrar: o tema da conta vale em qualquer aparelho
export async function carregarTemaDaConta(email) {
  if (!isCloud || !email) return;
  const { data } = await supabase.from('user_prefs').select('tema').eq('email', email).maybeSingle();
  if (data?.tema && Object.keys(data.tema).length) { guardarLocal(aplicarTema(data.tema)); }
}
