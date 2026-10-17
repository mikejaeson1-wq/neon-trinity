import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
test('Gäste können ohne Konto im Browser mithören oder den sicheren Studio-Link wählen',async()=>{
 const {window,document}=parseHTML(await readFile(new URL('../app/album.html',import.meta.url),'utf8'));globalThis.window=window;globalThis.document=document;globalThis.location=new URL('https://band.example/album.html?room='+'a'.repeat(64));let playing=true;
 globalThis.fetch=async()=>new Response(JSON.stringify({id:'a'.repeat(64),host:'Dex',track:{id:'band-song',title:'Shared Song',artist:'Neon Trinity',duration:180},position:15,playing,serverTime:5000,updatedAt:4900,mediaUrl:'https://media.example/song'}));
 const audio=document.querySelector('audio');audio.paused=true;audio.play=async()=>{audio.paused=false;};audio.pause=()=>{audio.paused=true;};await import('../app/album.mjs');assert.equal(audio.paused,true);assert.match(document.querySelector('#listen-title').textContent,/Shared Song/);assert.equal(document.querySelector('#open-studio').getAttribute('href'),'neontrinity://listen/'+'a'.repeat(64));
 await document.querySelector('#join-listening').onclick();assert.equal(audio.paused,false);assert.ok(audio.currentTime>=15.1);document.querySelector('#open-studio').onclick();assert.equal(audio.paused,true);await document.querySelector('#join-listening').onclick();assert.equal(audio.paused,false);document.querySelector('#pause-listening').onclick();assert.equal(audio.paused,true);assert.equal(document.querySelector('input[type=password]'),null);
});
