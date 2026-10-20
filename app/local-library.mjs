import {validateRecord,validId} from './shared.mjs';

// Originals and playlists stay out of the shared catalog. Live listening stages
// only the currently selected MP3 separately; see listen-media.mjs.
export const ownLocalTracks=(state,owner)=>owner?(state.localTracks||[]).filter(t=>t.ownerId===owner):[];
export const ownLocalPlaylists=(state,owner)=>owner?(state.localPlaylists||[]).filter(p=>p.ownerId===owner):[];
export const isLocalTrack=(state,key)=>(state.localTracks||[]).some(t=>t.id===key);
export const availableTracks=(state,owner)=>[...(state.tracks||[]).filter(t=>!t.ownerId&&!['private','local'].includes(t.visibility)),...ownLocalTracks(state,owner)];
export function playlistTracks(state,owner,visibility='band'){
  return visibility==='local'?availableTracks(state,owner):availableTracks(state,null);
}
export function localPlaylistRecord(record,owner,state){
  if(!owner)throw new Error('Bitte zuerst mit deinem Discord-Konto anmelden.');
  const clean=validateRecord('playlists',{id:record.id,title:record.title,description:record.description,trackIds:record.trackIds});
  const allowed=new Set(playlistTracks(state,owner,'local').map(t=>t.id));
  if(clean.trackIds.some(id=>!allowed.has(id)))throw new Error('Ein Song dieser lokalen Playlist ist für dein Konto nicht verfügbar.');
  return {...clean,ownerId:owner,visibility:'local'};
}
export function validateLocalLibrary(state){
  const tracks=state.localTracks??[],playlists=state.localPlaylists??[];
  if(!Array.isArray(tracks)||!Array.isArray(playlists)||tracks.length>10000||playlists.length>2000)throw new Error('Ungültige lokale Mediathek im Backup.');
  const ids=new Set(state.tracks.map(t=>t.id)),blobs=new Set([...state.tracks.flatMap(t=>[t.blobId,t.coverBlobId]),...state.albums.map(a=>a.coverBlobId)].filter(Boolean)),localBlobs=new Map();
  for(const track of tracks){
    if(!track||!validId(track.ownerId)||ids.has(track.id)||blobs.has(track.blobId)||track.coverBlobId&&blobs.has(track.coverBlobId))throw new Error('Ungültiger Eigentümer oder Dateiverweis in der privaten Mediathek.');
    validateRecord('tracks',{...track,ownerId:undefined,visibility:undefined});ids.add(track.id);for(const key of [track.blobId,track.coverBlobId].filter(Boolean)){if(localBlobs.has(key)&&localBlobs.get(key)!==track.ownerId)throw new Error('Eine lokale Datei ist mehreren Konten zugeordnet.');localBlobs.set(key,track.ownerId);}
  }
  const groupIds=new Set([...state.playlists,...(state.privatePlaylists||[])].map(p=>p.id));
  for(const p of playlists){
    if(!p||!validId(p.ownerId)||groupIds.has(p.id))throw new Error('Ungültige lokale Playlist im Backup.');
    validateRecord('playlists',{id:p.id,title:p.title,description:p.description,trackIds:p.trackIds});groupIds.add(p.id);
    if(p.trackIds.some(key=>tracks.some(t=>t.id===key&&t.ownerId!==p.ownerId)))throw new Error('Eine lokale Playlist enthält Songs eines anderen Kontos.');
  }
  return {localTracks:tracks.map(t=>({...t,visibility:'local'})),localPlaylists:playlists.map(p=>({...p,visibility:'local'}))};
}
export function backupForOwner(state,owner){
  return {...structuredClone(state),privatePlaylists:(state.privatePlaylists||[]).filter(p=>owner&&p.ownerId===owner),localTracks:ownLocalTracks(state,owner),localPlaylists:ownLocalPlaylists(state,owner)};
}
export function backupBlobIds(state){
  return new Set([...state.tracks,...(state.localTracks||[])].flatMap(t=>[t.blobId,t.coverBlobId]).concat(state.albums.map(a=>a.coverBlobId),state.background?.blobId).filter(Boolean));
}
