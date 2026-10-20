const fs=require('node:fs/promises');
const path=require('node:path');
const {constants}=require('node:fs');
const {randomUUID,createHash}=require('node:crypto');
const MIME={'audio/mpeg':'mp3','image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const key=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v);
function validManifest(value,owner){
 if(!value||value.state?.version!==1||!Array.isArray(value.blobs)||value.blobs.length>30000||JSON.stringify(value).length>24*1024*1024)throw new Error('Ungültige Sicherungsdaten.');
 for(const kind of ['localTracks','localPlaylists','privatePlaylists'])if((value.state[kind]||[]).some(r=>r.ownerId!==owner))throw new Error('Die Sicherung enthält Daten eines anderen Kontos.');
 if(Object.keys(value.state.studioOwners||{}).some(id=>id!==owner))throw new Error('Fremde Studio-Einstellungen dürfen nicht gesichert werden.');
 const ids=new Set();for(const b of value.blobs){if(!key(b.key)||ids.has(b.key)||!MIME[b.type]||!Number.isInteger(b.size)||b.size<1||b.size>50331648||!/^[a-f0-9]{64}$/.test(b.sha||''))throw new Error('Ungültige Datei in der Sicherung.');ids.add(b.key);}
 return structuredClone(value);
}
class StudioBackups{
 constructor({app,isOwner}){Object.assign(this,{app,isOwner});this.jobs=new Map();}
 get busy(){return this.jobs.size>0;}
 assert(owner){if(!uuid(owner)||!this.isOwner(owner))throw new Error('Bitte mit dem zugehörigen Discord-Konto anmelden.');}
 async base(owner){this.assert(owner);const base=path.join(this.app.getPath('userData'),'backups'),root=path.join(base,owner);await fs.mkdir(root,{recursive:true,mode:0o700});for(const p of [base,root]){const st=await fs.lstat(p);if(!st.isDirectory()||st.isSymbolicLink())throw new Error('Der Sicherungsordner ist keine reguläre lokale Ablage.');}return root;}
 async stale(){for(const [id,job] of this.jobs)if(!this.isOwner(job.owner))await this.abort(id,job.owner);}
 async job(id,owner){await this.stale();this.assert(owner);const job=this.jobs.get(id);if(!job||job.owner!==owner)throw new Error('Dieser Sicherungsvorgang ist nicht mehr aktiv.');return job;}
 async begin(value,owner){
  await this.stale();this.assert(owner);if(this.busy)throw new Error('Eine Sicherung läuft bereits.');const manifest=validManifest(value,owner),root=await this.base(owner),id=randomUUID(),folder=path.join(root,'pending-'+id);await fs.mkdir(folder,{mode:0o700});
  const job={id,owner,folder,root,manifest,files:new Map(manifest.blobs.map(b=>[b.key,{...b,offset:0,hash:createHash('sha256'),handle:null,complete:false}]))};this.jobs.set(id,job);return {id};
 }
 async write(id,blobKey,offset,input,owner){
  const job=await this.job(id,owner),file=job.files.get(blobKey),bytes=input instanceof ArrayBuffer?Buffer.from(input):input instanceof Uint8Array?Buffer.from(input.buffer,input.byteOffset,input.byteLength):null;
  if(!file||!bytes||bytes.length<1||bytes.length>1048576||offset!==file.offset||file.complete||offset+bytes.length>file.size)throw new Error('Ungültiger Sicherungsblock.');
  try{if(!file.handle)file.handle=await fs.open(path.join(job.folder,file.key+'.'+MIME[file.type]),'wx',0o600);let written=0;while(written<bytes.length){const r=await file.handle.write(bytes,written,bytes.length-written,offset+written);if(!r.bytesWritten)throw new Error('Der Sicherungsspeicher ist voll.');written+=r.bytesWritten;}file.hash.update(bytes);file.offset+=bytes.length;
   if(file.offset===file.size){await file.handle.sync();await file.handle.close();file.handle=null;if(file.hash.digest('hex')!==file.sha)throw new Error('Die Dateiprüfsumme der Sicherung stimmt nicht.');file.complete=true;}this.assert(owner);return {written:file.offset};
  }catch(e){await this.abort(id,owner);throw e;}
 }
 async finish(id,retention,owner){
  const job=await this.job(id,owner);if([...job.files.values()].some(f=>!f.complete))throw new Error('Die Sicherung ist noch nicht vollständig.');
  const manifest={format:'neon-trinity-folder-backup',version:2,ownerId:owner,createdAt:new Date().toISOString(),automatic:job.manifest.automatic===true,state:job.manifest.state,blobs:job.manifest.blobs};
  await fs.writeFile(path.join(job.folder,'manifest.json'),JSON.stringify(manifest),{flag:'wx',mode:0o600});this.assert(owner);const backupId='backup-'+id;await fs.rename(job.folder,path.join(job.root,backupId));this.jobs.delete(id);
  if(manifest.automatic)await this.prune(owner,retention);return {id:backupId,createdAt:manifest.createdAt,files:manifest.blobs.length,bytes:manifest.blobs.reduce((n,b)=>n+b.size,0)};
 }
 async abort(id,owner){const job=this.jobs.get(id);if(!job||job.owner!==owner)return;this.jobs.delete(id);for(const f of job.files.values())await f.handle?.close().catch(()=>{});await fs.rm(job.folder,{recursive:true,force:true});}
 async folder(id,owner){const root=await this.base(owner);if(!/^backup-[a-f0-9-]{36}$/i.test(id||''))throw new Error('Ungültige Sicherung.');const target=path.join(root,id),st=await fs.lstat(target);if(!st.isDirectory()||st.isSymbolicLink())throw new Error('Ungültiger Sicherungsordner.');return target;}
 async manifest(id,owner){
  const folder=await this.folder(id,owner),target=path.join(folder,'manifest.json'),st=await fs.lstat(target);if(!st.isFile()||st.isSymbolicLink()||st.size>24*1024*1024)throw new Error('Ungültiges Sicherungsverzeichnis.');
  const value=JSON.parse(await fs.readFile(target,'utf8'));if(value.format!=='neon-trinity-folder-backup'||value.version!==2||value.ownerId!==owner)throw new Error('Diese Sicherung gehört zu einem anderen Konto.');validManifest(value,owner);this.assert(owner);return value;
 }
 async list(owner){
  const root=await this.base(owner),items=[];for(const e of await fs.readdir(root,{withFileTypes:true})){if(!e.isDirectory()||e.isSymbolicLink()||!/^backup-[a-f0-9-]{36}$/i.test(e.name))continue;try{const m=await this.manifest(e.name,owner);items.push({id:e.name,createdAt:m.createdAt,automatic:m.automatic,files:m.blobs.length,bytes:m.blobs.reduce((n,b)=>n+b.size,0)});}catch{}}
  return items.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 }
 async read(id,blobKey,owner){
  const manifest=await this.manifest(id,owner),file=manifest.blobs.find(b=>b.key===blobKey);if(!file)throw new Error('Die Datei gehört nicht zu dieser Sicherung.');const target=path.join(await this.folder(id,owner),file.key+'.'+MIME[file.type]),st=await fs.lstat(target);if(!st.isFile()||st.isSymbolicLink()||st.size!==file.size)throw new Error('Eine Sicherungsdatei fehlt oder ist beschädigt.');
  const handle=await fs.open(target,constants.O_RDONLY|(constants.O_NOFOLLOW||0));try{const stat=await handle.stat();if(!stat.isFile()||stat.size!==file.size)throw new Error('Ungültige Sicherungsdatei.');const bytes=await handle.readFile();if(bytes.length!==file.size||createHash('sha256').update(bytes).digest('hex')!==file.sha)throw new Error('Eine Sicherungsdatei wurde verändert.');this.assert(owner);return new Uint8Array(bytes);}finally{await handle.close();}
 }
 async remove(id,owner){const target=await this.folder(id,owner);await this.manifest(id,owner);await fs.rm(target,{recursive:true,force:true});}
 async prune(owner,retention){const limit=Math.min(20,Math.max(1,Math.floor(Number(retention)||5))),items=(await this.list(owner)).filter(x=>x.automatic);for(const old of items.slice(limit))await this.remove(old.id,owner);}
 async close(){for(const [id,job] of this.jobs)await this.abort(id,job.owner);}
}
module.exports={StudioBackups,validManifest};
