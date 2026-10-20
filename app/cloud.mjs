import {ListeningAPI} from './listen-access.mjs';
import {createClient} from './vendor/supabase.mjs';
import {THEMES} from './core.mjs';
import {CLOUD} from './cloud-config.mjs';
import {applyOperations,validId} from './shared.mjs';
import {privateRecord} from './private-playlists.mjs';
const extensions={'audio/mpeg':'mp3','image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
export function cloudError(error){const e=new Error(error?.message||'Die Supabase-Anfrage ist fehlgeschlagen.');e.status=Number(error?.status)||0;e.code=error?.code;return e;}
function check(result){if(result.error)throw cloudError(result.error);return result.data;}
export function createCloudClient(){
 const desktop=globalThis.window?.neonDesktop;let storage;
 if(desktop?.cloudGetItem)storage={getItem:key=>desktop.cloudGetItem(key),setItem:(key,value)=>desktop.cloudSetItem(key,value),removeItem:key=>desktop.cloudRemoveItem(key)};
 else {try{storage=window.localStorage;}catch{}if(!storage){const memory=new Map();storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};}}
 return createClient(CLOUD.url,CLOUD.key,{auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,storage,storageKey:'neon-trinity-supabase-auth'},realtime:{params:{eventsPerSecond:2}}});
}
export class SupabaseBackend{
 constructor(client=createCloudClient()){this.client=client;this.info={service:'neon-trinity-supabase',configured:true,discordClientId:'',publicBase:CLOUD.publicBase};this.actor=null;this.listeningAPI=new ListeningAPI({client});}
 async status(){const config=check(await this.client.from('nt_config').select('discord_client_id,public_base,spotify_client_id').eq('id',1).single());this.info={...this.info,discordClientId:config.discord_client_id,spotifyClientId:config.spotify_client_id||'',publicBase:config.public_base||CLOUD.publicBase};return this.info;}
 async discordAvailable(){const response=await fetch(CLOUD.url+'/auth/v1/settings',{headers:{apikey:CLOUD.key},cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Die Discord-Einrichtung in Supabase konnte gerade nicht geprüft werden.');const data=await response.json();this.info.discordEnabled=data.external?.discord===true;return this.info.discordEnabled;}
 async identity(){const result=check(await this.client.rpc('nt_identity'));this.actor=result;return result;}
 async catalog(){return check(await this.client.from('nt_catalog').select('data,revision').eq('id',1).single());}
 async privatePlaylists(){const rows=check(await this.client.from('nt_private_playlists').select('id,owner_id,data,revision').eq('owner_id',this.actor.id).order('updated_at'));return rows.map(row=>({...row.data,id:row.id,visibility:'private',ownerId:row.owner_id,_rev:row.revision}));}
 async savePrivatePlaylist(record){
  const value=privateRecord(record,this.actor?.id),data={id:value.id,title:value.title,description:value.description,trackIds:value.trackIds};
  const payload={data,revision:crypto.randomUUID(),updated_at:new Date().toISOString()};
  let query;
  if(value._rev)query=this.client.from('nt_private_playlists').update(payload).eq('owner_id',this.actor.id).eq('id',value.id).eq('revision',value._rev);
  else query=this.client.from('nt_private_playlists').insert({...payload,id:value.id,owner_id:this.actor.id});
  const row=check(await query.select('id,owner_id,data,revision').maybeSingle());
  if(!row){const error=new Error('Diese persönliche Playlist wurde auf einem anderen Gerät geändert. Bitte abgleichen und erneut öffnen.');error.status=409;throw error;}
  return {...row.data,id:row.id,visibility:'private',ownerId:row.owner_id,_rev:row.revision};
 }
 async deletePrivatePlaylist(record){const row=check(await this.client.from('nt_private_playlists').delete().eq('owner_id',this.actor.id).eq('id',record.id).eq('revision',record._rev).select('id').maybeSingle());if(!row)throw new Error('Die persönliche Playlist wurde inzwischen geändert. Bitte erneut abgleichen.');}
 async save(operations){
  for(let attempt=0;attempt<5;attempt++){
   const row=await this.catalog();let next;
   try{next=applyOperations(row.data,operations,this.actor?.alias||'Bandmitglied');}
   catch(error){if(error.status===409)error.data={catalog:row.data,conflict:error.conflict};throw error;}
   const result=await this.client.from('nt_catalog').update({data:next}).eq('id',1).eq('revision',row.revision).select('data,revision').maybeSingle();
   const saved=check(result);if(saved)return {catalog:saved.data,revision:saved.revision};
  }
  const error=new Error('Die Mediathek wird gerade häufig geändert. Bitte erneut abgleichen.');error.status=409;error.data={catalog:(await this.catalog()).data};throw error;
 }
 async upload(id,blob){
  if(!validId(id)||!extensions[blob.type]||blob.size<=0||blob.size>48*1024*1024)throw new Error('Ungültige Mediendatei.');
  const path=`media/${id}.${extensions[blob.type]}`;
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const result=await this.client.storage.from(CLOUD.bucket).upload(path,blob,{contentType:blob.type,upsert:false,cacheControl:'3600'});
  if(result.error){
   if(!['409','400'].includes(String(result.error.statusCode))&&!/already exists|duplicate/i.test(result.error.message))throw cloudError(result.error);
   const existing=check(await this.client.storage.from(CLOUD.bucket).download(path));
   const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await existing.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
   if(hash!==sha)throw new Error('Unter dieser Datei-ID liegen bereits andere Daten. Bitte die Datei neu importieren.');
  }
  return {id,path,type:blob.type,size:blob.size,sha,provider:'supabase'};
 }
 async download(id,catalog){const asset=catalog.assets.find(a=>a.id===id&&a.provider==='supabase');if(!asset)throw new Error('Die Datei ist noch nicht in der gemeinsamen Mediathek gespeichert.');return check(await this.client.storage.from(CLOUD.bucket).download(asset.path));}
 async publish(albumIds,theme){
  if(!Array.isArray(albumIds)||albumIds.some(x=>!validId(x)))throw new Error('Ungültige Albumauswahl.');
  const catalog=(await this.catalog()).data,rows=[];
  for(const id of [...new Set(albumIds)]){
   const album=catalog.albums.find(a=>a.id===id);if(!album)throw new Error('Ein Album wurde inzwischen entfernt. Bitte erneut abgleichen.');
   const tracks=album.trackIds.map(id=>catalog.tracks.find(t=>t.id===id)).filter(Boolean);
   if(!tracks.length)throw new Error('Ein Album ohne Songs kann nicht veröffentlicht werden.');
   const ids=new Set([album.coverBlobId,...tracks.flatMap(t=>[t.blobId,t.coverBlobId])].filter(Boolean));
   const assets=[...ids].map(id=>catalog.assets.find(a=>a.id===id&&a.provider==='supabase'));
   if(assets.some(a=>!a))throw new Error('Eine Datei fehlt in Supabase. Bitte die Mediathek zuerst synchronisieren.');
   rows.push({id,data:{album,tracks,assets,theme:THEMES[theme]?theme:'trinity'},asset_paths:assets.map(a=>a.path),updated_at:new Date().toISOString()});
  }
  if(rows.length)check(await this.client.from('nt_releases').upsert(rows));
  const existing=check(await this.client.from('nt_releases').select('id'));
  const removed=existing.map(r=>r.id).filter(id=>!albumIds.includes(id));if(removed.length)check(await this.client.from('nt_releases').delete().in('id',removed));
  const current=(await this.catalog()).data,publications=albumIds.map(id=>({id,at:new Date().toISOString()}));
  const operations=[...publications.map(value=>({kind:'publications',id:value.id,value,baseRev:current.publications.find(p=>p.id===value.id)?._rev||null})),...current.publications.filter(p=>!albumIds.includes(p.id)).map(p=>({kind:'publications',id:p.id,value:null,baseRev:p._rev}))];
  const saved=operations.length?await this.save(operations):{catalog:current};
  return {...saved,status:'in Supabase veröffentlicht',url:`${this.info.publicBase}/album.html${albumIds.length?'?id='+encodeURIComponent(albumIds[0]):''}`};
 }
 async setConfig(values){if(this.actor?.alias!=='Dex')throw new Error('Diese Team-Einstellung verwaltet Dex.');check(await this.client.from('nt_config').update(values).eq('id',1).select().single());return this.status();}
 async publicRequest(path,method='GET',data){return this.listeningAPI.request(path,method,data);}
}
