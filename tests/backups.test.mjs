import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {StudioBackups} from '../desktop/backups.cjs';
const dex='11111111-1111-4111-8111-111111111111',nix='22222222-2222-4222-8222-222222222222';
const bytes=Buffer.from('ID3 original music'),manifest=()=>({state:{version:1,localTracks:[{id:'song',ownerId:dex}],localPlaylists:[],privatePlaylists:[],studioOwners:{[dex]:{}}},blobs:[{key:'mp3',type:'audio/mpeg',size:bytes.length,sha:createHash('sha256').update(bytes).digest('hex')}]});
test('Vollständige Ordnersicherung prüft jeden Block, ist kontogebunden und erkennt spätere Dateischäden',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'neon-backup-'));let current=dex;const b=new StudioBackups({app:{getPath:()=>folder},isOwner:o=>o===current});
 try{const job=await b.begin(manifest(),dex);await assert.rejects(b.write(job.id,'../bad',0,bytes,dex),/Ungültiger/);await assert.rejects(b.finish(job.id,5,dex),/vollständig/);await b.write(job.id,'mp3',0,bytes.subarray(0,5),dex);await b.write(job.id,'mp3',5,bytes.subarray(5),dex);const saved=await b.finish(job.id,5,dex);assert.equal((await b.list(dex)).length,1);assert.equal(Buffer.from(await b.read(saved.id,'mp3',dex)).toString(),bytes.toString());current=nix;assert.equal((await b.list(nix)).length,0);await assert.rejects(b.manifest(saved.id,dex),/anmelden/);current=dex;const file=path.join(folder,'backups',dex,saved.id,'mp3.mp3');await writeFile(file,Buffer.alloc(bytes.length,0));await assert.rejects(b.read(saved.id,'mp3',dex),/verändert/);}
 finally{await b.close();await rm(folder,{recursive:true,force:true});}
});
test('Kontowechsel und falsche Prüfsummen lassen keine vollständige Sicherung zurück',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'neon-backup-'));let current=dex;const b=new StudioBackups({app:{getPath:()=>folder},isOwner:o=>o===current});
 try{let job=await b.begin(manifest(),dex);current=nix;await assert.rejects(b.write(job.id,'mp3',0,bytes,dex),/anmelden/);assert.equal(b.busy,false);current=dex;assert.equal((await b.list(dex)).length,0);job=await b.begin(manifest(),dex);await assert.rejects(b.write(job.id,'mp3',0,Buffer.alloc(bytes.length,0),dex),e=>e.code==='BACKUP_HASH');assert.equal(b.busy,false);assert.equal((await b.list(dex)).length,0);const foreign=manifest();foreign.state.localTracks[0].ownerId=nix;await assert.rejects(b.begin(foreign,dex),/anderen Kontos/);}
 finally{await b.close();await rm(folder,{recursive:true,force:true});}
});
