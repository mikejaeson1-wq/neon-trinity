import {validId,sameRecord} from './shared.mjs';
const clamp=(v,a,b,d)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):d;
export function ownerSettings(state,owner){
 const key=owner||'local-device';if(!validId(key))throw new Error('Ungültiges Studio-Konto.');
 state.studioOwners??={};if(!Object.hasOwn(state.studioOwners,key))state.studioOwners[key]={};
 const s=state.studioOwners[key];
 s.privacy??={};s.privacy.discord=s.privacy.discord!==false;s.privacy.localDiscord=s.privacy.localDiscord!==false;s.privacy.localListen=s.privacy.localListen!==false;s.privacy.tracks??={};
 s.audio??={};s.audio.mode=['normal','gapless','crossfade'].includes(s.audio.mode)?s.audio.mode:'normal';s.audio.crossfade=clamp(s.audio.crossfade,0,12,3);s.audio.normalize=s.audio.normalize===true;s.audio.targetDb=clamp(s.audio.targetDb,-24,-10,-18);
 s.backup??={};s.backup.auto=s.backup.auto===true;s.backup.interval=clamp(s.backup.interval,1,168,24);s.backup.retention=clamp(s.backup.retention,1,20,5);s.backup.lastSuccess=clamp(s.backup.lastSuccess,0,1e16,0);
 s.spotify??={};s.spotify.pinned=Array.isArray(s.spotify.pinned)?[...new Set(s.spotify.pinned.filter(id=>/^[A-Za-z0-9]{22}$/.test(id)))].slice(0,100):[];s.spotify.device=String(s.spotify.device||'').slice(0,160);
 s.work??={};s.history=Array.isArray(s.history)?s.history.slice(-60):[];s.skins=Array.isArray(s.skins)?s.skins.slice(0,30):[];s.scenes=Array.isArray(s.scenes)?s.scenes.slice(0,30):[];
 s.remote??={};s.remote.enabled=s.remote.enabled===true;s.remote.label=String(s.remote.label||'Mein Studio').slice(0,60);
 return s;
}
export function playbackPrivacy(state,owner,track){
 const p=ownerSettings(state,owner).privacy,entry=track&&Object.hasOwn(p.tracks,track.id)?p.tracks[track.id]:{},local=track?.visibility==='local';
 return {show:!!track&&p.discord&&(!local||p.localDiscord)&&entry?.show!==false,listen:!!track&&(!local||p.localListen)&&entry?.listen!==false};
}
const kinds=['tracks','albums','playlists','events','localTracks','localPlaylists','privatePlaylists'];
function view(state,owner){return Object.fromEntries(kinds.map(k=>[k,structuredClone((state[k]||[]).filter(r=>!r.ownerId||r.ownerId===owner))]));}
export class StudioJournal{
 constructor(){this.baseline=null;this.owner=null;this.suppress=false;}
 mark(state,owner){this.owner=owner||null;this.baseline=view(state,owner);}
 capture(state,owner){
  if(!this.baseline||this.owner!==(owner||null)){this.mark(state,owner);return null;}
  const next=view(state,owner),changes=[];
  for(const kind of kinds){const before=new Map(this.baseline[kind].map(r=>[r.id,r])),after=new Map(next[kind].map(r=>[r.id,r]));for(const id of new Set([...before.keys(),...after.keys()])){const a=before.get(id)||null,b=after.get(id)||null;if(!sameRecord(a,b)||!!a!==!!b)changes.push({kind,id,before:a,after:b});}}
  this.baseline=next;if(this.suppress){this.suppress=false;return null;}if(!changes.length)return null;
  const entry={id:crypto.randomUUID(),at:new Date().toISOString(),changes,label:changes.length===1?(changes[0].after?'Geändert: ':'Gelöscht: ')+(changes[0].after?.title||changes[0].before?.title||'Eintrag'):changes.length+' Einträge geändert'};
  if(changes.length>500||JSON.stringify(entry).length>1024*1024)return null;
  const history=ownerSettings(state,owner).history;history.push(entry);while(history.length>60||JSON.stringify(history).length>4*1024*1024)history.shift();return entry;
 }
 entries(state,owner){return ownerSettings(state,owner).history.filter(e=>e&&validId(e.id)&&Array.isArray(e.changes)&&e.changes.every(c=>kinds.includes(c.kind)&&validId(c.id)&&(!c.before?.ownerId||c.before.ownerId===owner)&&(!c.after?.ownerId||c.after.ownerId===owner)));}
 restore(state,owner,id){
  const entry=this.entries(state,owner).find(e=>e.id===id);if(!entry)throw new Error('Dieser Verlaufseintrag ist nicht für dein Konto verfügbar.');
  for(const c of entry.changes){const current=(state[c.kind]||[]).find(r=>r.id===c.id)||null;if(!!current!==!!c.after||current&&!sameRecord(current,c.after))throw new Error('Ein betroffener Eintrag wurde inzwischen geändert. Bitte die aktuelle Fassung behalten und gezielt bearbeiten.');}
  for(const c of entry.changes){state[c.kind]??=[];const at=state[c.kind].findIndex(r=>r.id===c.id);if(at>=0)state[c.kind].splice(at,1);if(c.before)state[c.kind].push(structuredClone(c.before));}
  ownerSettings(state,owner).history=ownerSettings(state,owner).history.filter(e=>e.id!==id);this.suppress=true;return entry;
 }
}
export function retainedBlobIds(state,owner){
 const keys=new Set();for(const e of new StudioJournal().entries(state,owner))for(const c of e.changes)for(const r of [c.before,c.after])if(r)for(const id of [r.blobId,r.coverBlobId].filter(validId))keys.add(id);return keys;
}
