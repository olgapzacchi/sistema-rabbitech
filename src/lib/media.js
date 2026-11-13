// Provedores de mídia da plataforma: YouTube (Rabbitech TV) e Spotify (Rabbitech Music).
import { supabase } from './supabase.js';

export function youtubeEmbed(url) {
  try {
    const u = new URL(url);
    const list = u.searchParams.get('list');
    let id = u.searchParams.get('v');
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/);
    if (m) id = m[2];
    if (id) return `https://www.youtube.com/embed/${id}${list ? '?list=' + list : ''}`;
    if (list) return `https://www.youtube.com/embed/videoseries?list=${list}`;
  } catch { /* url inválida */ }
  return null;
}

export function youtubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('/')[0] || null;
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/);
    return m ? m[2] : (u.searchParams.get('v') || u.searchParams.get('list'));
  } catch { return null; }
}

const SPOTIFY_RE = /open\.spotify\.com\/(?:intl-[a-z]+\/)?(?:embed\/)?(playlist|album|track|show|episode|artist)\/([A-Za-z0-9]+)/;
export function spotifyEmbed(url) {
  const m = String(url).match(SPOTIFY_RE);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator` : null;
}
export function spotifyId(url) {
  const m = String(url).match(SPOTIFY_RE);
  return m ? `${m[1]}:${m[2]}` : null;
}

async function invoke(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* sem corpo */ }
    throw new Error(msg);
  }
  return data;
}

export const PROVIDERS = {
  youtube: {
    kind: 'youtube',
    title: 'Rabbitech TV',
    desc: 'Busque vídeos sem precisar de link, fixe os melhores e monte playlists para a equipe.',
    itemName: 'vídeo', itemsName: 'vídeos',
    play: 'Assistir', playAll: 'Assistir em sequência',
    pin: 'Fixar', unpin: 'Desafixar', pinnedTab: 'Fixados',
    placeholder: 'Ex.: SPIKE Prime robot',
    linkPlaceholder: 'https://www.youtube.com/watch?v=…',
    suggestions: ['SPIKE Prime robot', 'FLL robot game', 'SPIKE Prime attachment', 'Pybricks line following', 'FLL innovation project'],
    categories: ['Robô', 'Programação', 'Projeto de Inovação', 'Core Values', 'Regras e desafio', 'Geral'],
    notesLabel: 'O que aprendemos com este vídeo',
    notesPlaceholder: 'Ex.: ideia de garra para a M09, dica de calibração do giroscópio…',
    doneLabel: ['Marcar como assistido', 'Assistido'],
    embed: youtubeEmbed,
    idOf: youtubeId,
    thumbOf: (url) => { const id = youtubeId(url); return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : ''; },
    frameStyle: { aspectRatio: '16 / 9' },
    search: (params) => invoke('youtube-search', params),
    hasTypes: false,
  },
  spotify: {
    kind: 'spotify',
    title: 'Rabbitech Music',
    desc: 'O Spotify da equipe: busque músicas, salve as favoritas e monte as playlists dos treinos.',
    itemName: 'música', itemsName: 'músicas',
    play: 'Tocar', playAll: 'Tocar em sequência',
    pin: 'Favoritar', unpin: 'Desfavoritar', pinnedTab: 'Favoritas',
    placeholder: 'Ex.: Imagine Dragons',
    linkPlaceholder: 'https://open.spotify.com/track/…',
    suggestions: ['música para estudar', 'lofi', 'rock motivacional', 'trilha sonora épica', 'pop brasileiro'],
    categories: ['Foco e estudo', 'Animação', 'Dia de competição', 'Relax', 'Geral'],
    notesLabel: 'Comentário da equipe',
    notesPlaceholder: 'Ex.: boa para o treino de montagem, tocar antes do round…',
    doneLabel: ['Marcar como ouvida', 'Ouvida'],
    embed: spotifyEmbed,
    idOf: spotifyId,
    thumbOf: () => '',
    frameStyle: { height: 352 },
    search: (params) => invoke('spotify-search', { ...params, offset: params.pageToken || 0 }),
    hasTypes: true,
    types: [['track', 'Músicas'], ['album', 'Álbuns'], ['playlist', 'Playlists'], ['artist', 'Artistas']],
  },
};
