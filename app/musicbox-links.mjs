import {CLOUD} from './cloud-config.mjs';
export const MUSICBOX_BUCKET='nt-musicbox',MUSICBOX_LIMIT=48*1024*1024;
const idOK=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(value);
const check=result=>{if(result.error)throw Object.assign(new Error(result.error.message||'Der Musikbox-Link konnte nicht gespeichert werden.'),{code:result.error.code,status:result.error.status});return result.data;};
export function musicboxURL(id){if(!/^[a-f0-9-]{36}$/i.test(id||''))throw new Error('Ungültiger Musikbox-Link.');return CLOUD.url+'/storage/v1/object/public/'+MUSICBOX_BUCKET+'/audio/'+id+'.mp3';}
export function musicboxSelection(catalog,kind,id){
 if(!['track','album'].includes(kind)||!idOK(id))throw new Error('Ungültige Musikauswahl.');
 const record=(kind==='track'?catalog.tracks:catalog.albums)?.find(row=>row.id===id);if(!record)throw new Error('Nur Band-Songs und Bandalben können für die Musikbox geteilt werden.');
 const ids=kind==='track'?[record.id]:record.trackIds;if(!Array.isArray(ids)||!ids.length||ids.length>500)throw new Error('Bitte ein Album mit 1 bis 500 Band-Songs wählen.');
 const tracks=ids.map(id=>catalog.tracks?.find(t=>t.id===id));if(tracks.some(t=>!t||t.visibility==='local'||t.visibility==='private'||t.ownerId))throw new Error('Private lokale Songs können nicht als Musikbox-Link geteilt werden.');
 for(const t of tracks)if(!catalog.assets?.some(a=>a.id===t.blobId&&a.provider==='supabase'&&a.type==='audio/mpeg'))throw new Error('Bitte die Band-Songs zuerst vollständig mit Supabase abgleichen.');
 return {kind,id,title:record.title,tracks:structuredClone(tracks),assets:structuredClone(catalog.assets)};
}
export async function musicboxFingerprint(selection){const {kind,tracks,assets}=selection;const source=JSON.stringify({version:1,kind,encoder:kind==='album'?'lamejs-1.2.7-44100-stereo':'original',tracks:tracks.map(t=>({id:t.id,blobId:t.blobId,sha:assets.find(a=>a.id===t.blobId)?.sha||'',duration:Number(t.duration)||0}))});return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export class MusicboxLinks{
 constructor({client,getOwner,getCatalog,getBlob,ensureSynced=async()=>{},makeAlbum,fetcher=globalThis.fetch.bind(globalThis)}){Object.assign(this,{client,getOwner,getCatalog,getBlob,ensureSynced,makeAlbum,fetcher});}
 guard(owner,signal){if(signal?.aborted)throw new DOMException('Vorgang abgebrochen.','AbortError');if(!owner||this.getOwner()?.id!==owner)throw new Error('Das angemeldete Konto hat sich geändert.');}
 async exists(url,signal){try{const r=await this.fetcher(url,{method:'HEAD',cache:'no-store',signal});if(r.ok){const size=Number(r.headers.get('content-length'));return Number.isSafeInteger(size)&&size>0&&size<=MUSICBOX_LIMIT?size:0;}if(r.status===404)return 0;throw new Error('Der MP3-Link konnte nicht geprüft werden.');}catch(e){if(signal?.aborted)throw e;throw new Error(e.message||'Musikbox-Speicher nicht erreichbar.');}}
 async create(kind,id,{signal,onProgress=()=>{}}={}){
  const owner=this.getOwner()?.id;this.guard(owner,signal);onProgress({value:0,text:'Band-Songs werden abgeglichen …'});await this.ensureSynced();this.guard(owner,signal);
  const selection=musicboxSelection(this.getCatalog(),kind,id),source_key=await musicboxFingerprint(selection);this.guard(owner,signal);
  const query=()=>this.client.from('nt_musicbox_links').select('id,byte_size,track_count').eq('kind',kind).eq('record_id',id).eq('source_key',source_key).maybeSingle();let row=check(await query());this.guard(owner,signal);
  if(!row){const inserted=await this.client.from('nt_musicbox_links').insert({kind,record_id:id,source_key,track_count:selection.tracks.length}).select('id,byte_size,track_count').single();if(inserted.error?.code==='23505')row=check(await query());else row=check(inserted);this.guard(owner,signal);}
  if(!row)throw new Error('Der Musikbox-Link konnte nicht reserviert werden. Bitte erneut versuchen.');
  const url=musicboxURL(row.id);let bytes=row.byte_size>0?await this.exists(url,signal):0;this.guard(owner,signal);
  if(!bytes){let blob;
   if(kind==='track'){onProgress({value:.3,text:'Song-MP3 wird vorbereitet …'});blob=await this.getBlob(selection.tracks[0].blobId);}else{if(!this.makeAlbum)throw new Error('Der Album-Encoder ist nicht verfügbar.');blob=await this.makeAlbum({tracks:selection.tracks,getBlob:this.getBlob,signal,onProgress});}
   this.guard(owner,signal);if(!blob?.size||blob.size>MUSICBOX_LIMIT)throw new Error('Die MP3 muss zwischen 1 Byte und 48 MiB groß sein.');
   onProgress({value:.95,text:'MP3 wird für die Musikbox bereitgestellt …'});
   const result=await this.client.auth.getSession();this.guard(owner,signal);const session=result.data?.session;if(result.error||session?.user?.id!==owner||!session.access_token)throw new Error('Bitte erneut mit Discord anmelden.');
   const uploaded=await this.fetcher(CLOUD.url+'/storage/v1/object/'+MUSICBOX_BUCKET+'/audio/'+row.id+'.mp3',{method:'POST',headers:{apikey:CLOUD.key,Authorization:'Bearer '+session.access_token,'Content-Type':'audio/mpeg','cache-control':'max-age=60','x-upsert':'false'},body:blob,signal});this.guard(owner,signal);
   if(!uploaded.ok&&![400,409].includes(uploaded.status))throw new Error('Die MP3 konnte nicht bereitgestellt werden. Bitte Internetverbindung und Supabase-Speicher prüfen.');
   bytes=await this.exists(url,signal);this.guard(owner,signal);if(!bytes)throw new Error('Die hochgeladene MP3 ist noch nicht erreichbar. Bitte erneut versuchen.');
  }
  check(await this.client.from('nt_musicbox_links').update({byte_size:bytes}).eq('id',row.id));this.guard(owner,signal);onProgress({value:1,text:'Musikbox-Link bereit.'});return {url,title:selection.title,kind,bytes,trackCount:selection.tracks.length};
 }
 async remove(kind,id){const owner=this.getOwner()?.id;this.guard(owner);if(!['track','album'].includes(kind)||!idOK(id))throw new Error('Ungültige Musikauswahl.');const rows=check(await this.client.from('nt_musicbox_links').select('id').eq('kind',kind).eq('record_id',id));this.guard(owner);if(!rows?.length)return 0;
  check(await this.client.storage.from(MUSICBOX_BUCKET).remove(rows.map(row=>'audio/'+row.id+'.mp3')));this.guard(owner);check(await this.client.from('nt_musicbox_links').delete().eq('kind',kind).eq('record_id',id));this.guard(owner);return rows.length;
 }
}
