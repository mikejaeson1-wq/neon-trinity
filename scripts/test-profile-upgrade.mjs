// Runs only on disposable Windows CI machines, using the actual published installers.
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {AlbumEncoder} from '../app/musicbox-encoder.mjs';
if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true')throw new Error('Dieser Upgrade-Test läuft ausschließlich auf dem Windows-CI-Rechner.');
const installer=path.resolve(process.argv[2]),exe=path.resolve(process.argv[3]),port=19544;
const root=await mkdtemp(path.join(os.tmpdir(),'neon-upgrade-')),canonical=path.join(process.env.APPDATA,'Neon Trinity Studio'),displaced=path.join(process.env.APPDATA,'neon-trinity-studio');
const dex='11111111-1111-4111-8111-111111111111',nix='22222222-2222-4222-8222-222222222222';
function mp3(frequency){const samples=Float32Array.from({length:8820},(_,i)=>Math.sin(i*2*Math.PI*frequency/44100)*.2),encoder=new AlbumEncoder(128);return Buffer.concat([...encoder.encode(samples,samples),...encoder.finish()]).toString('base64');}
const fixture={owner:dex,other:nix,band:mp3(220),dex:mp3(440),nix:mp3(880)};
async function install(file){await new Promise((resolve,reject)=>{const p=spawn(file,['/S'],{stdio:'ignore'}),timer=setTimeout(()=>{p.kill();reject(new Error('Installer hat zu lange gebraucht.'));},120000);p.once('error',reject);p.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('Installer-Exitcode '+code));});});}
async function download(version){const base='https://github.com/mikejaeson1-wq/neon-trinity/releases/download/v'+version+'/',r=await fetch(base+'neon-compat.json');assert.equal(r.status,200);const manifest=await r.json();assert.equal(manifest.version,version);assert.equal(manifest.installer.name,'Neon-Trinity-Studio-Setup.exe');const response=await fetch(base+manifest.installer.name);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,manifest.installer.size);assert.equal(createHash('sha512').update(bytes).digest('base64'),manifest.installer.sha512);const file=path.join(root,'studio-'+version+'.exe');await writeFile(file,bytes);return file;}
async function launch(){
 const p=spawn(exe,['--remote-debugging-port='+port],{stdio:'ignore'});let ws,id=0;const pending=new Map(),events=new Map();
 const stop=async()=>{try{await promisify(execFile)('taskkill',['/PID',String(p.pid),'/T','/F']);}catch{}ws?.close();await delay(500);};
 try{let target;for(let n=0;n<150;n++){if(p.exitCode!=null)throw new Error('Studio wurde vorzeitig beendet.');try{const rows=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=rows.find(row=>row.url==='ntapp://studio/index.html');if(target)break;}catch{}await delay(200);}assert.ok(target,'Studio-Debug-Verbindung fehlt.');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.method&&events.has(r.method)){events.get(r.method)(r.params);events.delete(r.method);}const request=pending.get(r.id);if(request){pending.delete(r.id);r.error?request.reject(new Error(r.error.message)):request.resolve(r.result);}});
 ws.addEventListener('close',()=>{for(const r of pending.values())r.reject(new Error('Testprozess geschlossen.'));pending.clear();});
 const send=async(method,params={})=>{const key=++id;let timer;try{return await new Promise((resolve,reject)=>{timer=setTimeout(()=>{pending.delete(key);reject(new Error('Testantwort fehlt: '+method));},15000);pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});}finally{clearTimeout(timer);}};
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 for(let n=0;n<100;n++){if(await evaluate("!!document.querySelector('#main h1')"))break;await delay(100);}await delay(1200);
 return {stop,evaluate,async seed(displacedProfile=false){await send('Debugger.enable');let timer;const paused=new Promise((resolve,reject)=>{events.set('Debugger.paused',resolve);timer=setTimeout(()=>reject(new Error('Der Test konnte den gespeicherten Zustand nicht anhalten.')),15000);});
 const expression=`(async()=>{const db=await import('./db.mjs'),core=await import('./core.mjs');const s=core.newState(),f=${JSON.stringify(fixture)};const bytes=body=>Uint8Array.from(atob(body),c=>c.charCodeAt(0)),blob=body=>new Blob([bytes(body)],{type:'audio/mpeg'});const make=(id,body,owner)=>({id,blobId:id+'-mp3',title:id,artist:'Upgrade Test',voices:'Test',genre:'',duration:.2,size:bytes(body).length,digest:'a'.repeat(64),addedAt:'2026-10-22T00:00:00Z',...(owner?{ownerId:owner,visibility:'local'}:{})});if(${displacedProfile}){s.localTracks=[make('displaced-song',f.dex,f.owner)];await db.putBlob('displaced-song-mp3',blob(f.dex));}else{s.tracks=[make('upgrade-band',f.band)];s.localTracks=[make('upgrade-dex',f.dex,f.owner),make('upgrade-nix',f.nix,f.other)];s.localPlaylists=[{id:'upgrade-list',title:'Local Mix',description:'',ownerId:f.owner,visibility:'local',trackIds:['upgrade-dex']}];for(const [id,body]of [['upgrade-band',f.band],['upgrade-dex',f.dex],['upgrade-nix',f.nix]])await db.putBlob(id+'-mp3',blob(body));}s._upgradeFixture=${displacedProfile?"'displaced'":"'original'"};await db.saveState(s);debugger;return true;})()`;
 const request=evaluate(expression).catch(()=>{});try{await paused;await stop();await request;}finally{clearTimeout(timer);}},async contents(){return evaluate("(async()=>{const db=await import('./db.mjs'),s=await db.loadState();const blobs={};for(const id of ['upgrade-band','upgrade-dex','upgrade-nix']){const blob=await db.getBlob(id+'-mp3');if(blob)blobs[id]=btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())));}return {state:s,blobs};})()");}};
 }catch(e){await stop();throw e;}
}
async function fingerprint(folder){const rows=[];async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,item.name);if(item.isDirectory())await walk(name);else rows.push([path.relative(folder,name),createHash('sha256').update(await readFile(name)).digest('hex')]);}}await walk(folder);return JSON.stringify(rows.sort((a,b)=>a[0].localeCompare(b[0])));}
let active;
try{
 const originalSetup=await download('1.0.1');await install(originalSetup);active=await launch();await active.seed();active=null;assert.ok((await stat(path.join(canonical,'IndexedDB'))).isDirectory());
 const faultySetup=await download('1.1.0');await install(faultySetup);active=await launch();const hidden=await active.contents();assert.ok(!hidden.state?.localTracks?.some(t=>t.id==='upgrade-dex'),'Die Regression von 1.1.0 wurde nicht reproduziert.');await active.seed(true);active=null;
 const displacedBefore=await fingerprint(path.join(displaced,'IndexedDB'));
 await install(installer);active=await launch();
 for(const pause of [0,16000]){if(pause)await delay(pause);const saved=await active.contents();assert.equal(saved.state._upgradeFixture,'original');assert.equal(saved.state.tracks.length,1);assert.equal(saved.state.localTracks.length,2);assert.equal(saved.state.localPlaylists.length,1);assert.equal(saved.blobs['upgrade-band'],fixture.band);assert.equal(saved.blobs['upgrade-dex'],fixture.dex);assert.equal(saved.blobs['upgrade-nix'],fixture.nix);}
 assert.ok(await active.evaluate("(async()=>{const {getBlob}=await import('./db.mjs');const data=await(await getBlob('upgrade-dex-mp3')).arrayBuffer();const decoded=await new OfflineAudioContext(2,1,44100).decodeAudioData(data);return decoded.duration>0&&decoded.length>0;})()"),'Die wiedergefundene private MP3 muss als Audio dekodierbar sein.');
 await active.stop();active=null;assert.equal(await fingerprint(path.join(displaced,'IndexedDB')),displacedBefore,'Der zusätzliche Ordner aus 1.1.0 muss unverändert erhalten bleiben.');
 console.log('Echtes Upgrade 1.0.1 → 1.1.0 → Hotfix: Regression reproduziert; Band-MP3, private Dex-/Nix-MP3s und lokale Playlist vollständig wieder sichtbar im ursprünglichen Profil; zusätzliche 1.1.0-Ablage unverändert erhalten.');
}finally{if(active)await active.stop();}
