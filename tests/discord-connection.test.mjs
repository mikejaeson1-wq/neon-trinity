import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {DiscordPresence,frame,activityFor,LOGO_URL} from '../desktop/discord.cjs';
class Socket extends EventEmitter{constructor(){super();this.writes=[];this.destroyed=false;}write(bytes){this.writes.push({op:bytes.readUInt32LE(0),data:JSON.parse(bytes.subarray(8).toString())});}destroy(){if(this.destroyed)return;this.destroyed=true;this.emit('close');}}
const dex='229262929491394560',nix='402230022141902848',app='1560691884064514161';
function fixture(options={}){const sockets=[],messages=[];const p=new DiscordPresence(message=>messages.push(message),{connect:()=>{const socket=new Socket();sockets.push(socket);queueMicrotask(()=>socket.emit('connect'));return socket;},...options});return {p,sockets,messages};}
const ready=(socket,user=dex)=>socket.emit('data',frame(1,{evt:'READY',data:{user:{id:user}}}));
test('Discord bestätigt vollständige Aktivität mit Bandlogo; Kontoabweichungen werden erkannt',async()=>{
 const {p,sockets}=fixture();p.configure(app,nix);await delay(1);const socket=sockets[0];assert.equal(socket.writes[0].data.client_id,app);const bytes=frame(1,{evt:'READY',data:{user:{id:dex}}});socket.emit('data',bytes.subarray(0,5));assert.equal(p.ready,false);socket.emit('data',bytes.subarray(5));assert.equal(p.ready,true);assert.equal(p.diagnostics().accountMatches,false);assert.match(p.message,/anderen Konto/);
 const command=socket.writes.at(-1).data;assert.equal(command.args.activity.assets.large_image,LOGO_URL);socket.emit('data',frame(1,{cmd:'SET_ACTIVITY',nonce:command.nonce,data:{}}));assert.ok(p.diagnostics().lastAcceptedAt);p.configure(app,dex);assert.equal(p.diagnostics().accountMatches,true);
 socket.emit('data',frame(3,{ping:1}));assert.equal(socket.writes.at(-1).op,4);p.close();
});
test('Eine fehlende READY-Antwort läuft aus; manueller Neuverbinden-Knopf funktioniert auch mit derselben App-ID',async()=>{
 const {p,sockets}=fixture({handshakeTimeout:12,retryDelay:10000});p.configure(app,nix);await delay(30);assert.equal(p.socket,null);assert.equal(p.connecting,false);assert.match(p.diagnostics().lastError,/antwortet nicht/);p.reconnect(app,nix);await delay(1);assert.equal(sockets.length,2);ready(sockets[1],nix);assert.equal(p.ready,true);assert.equal(p.diagnostics().accountMatches,true);p.close();
});
test('Alte Socket-Ereignisse überschreiben keine neue Verbindung; private Musik wird sofort entfernt',async()=>{
 const {p,sockets}=fixture();p.configure(app,dex);await delay(1);ready(sockets[0]);p.reconnect(app,nix);await delay(1);const current=sockets[1];ready(current,nix);sockets[0].emit('data',frame(1,{evt:'READY',data:{user:{id:dex}}}));sockets[0].emit('close');assert.equal(p.socket,current);assert.equal(p.diagnostics().discordUserId,nix);
 p.update({title:'Private song',private:true});assert.equal(current.writes.at(-1).data.args.activity,null);assert.match(p.connectionMessage(),/ausgeblendet/);p.update({title:'Public song',artist:'Neon Trinity',private:false});assert.equal(current.writes.at(-1).data.args.activity.details,'Public song');p.close();assert.equal(current.writes.at(-1).data.args.activity,null);
});
test('Neukonfiguration während der Pipe-Suche verwirft verspätete Verbindungen',async()=>{
 const sockets=[];const p=new DiscordPresence(()=>{},{connect:()=>{const s=new Socket();sockets.push(s);return s;},pipeTimeout:500});p.configure(app,dex);p.reconnect(app,nix);sockets[1].emit('connect');await delay(1);ready(sockets[1],nix);sockets[0].emit('connect');await delay(1);assert.equal(sockets[0].destroyed,true);assert.equal(p.socket,sockets[1]);assert.equal(p.connecting,false);p.close();
});
test('Discord-Logo wird auch im Leerlauf angezeigt; private Quellen enthalten keine Aktivität',()=>{assert.equal(activityFor({}).assets.large_image,LOGO_URL);assert.equal(activityFor({title:'Secret',private:true}),null);assert.equal(activityFor({title:'Song',roomUrl:'javascript:alert(1)'}).buttons,undefined);});
