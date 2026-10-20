const MAX_FILE=48*1024*1024;
export class OfflineMusic{
 constructor({indexedDB=globalThis.indexedDB,getOwner,getBlob,onChange=()=>{}}){Object.assign(this,{getOwner,getBlob,onChange});this.generation=0;this.owner=null;this.rows=[];this.limit=256*1024*1024;this.urls=new Map();this.db=new Promise((resolve,reject)=>{const r=indexedDB.open('neon-trinity-mobile-offline',1);r.onupgradeneeded=()=>r.result.createObjectStore('songs',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Offline-Speicher ist nicht verfügbar.'));});}
 setOwner(id){if(this.owner===id)return;this.owner=id||null;this.generation++;this.rows=[];for(const url of this.urls.values())URL.revokeObjectURL(url);this.urls.clear();}
 async tx(mode,callback){const db=await this.db;return new Promise((resolve,reject)=>{const t=db.transaction('songs',mode);let result;try{result=callback(t.objectStore('songs'));}catch(e){t.abort();reject(e);return;}t.oncomplete=()=>resolve(typeof result==='function'?result():result);t.onerror=()=>reject(t.error||new Error('Offline-Speicher voll oder gesperrt.'));t.onabort=()=>reject(new Error('Offline-Speichern abgebrochen.'));});}
 valid(owner,gen){return owner&&this.owner===owner&&this.getOwner()?.id===owner&&this.generation===gen;}
 async load(){const owner=this.owner,gen=this.generation;if(!owner)return [];const rows=await this.tx('readonly',s=>{const r=s.getAll();return ()=>r.result;});if(!this.valid(owner,gen))return [];this.rows=rows.filter(r=>r.owner===owner).map(({blob,...row})=>row);this.onChange();return this.rows;}
 async save(track){
  const owner=this.owner,gen=this.generation;if(!this.valid(owner,gen)||track.visibility==='local'||track.ownerId)throw new Error('Offline-Downloads sind für deine Bandmediathek verfügbar.');await this.load();if(!this.valid(owner,gen))throw new Error('Das Konto wurde gewechselt.');
  if(this.rows.some(r=>r.track.id===track.id&&r.track.blobId===track.blobId))return;
  const blob=await this.getBlob(track.blobId);if(!this.valid(owner,gen))throw new Error('Das Konto wurde gewechselt.');
  if(!blob||blob.size<1||blob.size>MAX_FILE||blob.type!=='audio/mpeg')throw new Error('Diese Band-MP3 konnte nicht heruntergeladen werden.');const used=this.rows.filter(r=>r.track.id!==track.id).reduce((n,r)=>n+r.size,0);if(used+blob.size>this.limit)throw new Error('Dein Offline-Limit ist erreicht. Entferne Downloads oder erhöhe das Speicherlimit.');
  const bytes=new Uint8Array(await blob.arrayBuffer()),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');if(!this.valid(owner,gen))throw new Error('Das Konto wurde gewechselt.');
  const clean={id:track.id,blobId:track.blobId,title:String(track.title||'').slice(0,160),artist:String(track.artist||'Neon Trinity').slice(0,160),duration:track.duration};
  const row={downloadId:crypto.randomUUID(),key:owner+'/'+track.id,owner,track:clean,blob,size:blob.size,sha,at:new Date().toISOString()};await this.tx('readwrite',s=>s.put(row));if(!this.valid(owner,gen)){await this.tx('readwrite',s=>{const r=s.get(row.key);r.onsuccess=()=>{if(r.result?.downloadId===row.downloadId)s.delete(row.key);};});throw new Error('Das Konto wurde gewechselt.');}if(this.urls.has(track.id)){URL.revokeObjectURL(this.urls.get(track.id));this.urls.delete(track.id);}await this.load();
 }
 async media(id){
  const owner=this.owner,gen=this.generation;if(!this.valid(owner,gen))throw new Error('Bitte dein eigenes Offline-Konto öffnen.');if(this.urls.has(id))return this.urls.get(id);const row=await this.tx('readonly',s=>{const r=s.get(owner+'/'+id);return ()=>r.result;});if(!row||row.owner!==owner||!this.valid(owner,gen))throw new Error('Dieser Song ist nicht für dein Konto offline gespeichert.');
  const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await row.blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');if(sha!==row.sha||!this.valid(owner,gen))throw new Error('Der Offline-Download ist beschädigt oder das Konto wurde gewechselt.');const url=URL.createObjectURL(row.blob);this.urls.set(id,url);return url;
 }
 async remove(id){const owner=this.owner,gen=this.generation;if(!this.valid(owner,gen))return;const url=this.urls.get(id);if(url)URL.revokeObjectURL(url);this.urls.delete(id);await this.tx('readwrite',s=>s.delete(owner+'/'+id));if(this.valid(owner,gen))await this.load();}
 async clear(){for(const row of [...this.rows])await this.remove(row.track.id);}
}
