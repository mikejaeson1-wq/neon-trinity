import {validateRecord} from './shared.mjs';
export function personalPlaylists(state,ownerId){return ownerId?(state.privatePlaylists||[]).filter(p=>p.ownerId===ownerId):[];}
export function visiblePlaylists(state,ownerId){return [...(state.playlists||[]).filter(p=>!['private','local'].includes(p.visibility)&&!p.ownerId),...personalPlaylists(state,ownerId)];}
export function privateRecord(record,ownerId){
  if(!ownerId)throw new Error('Bitte zuerst mit Discord anmelden, um persönliche Playlists zu verwenden.');
  const clean=validateRecord('playlists',{id:record.id,title:record.title,description:record.description,trackIds:record.trackIds});
  return {...clean,visibility:'private',ownerId,...(record._rev?{_rev:record._rev}:{})};
}
