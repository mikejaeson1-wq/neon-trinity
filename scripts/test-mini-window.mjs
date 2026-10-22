import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true')throw new Error('Dieser native Fenstertest läuft nur im Windows-Build.');
const exe=process.argv[2];if(!exe)throw new Error('Der Pfad zur installierten App fehlt.');
const port=19543,base='http://127.0.0.1:'+port;
const processApp=spawn(exe,['--remote-debugging-port='+port],{stdio:'ignore'});
let sockets=[];
async function pages(){return (await fetch(base+'/json/list')).json();}
async function until(fn,description){for(let i=0;i<150;i++){if(processApp.exitCode!=null)throw new Error('Studio wurde unerwartet beendet.');try{const result=await fn();if(result)return result;}catch{}await delay(200);}throw new Error('Zeitüberschreitung: '+description);}
async function connect(page){const ws=new WebSocket(page.webSocketDebuggerUrl);sockets.push(ws);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});let id=0;const pending=new Map();ws.addEventListener('close',()=>{for(const p of pending.values())p.reject(new Error('Testfenster geschlossen.'));pending.clear();});ws.addEventListener('message',event=>{const r=JSON.parse(event.data),p=pending.get(r.id);if(p){pending.delete(r.id);r.error?p.reject(new Error(r.error.message)):p.resolve(r.result);}});return {async evaluate(expression){const key=++id;let timer;try{const result=await new Promise((resolve,reject)=>{timer=setTimeout(()=>{pending.delete(key);reject(new Error('CDP-Testantwort fehlt.'));},10000);pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text+': '+JSON.stringify(result.exceptionDetails.exception));return result.result.value;}finally{clearTimeout(timer);}}};}
try{
 const mainPage=await until(async()=>(await pages()).find(p=>p.url==='ntapp://studio/index.html'),'Studio-Seite');
 const main=await connect(mainPage);await until(()=>main.evaluate("!!document.querySelector('#main h1')"),'Studio-Oberfläche');
 await main.evaluate('neonDesktop.openMini()');const miniPage=await until(async()=>(await pages()).find(p=>p.url==='ntapp://studio/mini.html'),'Miniplayer');
 const mini=await connect(miniPage);await until(()=>mini.evaluate("!!document.querySelector('#title')"),'Miniplayer-Oberfläche');
 const expected=await main.evaluate('neonDesktop.miniBounds({width:760,height:610})');assert.equal(expected.width,760);assert.equal(expected.height,610);
 await main.evaluate("neonDesktop.updatePlayer({title:'Native QoL Test',artist:'Neon Trinity',source:'studio',paused:false,position:12,duration:100,volume:.7,repeat:'track',appearance:{skin:'classic',playlistOpen:true},queue:[{id:'one',title:'Song One',artist:'Dex',duration:100,active:true}]})");
 await until(()=>mini.evaluate("document.querySelector('#title').textContent==='Native QoL Test'"),'Player-Update');
 assert.equal(await mini.evaluate("document.querySelector('#repeat').textContent"),'REP1');
 const after=await main.evaluate('neonDesktop.miniBounds()');assert.deepEqual(after,expected,'Player-Updates dürfen die frei gewählte Größe nicht überschreiben.');
 const layout=await mini.evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth,playlist:document.querySelector('#mini-playlist').getBoundingClientRect().height})");assert.ok(layout.scroll<=layout.width+2,'Miniplayer verursacht horizontalen Überlauf.');assert.ok(layout.playlist>=150);
 await mini.evaluate('neonDesktop.miniPin(false)');await mini.evaluate('neonDesktop.closeMini()').catch(()=>{});await delay(300);await main.evaluate('neonDesktop.openMini()');
 const restored=await main.evaluate('neonDesktop.miniBounds()');assert.deepEqual(restored,expected);assert.equal((await main.evaluate('neonDesktop.miniPreferences()')).alwaysOnTop,false);
 await main.evaluate('neonDesktop.closeMini()');
 for(const expected of ['Ganze Playlist wiederholen','Einzelnen Song wiederholen','Wiederholung aus']){await main.evaluate("document.querySelector('#repeat').click()");await until(()=>main.evaluate("document.querySelector('#repeat').getAttribute('aria-label')==="+JSON.stringify(expected)),'Repeat-Stufe '+expected);}
 console.log('Installierte App: native Fenstergröße, Position, Playlist-Layout, Vordergrund-Einstellung und drei Repeat-Stufen bestätigt.');
}finally{for(const ws of sockets)ws.close();processApp.kill();await delay(300);}
