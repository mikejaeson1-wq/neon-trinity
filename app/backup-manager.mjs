import {backupForOwner,backupBlobIds} from './local-library.mjs';
import {ownerSettings} from './studio-state.mjs';
const digest=async blob=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');
export class BackupManager{
 constructor({bridge,getState,getOwner,getBlob,onChange=()=>{},canRun=()=>true,beforeBackup=async()=>{},restore,saveSettings=async()=>{}}){Object.assign(this,{bridge,getState,getOwner,getBlob,onChange,canRun,beforeBackup,restoreState:restore,saveSettings});this.busy=false;this.message='';this.items=[];this.timer=null;}
 owner(){const owner=this.getOwner()?.id;if(!owner)throw new Error('Bitte zuerst mit Discord anmelden.');return owner;}
 check(owner){if(this.getOwner()?.id!==owner)throw new Error('Das Konto wurde während der Sicherung gewechselt.');}
 async load(){if(!this.bridge?.backupList)return;const owner=this.owner(),items=await this.bridge.backupList(owner);this.check(owner);this.items=items;this.onChange();}
 async create(automatic=false){
  if(!this.bridge?.backupBegin)throw new Error('Automatische Ordnersicherungen sind in der Windows-App verfügbar.');if(this.busy||!this.canRun())throw new Error('Bitte zuerst den laufenden Import oder Export abschließen.');const owner=this.owner();this.busy=true;this.message='Sicherung wird vorbereitet …';this.onChange();let job;
  try{await this.beforeBackup();this.check(owner);const state=backupForOwner(this.getState(),owner);state.settings=Object.fromEntries(Object.entries(state.settings||{}).filter(([k])=>['owner','repo','baseUrl','backend','publicBase','discordClientId'].includes(k)));const keys=backupBlobIds(state),blobs=[];
   for(const key of keys){const blob=await this.getBlob(key);this.check(owner);if(!blob)throw new Error('Eine MP3 oder ein Cover fehlt. Bitte zuerst die Bandmediathek abgleichen.');blobs.push({key,type:blob.type,size:blob.size,sha:await digest(blob)});this.message='Dateien prüfen: '+blobs.length+' / '+keys.size;this.onChange();}
   this.check(owner);job=await this.bridge.backupBegin({state,blobs,automatic},owner);this.check(owner);
   for(let i=0;i<blobs.length;i++){const file=blobs[i],blob=await this.getBlob(file.key);this.check(owner);for(let offset=0;offset<blob.size;offset+=1048576){const chunk=new Uint8Array(await blob.slice(offset,offset+1048576).arrayBuffer());await this.bridge.backupWrite(job.id,file.key,offset,chunk,owner);this.check(owner);}this.message='Gesichert: '+(i+1)+' / '+blobs.length;this.onChange();}
   const result=await this.bridge.backupFinish(job.id,ownerSettings(this.getState(),owner).backup.retention,owner);job=null;this.check(owner);ownerSettings(this.getState(),owner).backup.lastSuccess=Date.now();await this.saveSettings();this.message=result.externalError?'Interne Sicherung vollständig. Zusatzkopie fehlgeschlagen: '+result.externalError:'Vollständige Sicherung erstellt.';await this.load();return result;
  }catch(e){if(job)await this.bridge.backupAbort(job.id,owner).catch(()=>{});this.message=e.message;throw e;}finally{this.busy=false;this.onChange();}
 }
 async restore(id,{shared=false}={}){if(this.busy)throw new Error('Eine Sicherung läuft bereits.');const owner=this.owner(),manifest=await this.bridge.backupManifest(id,owner);this.check(owner);await this.create(false);this.busy=true;this.onChange();try{await this.restoreState(manifest,async key=>{const bytes=await this.bridge.backupRead(id,key,owner);this.check(owner);return bytes;},{owner,shared});this.message='Sicherung wiederhergestellt.';}finally{this.busy=false;this.onChange();}}
 async remove(id){const owner=this.owner();await this.bridge.backupRemove(id,owner);this.check(owner);await this.load();}
 start(){if(this.timer)return;this.timer=setInterval(()=>this.tick().catch(e=>{this.message=e.message;this.onChange();}),60000);this.timer.unref?.();}
 async tick(){const owner=this.getOwner()?.id;if(!owner||this.busy||!this.canRun()||!this.bridge?.backupBegin)return;const p=ownerSettings(this.getState(),owner).backup;if(p.auto&&Date.now()-p.lastSuccess>=p.interval*3600000)await this.create(true);}
 stop(){clearInterval(this.timer);this.timer=null;}
}
