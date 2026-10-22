const bucket='nt-personal-shares';
const checked=result=>{if(result.error)throw new Error(result.error.message||'Die private Freigabe ist nicht erreichbar.');return result.data;};
export const activeGrant=(g,now=Date.now())=>!g.expires_at||Date.parse(g.expires_at)>now;
export class SongSharing{
 constructor({client,getOwner,getBlob,onChange=()=>{}}){Object.assign(this,{client,getOwner,getBlob,onChange});this.owner=null;this.generation=0;this.songs=[];this.grants=[];this.feedback=[];this.members=[];this.urls=new Set();this.busy=false;}
 sync(){const id=this.getOwner()?.id||null;if(id===this.owner)return false;this.owner=id;this.generation++;this.clear();return true;}
 clear(){for(const url of this.urls)URL.revokeObjectURL(url);this.urls.clear();this.songs=[];this.grants=[];this.feedback=[];this.members=[];}
 check(owner,generation=this.generation){if(this.getOwner()?.id!==owner||generation!==this.generation)throw new Error('Das Discord-Konto wurde gewechselt. Bitte erneut öffnen.');}
 async refresh(){this.sync();if(!this.owner)return;const owner=this.owner,generation=this.generation;
  const results=await Promise.all([this.client.rpc('nt_share_members'),this.client.from('nt_personal_songs').select('*').order('created_at',{ascending:false}),this.client.from('nt_song_grants').select('*').order('created_at',{ascending:false}),this.client.from('nt_share_feedback').select('*').order('created_at',{ascending:false}).limit(300)]);
  const [members,songs,grants,feedback]=results.map(checked);this.check(owner,generation);Object.assign(this,{members,songs,grants,feedback});this.onChange();
 }
 incoming(){return this.grants.filter(g=>g.recipient_id===this.owner&&activeGrant(g));}
 tracks(){return this.incoming().map(g=>{const s=this.songs.find(s=>s.id===g.song_id);return s?{id:'shared-'+s.id,blobId:'shared-'+s.id,title:s.title,artist:s.artist,duration:s.duration,size:s.size,digest:s.sha,visibility:'shared',ownerId:s.owner_id,grantId:g.id,sharedSongId:s.id,allowDownload:g.allow_download,voices:'Geteilt von '+this.alias(s.owner_id),addedAt:g.created_at}:null;}).filter(Boolean);}
 alias(id){return this.members.find(m=>m.id===id)?.alias||'Bandmitglied';}
 async share(track,{recipients,allowDownload=false,expiresAt=null}){
  this.sync();const owner=this.owner,generation=this.generation;if(!owner||track.ownerId!==owner||track.visibility!=='local')throw new Error('Nur deine eigenen privaten MP3s können gezielt geteilt werden.');if(this.busy)throw new Error('Eine Freigabe wird bereits vorbereitet.');
  const allowed=new Set(this.members.filter(m=>m.id!==owner).map(m=>m.id)),ids=[...new Set(recipients)];if(!ids.length||ids.some(id=>!allowed.has(id)))throw new Error('Bitte eine freigeschaltete Person auswählen.');if(expiresAt&&(!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now()))throw new Error('Das Ablaufdatum muss in der Zukunft liegen.');
  this.busy=true;try{const blob=await this.getBlob(track.blobId);this.check(owner,generation);if(!blob||blob.type!=='audio/mpeg'||!blob.size||blob.size>50331648)throw new Error('Die lokale MP3 fehlt oder ist zu groß.');
   const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');this.check(owner,generation);
   let song=checked(await this.client.from('nt_personal_songs').select('*').eq('owner_id',owner).eq('source_id',track.id).maybeSingle());this.check(owner,generation);
   if(song&&song.sha!==sha)throw new Error('Diese Songfassung wurde geändert. Bitte eine neue lokale Fassung teilen.');
   if(!song){song=checked(await this.client.from('nt_personal_songs').insert({owner_id:owner,source_id:track.id,title:track.title,artist:track.artist,duration:track.duration,size:blob.size,sha}).select('*').single());this.check(owner,generation);}
   const name=owner+'/'+song.id+'.mp3',storage=this.client.storage.from(bucket),upload=await storage.upload(name,blob,{contentType:'audio/mpeg',upsert:false,cacheControl:'0'});this.check(owner,generation);
   if(upload.error){if(!/already exists|duplicate|409/i.test(upload.error.message+' '+upload.error.statusCode))checked(upload);const existing=checked(await storage.download(name));const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await existing.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==sha)throw new Error('Die hochgeladene MP3 stimmt nicht mit dem Original überein.');}
   for(const recipient_id of ids){this.check(owner,generation);const existing=checked(await this.client.from('nt_song_grants').select('id').eq('song_id',song.id).eq('recipient_id',recipient_id).maybeSingle()),payload={allow_download:!!allowDownload,expires_at:expiresAt||null};if(existing)checked(await this.client.from('nt_song_grants').update(payload).eq('id',existing.id));else checked(await this.client.from('nt_song_grants').insert({...payload,song_id:song.id,recipient_id}));}
   this.check(owner,generation);await this.refresh();return song;
  }finally{this.busy=false;}
 }
 async revoke(id){const owner=this.owner;checked(await this.client.from('nt_song_grants').delete().eq('id',id));this.check(owner);await this.refresh();}
 async update(id,patch){const owner=this.owner;checked(await this.client.from('nt_song_grants').update({allow_download:!!patch.allowDownload,expires_at:patch.expiresAt||null}).eq('id',id));this.check(owner);await this.refresh();}
 async blob(id){this.sync();const owner=this.owner,generation=this.generation;await this.refresh();this.check(owner,generation);const t=this.tracks().find(t=>t.id===id);if(!t)throw new Error('Diese Freigabe ist abgelaufen oder wurde zurückgezogen.');const blob=checked(await this.client.storage.from(bucket).download(t.ownerId+'/'+t.sharedSongId+'.mp3'));this.check(owner,generation);return blob;}
 async objectURL(id){const blob=await this.blob(id),url=URL.createObjectURL(blob);this.urls.add(url);return url;}
 async download(id){const track=this.tracks().find(t=>t.id===id);if(!track?.allowDownload)throw new Error('Für diesen Song ist kein MP3-Download freigegeben.');const blob=await this.blob(id);if(!this.tracks().find(t=>t.id===id)?.allowDownload)throw new Error('Die Downloadfreigabe wurde zurückgezogen.');return blob;}
 async comment(grantId,body,position=0,kind='comment'){const owner=this.owner;if(!this.grants.some(g=>g.id===grantId&&activeGrant(g))||!String(body).trim()||body.length>2000)throw new Error('Bitte eine aktive Freigabe und einen Kommentar auswählen.');checked(await this.client.from('nt_share_feedback').insert({grant_id:grantId,author_id:owner,body:body.trim(),position:Math.max(0,Number(position)||0),kind}));this.check(owner);await this.refresh();}
}
