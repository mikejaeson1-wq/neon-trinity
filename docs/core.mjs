import {normalizeAppearance} from './appearance.mjs';
import {validateLocalLibrary} from './local-library.mjs';
import {CLOUD} from './cloud-config.mjs';
export const THEMES = { trinity: 'Neon Trinity', cyberpunk: 'Cyberpunk', hextech: 'League / Hextech', midnight:'Midnight', aurora:'Aurora', sunset:'Sunset', rose:'Rose Quartz', graphite:'Graphite', daylight:'Daylight' };
export const MAX_AUDIO = 48 * 1024 * 1024;
export const MAX_IMAGE = 12 * 1024 * 1024;
export const id = () => crypto.randomUUID();
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function time(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
export function duration(ids, tracks) { return ids.reduce((n, key) => n + (tracks.find(t => t.id === key)?.duration || 0), 0); }
export function move(items, index, direction) {
  const result = [...items]; const target = index + direction;
  if (target >= 0 && target < result.length) [result[index], result[target]] = [result[target], result[index]];
  return result;
}
export function validateAudio(file) {
  if (!/\.mp3$/i.test(file.name)) throw new Error(`${file.name}: Bitte eine MP3-Datei auswählen.`);
  if (!file.size) throw new Error(`${file.name}: Die Datei ist leer.`);
  if (file.size > MAX_AUDIO) throw new Error(`${file.name}: Höchstens 48 MiB pro MP3 pro Datei.`);
}
export function validateImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Bitte ein JPG-, PNG- oder WebP-Cover verwenden.');
  if (file.size > MAX_IMAGE) throw new Error('Das Cover darf höchstens 12 MiB groß sein.');
}
export function newState() {
  return { version: 1, theme: 'trinity', tracks: [], albums: [], playlists: [], privatePlaylists: [], localTracks: [], localPlaylists: [], appearance:normalizeAppearance(), events: [],
    settings: { owner: 'mikejaeson1-wq', repo: 'neon-trinity', baseUrl: '',backend:'supabase',publicBase:CLOUD.publicBase,discordClientId:'' },background:{blobId:'',dim:65,blur:0},teamAssets:[], published: {} };
}
export function validateState(data) {
  if (!data || data.version !== 1 || !['tracks','albums','playlists','events'].every(k=>Array.isArray(data[k]))) throw new Error('Diese Datei ist kein Neon-Trinity-Backup.');
  for (const key of ['tracks','albums','playlists','events']) {
    const ids = new Set();
    for (const item of data[key]) {
      if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) || ids.has(item.id)) throw new Error('Das Backup enthält ungültige oder doppelte Einträge.');
      ids.add(item.id);
      if (key === 'albums' || key === 'playlists') {
        if (!Array.isArray(item.trackIds) || item.trackIds.some(x=>typeof x!=='string')) throw new Error('Ungültige Titelliste im Backup.');
      }
      if(key==='tracks' && (typeof item.title!=='string' || !Number.isFinite(item.duration) || !/^[a-zA-Z0-9-]{1,80}$/.test(item.blobId||''))) throw new Error('Ungültiger Song im Backup.');
    }
  }
  if(data.privatePlaylists!==undefined&&(!Array.isArray(data.privatePlaylists)||data.privatePlaylists.some(p=>!p||!/^[a-zA-Z0-9-]{1,80}$/.test(p.id||'')||typeof p.ownerId!=='string'||!Array.isArray(p.trackIds))))throw new Error('Ungültige persönliche Playlists im Backup.');
  const defaults=newState();
  const settings={...defaults.settings,...data.settings};
  if(!/^[A-Za-z0-9-]+$/.test(settings.owner)||!/^[A-Za-z0-9_.-]{1,100}$/.test(settings.repo))throw new Error('Ungültige GitHub-Einstellungen im Backup.');
  // Earlier versions accepted a GitHub repository link as a website address.
  // Repair that preference during an update while retaining the whole library.
  settings.baseUrl=isGitHubRepositoryUrl(settings.baseUrl)?'':safeBaseUrl(settings.baseUrl);
  for(const a of data.albums)if(a.coverBlobId&&!/^[a-zA-Z0-9-]{1,80}$/.test(a.coverBlobId))throw new Error('Ungültiger Covereintrag.');
  return { ...defaults, ...data, ...validateLocalLibrary(data), appearance:normalizeAppearance(data.appearance), theme: THEMES[data.theme] ? data.theme : 'trinity', settings, background:{blobId:validBackgroundId(data.background?.blobId),dim:Math.min(95,Math.max(10,Number(data.background?.dim)||65)),blur:Math.min(16,Math.max(0,Number(data.background?.blur)||0))}, published: data.published&&typeof data.published==='object'&&!Array.isArray(data.published)?data.published:{} };
}
export function safeBaseUrl(input) {
  if (!input?.trim()) return '';
  const url = new URL(input.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Die öffentliche Adresse muss eine HTTPS-Adresse ohne Zugangsdaten, Suchparameter oder # sein.');
  if(isGitHubRepositoryUrl(url.href))throw new Error('Hier gehört die öffentliche Website-Adresse hinein, z. B. https://mikejaeson1-wq.github.io/neon-trinity. Den github.com-Repository-Link bitte nicht eintragen. Ohne eigene Domain kannst du das Feld leer lassen.');
  return url.href.replace(/\/$/, '');
}
export function isGitHubRepositoryUrl(input){try{const url=new URL(input);return url.protocol==='https:'&&['github.com','www.github.com'].includes(url.hostname.toLowerCase());}catch{return false;}}
export function albumLink(albumId, settings) {
  if(settings.backend==='supabase')return `${safeBaseUrl(settings.publicBase)||CLOUD.publicBase}/album.html?id=${encodeURIComponent(albumId)}`;
  const base = safeBaseUrl(settings.baseUrl) || `https://${settings.owner}.github.io/${settings.repo}`;
  return `${base}/albums/${encodeURIComponent(albumId)}/`;
}
export function removeTrack(state, trackId) {
  state.tracks = state.tracks.filter(t=>t.id!==trackId);
  for (const group of [...state.albums, ...state.playlists, ...(state.privatePlaylists||[])]) group.trackIds = group.trackIds.filter(x=>x!==trackId);
}

function validBackgroundId(value){return typeof value==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value)?value:'';}
