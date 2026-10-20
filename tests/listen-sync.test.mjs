import test from 'node:test';
import assert from 'node:assert/strict';
import {SynchronizedPlayback} from '../app/listen-sync.mjs';
import {ListeningSession} from '../app/listen.mjs';
import {listeningRoomFromURL,roomFromArguments} from '../desktop/deep-link.cjs';
class Audio extends EventTarget{paused=true;currentTime=0;playbackRate=1;src='';plays=0;async play(){this.plays++;this.paused=false;}pause(){this.paused=true;}}
const room=(patch={})=>({id:'a'.repeat(64),track:{id:'song-one',duration:240},mediaUrl:'https://media.example/one',position:40,updatedAt:1000,serverTime:1200,playing:true,...patch});
test('Zwei Mithörer folgen unabhängig von ihrer Uhrzeit derselben Hostposition, Pause und Titelwechsel',async()=>{
 let nowA=1000000,nowB=50;const a=new Audio(),b=new Audio(),sa=new SynchronizedPlayback(a,{now:()=>nowA}),sb=new SynchronizedPlayback(b,{now:()=>nowB});
 await sa.accept(room(),200);await sb.accept(room({serverTime:1300}),400);assert.equal(a.plays,0);assert.equal(b.plays,0);await sa.start();await sb.start();assert.equal(a.currentTime,40.3);assert.equal(b.currentTime,40.5);
 nowA+=200;nowB+=0;assert.ok(Math.abs(sa.target()-sb.target())<.001);
 // Small drift is corrected without audible jumps, larger drift is seeked.
 a.currentTime=sa.target()-.25;await sa.tick();assert.ok(a.playbackRate>1&&a.playbackRate<=1.03);assert.equal(a.currentTime,40.25);
 b.currentTime=10;await sb.tick();assert.equal(b.currentTime,sb.target());assert.equal(b.playbackRate,1);
 await sa.accept(room({playing:false,position:75}),1000);await sb.accept(room({playing:false,position:75}),5);assert.equal(a.currentTime,75);assert.equal(b.currentTime,75);assert.ok(a.paused&&b.paused);
 await sa.accept(room({track:{id:'song-two',duration:300},mediaUrl:'https://media.example/two',position:0}),200);nowA+=1400;a.dispatchEvent(new Event('loadedmetadata'));await new Promise(resolve=>setImmediate(resolve));assert.equal(a.src,'https://media.example/two');assert.ok(Math.abs(a.currentTime-1.7)<.001);
 sa.destroy();sb.destroy();
});
test('Ausgeschalteter Ton, Autoplay-Sperre, Verbindungsverlust und erneuerte Dateilinks bleiben steuerbar',async()=>{
 let now=0,blocked=0;const a=new Audio();a.play=async()=>{throw Object.assign(new Error('Gesture required'),{name:'NotAllowedError'});};const s=new SynchronizedPlayback(a,{now:()=>now,onBlocked:()=>blocked++});await s.accept(room());await s.start();await s.tick();assert.equal(blocked,1);
 a.play=async()=>{a.paused=false;};await s.start();assert.equal(a.paused,false);s.stop();await s.accept(room({position:80}));assert.equal(a.paused,true);await s.start();now=26000;await s.tick();assert.equal(a.paused,true);
 now=27000;await s.accept(room({position:100,mediaUrl:'https://media.example/new-signature'}));assert.equal(a.paused,false);a.dispatchEvent(new Event('error'));await s.accept(room({position:101,mediaUrl:'https://media.example/retry'}));assert.equal(a.src,'https://media.example/retry');assert.ok(a.currentTime>=101);s.destroy();
});
test('Gleichzeitiges Öffnen erzeugt nur einen Poll und verspätete Antworten können eine verlassene Session nicht neu starten',async()=>{
 let resolve,reads=0,remote=0;const pending=new Promise(r=>resolve=r),team={active:true,api:async()=>{reads++;return pending;}};const session=new ListeningSession({team,getPlayer:()=>({}),onRemote:()=>remote++});const first=session.join('a'.repeat(64)),second=session.join('a'.repeat(64));await new Promise(r=>setImmediate(r));assert.equal(reads,1);await session.leave();resolve(room());await Promise.all([first,second]);assert.equal(remote,0);assert.equal(session.followRoom,null);assert.equal(session.timer,null);
});
test('Ein laufender Host-Start wird beim Verlassen gelöscht und private Songs benötigen eine vorbereitete Mithörfreigabe',async()=>{
 let resolve,posts=0,deletes=0;const pending=new Promise(r=>resolve=r),team={active:true,api:async(_path,method)=>{if(method==='POST'){posts++;return pending;}if(method==='DELETE')deletes++;}};const session=new ListeningSession({team,getPlayer:()=>({trackId:'band-song',position:10,playing:true}),onRemote:()=>{}});const first=session.host(),second=session.host();await new Promise(r=>setImmediate(r));assert.equal(posts,1);await session.leave();resolve({id:'a'.repeat(64),url:'https://band.example/?room='+'a'.repeat(64)});await Promise.all([first,second]);assert.equal(session.hostRoom,null);assert.equal(deletes,1);
 const privateSession=new ListeningSession({team,getPlayer:()=>({trackId:'local-song',private:true,position:0,playing:true}),onRemote:()=>{}});await assert.rejects(privateSession.host(),/Mithörfreigabe/);assert.equal(posts,1);
});
test('Studio-Protokoll akzeptiert ausschließlich gültige Hörsession-IDs',()=>{
 const id='a1'.repeat(32),link='neontrinity://listen/'+id;assert.equal(listeningRoomFromURL(link),id);assert.equal(roomFromArguments(['app.exe','--unrelated',link]),id);
 for(const bad of ['https://listen/'+id,'neontrinity://listen/'+id+'?command=run','neontrinity://evil/'+id,'neontrinity://user@listen/'+id,'neontrinity://listen/'+id+'/file','neontrinity://listen/short','neontrinity://listen/'+id+'#bad'])assert.equal(listeningRoomFromURL(bad),null);
});
