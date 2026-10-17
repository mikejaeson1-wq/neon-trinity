export const UPLOAD_MESSAGE='Neon Trinity media upload';
export const COLLECTIONS = ['tracks','albums','playlists','events','assets','publications'];
export const validId = value => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
export const emptyCatalog = () => ({schema:2,...Object.fromEntries(COLLECTIONS.map(k=>[k,[]]))});
const clean = value => Object.fromEntries(Object.entries(value||{}).filter(([k])=>!['_rev','_updatedBy','_updatedAt'].includes(k)));
function canonical(value) { if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value; }
export const sameRecord = (a,b) => JSON.stringify(canonical(clean(a))) === JSON.stringify(canonical(clean(b)));
export function snapshot(state) {
  return {schema:2,tracks:structuredClone(state.tracks||[]),albums:structuredClone(state.albums||[]),playlists:structuredClone((state.playlists||[]).filter(p=>p.visibility!=='private'&&!p.ownerId)),events:structuredClone(state.events||[]),assets:structuredClone(state.teamAssets||[]),publications:Object.entries(state.published||{}).map(([id,v])=>({id,...v}))};
}
export function diffCatalog(base, desired) {
  const operations=[];
  for(const kind of COLLECTIONS){const before=new Map((base[kind]||[]).map(r=>[r.id,r])),after=new Map((desired[kind]||[]).map(r=>[r.id,r]));
    for(const [id,value] of after)if(!before.has(id)||!sameRecord(before.get(id),value))operations.push({kind,id,baseRev:before.get(id)?._rev||null,value:clean(value)});
    for(const [id,value] of before)if(!after.has(id))operations.push({kind,id,baseRev:value._rev||null,value:null});
  }
  return operations;
}
export function overlayOperations(catalog,operations){const result=structuredClone(catalog);for(const op of operations){const list=result[op.kind]||=[];const index=list.findIndex(r=>r.id===op.id);if(op.value===null){if(index>=0)list.splice(index,1);}else if(index>=0)list[index]={...op.value,_rev:list[index]._rev};else list.push(op.value);}return result;}
export function applyToState(state,catalog) {
  for(const k of ['tracks','albums','playlists','events'])state[k]=structuredClone(catalog[k]||[]);
  state.teamAssets=structuredClone(catalog.assets||[]);state.published=Object.fromEntries((catalog.publications||[]).map(({id,...v})=>[id,v]));state._sharedBaseline=structuredClone(catalog);return state;
}
function text(value,max=1800){if(typeof value!=='string')return '';return value.slice(0,max);}
export function validateRecord(kind,record) {
  if(!record||!validId(record.id))throw new Error('Ungültiger Datensatz.');
  const r={id:record.id};
  if(kind==='tracks'){
    if(!validId(record.blobId)||!Number.isFinite(record.duration)||record.duration<=0||record.duration>86400)throw new Error('Ungültiger Song.');
    Object.assign(r,{blobId:record.blobId,title:text(record.title,160).trim(),artist:text(record.artist,120),voices:text(record.voices,120),genre:text(record.genre,120),duration:record.duration,size:Number(record.size)||0,digest:text(record.digest,64),addedAt:text(record.addedAt,40)});
    if(record.coverBlobId){if(!validId(record.coverBlobId))throw new Error('Ungültiges Cover.');r.coverBlobId=record.coverBlobId;}
  }else if(kind==='albums'||kind==='playlists'){
    if(kind==='playlists'&&(record.visibility==='private'||record.ownerId))throw new Error('Persönliche Playlists dürfen nicht im Bandkatalog gespeichert werden.');
    if(!Array.isArray(record.trackIds)||record.trackIds.length>2000||record.trackIds.some(id=>!validId(id)))throw new Error('Ungültige Titelliste.');
    Object.assign(r,{title:text(record.title,160).trim(),description:text(record.description),trackIds:[...new Set(record.trackIds)]});
    if(kind==='albums'){r.year=Math.min(2200,Math.max(1900,Number(record.year)||2026));if(record.coverBlobId){if(!validId(record.coverBlobId))throw new Error('Ungültiges Cover.');r.coverBlobId=record.coverBlobId;}}
  }else if(kind==='events'){
    Object.assign(r,{title:text(record.title,160).trim(),date:text(record.date,40),location:text(record.location,180),notes:text(record.notes,2000),playlistId:validId(record.playlistId)?record.playlistId:''});
  }else if(kind==='assets'){
    const extensions={'audio/mpeg':'mp3','image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
    if(!extensions[record.type]||record.path!==`media/${r.id}.${extensions[record.type]}`||!(record.size>0&&record.size<=48*1024*1024))throw new Error('Ungültige Mediendatei.');
    if(record.provider==='supabase'){
      if(!/^[a-f0-9]{64}$/.test(record.sha||''))throw new Error('Die Dateiprüfsumme fehlt.');
      r.provider='supabase';
    }else if(!/^[a-f0-9]{40}$/.test(record.sha||''))throw new Error('Der GitHub-Dateiverweis fehlt.');
    Object.assign(r,{type:record.type,path:record.path,size:record.size,sha:record.sha});
  }else if(kind==='publications'){r.at=text(record.at,40);}else throw new Error('Unbekannte Sammlung.');
  if(['tracks','albums','playlists','events'].includes(kind)&&!r.title)throw new Error('Der Name darf nicht leer sein.');
  return r;
}
export function applyOperations(catalog,operations,actor) {
  if(!Array.isArray(operations)||operations.length>2000)throw new Error('Zu viele Änderungen auf einmal.');
  const seen=new Set();
  for(const op of operations){if(!COLLECTIONS.includes(op.kind)||!validId(op.id)||seen.has(`${op.kind}/${op.id}`))throw new Error('Ungültige Änderung.');seen.add(`${op.kind}/${op.id}`);
    const before=catalog[op.kind]?.find(r=>r.id===op.id);
    if((before?._rev||null)!==(op.baseRev||null)) {const error=new Error('Dieser Eintrag wurde inzwischen von einem anderen Bandmitglied geändert.');error.status=409;error.conflict={kind:op.kind,id:op.id,remote:before||null,local:op.value};throw error;}
    if(op.value!==null&&op.value?.id!==op.id)throw new Error('Die IDs stimmen nicht überein.');
  }
  const result=structuredClone(catalog);
  for(const op of operations){const list=result[op.kind]||=[];const index=list.findIndex(r=>r.id===op.id);if(op.value===null){if(index>=0)list.splice(index,1);}else{const value={...validateRecord(op.kind,op.value),_rev:crypto.randomUUID(),_updatedBy:actor,_updatedAt:new Date().toISOString()};if(index>=0)list[index]=value;else list.push(value);}}
  const tracks=new Set(result.tracks.map(r=>r.id)),playlists=new Set(result.playlists.map(r=>r.id)),albums=new Set(result.albums.map(r=>r.id));
  for(const group of [...result.albums,...result.playlists])group.trackIds=group.trackIds.filter(id=>tracks.has(id));
  for(const event of result.events)if(!playlists.has(event.playlistId))event.playlistId='';
  result.publications=result.publications.filter(p=>albums.has(p.id));return result;
}
