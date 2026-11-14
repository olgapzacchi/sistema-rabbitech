// Notificações push (web push). Só funcionam no site publicado (com Supabase).
import { supabase, isCloud } from './supabase.js';

const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

// 'indisponivel' | 'instalar' (iPhone fora da tela inicial) | 'bloqueado' | 'desligado' | 'ligado'
export async function estadoPush() {
  if (!isCloud) return 'indisponivel';
  if (ios() && !instalado()) return 'instalar';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'ligado' : 'desligado';
}

const paraBytes = (b64) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

async function chamar(body) {
  const { data, error } = await supabase.functions.invoke('push-send', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return data;
}

export async function ativarPush(email) {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('Você não permitiu as notificações. Libere nas configurações do navegador para o site.');
  const { public_key } = await chamar({ action: 'public_key' });
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(public_key) });
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    { email, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' });
  if (error) throw new Error(error.message);
}

export async function desativarPush() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export const testarPush = () => chamar({ action: 'test' });

export const CATEGORIAS = [
  ['agenda', 'Agenda', 'Eventos, torneios e datas comemorativas novos'],
  ['tarefas', 'Tarefas', 'Tarefa nova e tarefa concluída'],
  ['documentos', 'Regras', 'Documento novo anexado'],
  ['robo', 'Código do robô', 'Mudança publicada no GitHub pelo site'],
  ['rounds', 'Rounds', 'Round novo registrado'],
  ['equipe', 'Equipe', 'Pessoa nova entrou na equipe'],
  ['resumo', 'Resumo diário às 8h', 'Prazos e eventos que estão chegando'],
];

async function meuEndpoint() {
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return (await reg?.pushManager.getSubscription())?.endpoint;
}

export async function lerCategorias() {
  const endpoint = await meuEndpoint();
  if (!endpoint) return [];
  const { data } = await supabase.from('push_subscriptions').select('categorias').eq('endpoint', endpoint).maybeSingle();
  return data?.categorias || [];
}

export async function salvarCategorias(categorias) {
  const endpoint = await meuEndpoint();
  if (!endpoint) throw new Error('Este aparelho não está com os avisos ativos.');
  const { error } = await supabase.from('push_subscriptions').update({ categorias }).eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
}
