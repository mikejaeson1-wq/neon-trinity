import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {PublicSongLinks} from '../app/public-links-view.mjs';

function fixture({published=false,clipboardFails=false}={}){
 const {document}=parseHTML('<html><body><dialog id="modal"><div id="content"></div></dialog></body></html>'),calls=[],links=[],messages=[];
 const team={user:{id:'dex'},backend:{publicSong:async()=>published?{id:'song'}:null,publishSong:async(...args)=>calls.push(['publish',...args]),withdrawPublicSong:async id=>calls.push(['withdraw',id])}};
 const state={tracks:[{id:'song',title:'Dex <Song>'}],theme:'trinity',settings:{backend:'supabase',publicBase:'https://band.example'}};
 const view=new PublicSongLinks({document,team,getState:()=>state,sync:async()=>calls.push(['sync']),modal:html=>document.querySelector('#content').innerHTML=html,closeModal:()=>document.querySelector('#content').innerHTML='',toast:message=>messages.push(message),fail:()=>{},clipboard:{writeText:async url=>{if(clipboardFails)throw new Error('denied');links.push(url);}}});
 return {document,team,state,view,calls,links,messages};
}
test('Erstfreigabe verlangt Zustimmung, synchronisiert nur nach Bestätigung und kopiert die HTML-Songseite',async()=>{
 const f=fixture();await f.view.open('song');const publish=f.document.querySelector('#public-song-publish'),consent=f.document.querySelector('#public-song-consent');
 assert.equal(publish.disabled,true);await publish.onclick();assert.deepEqual(f.calls,[]);assert.equal(f.document.querySelector('h2').textContent,'Song öffentlich teilen?');
 consent.checked=true;consent.onchange();await publish.onclick();
 assert.deepEqual(f.calls,[['sync'],['publish','song','trinity','dex']]);assert.deepEqual(f.links,['https://band.example/song.html?id=song']);assert.equal(f.document.querySelector('#public-hear-url').value,f.links[0]);
});
test('Bestehender Hörlink wird direkt kopiert; Zwischenablagefehler liefern ein markierbares Textfeld',async()=>{
 const f=fixture({published:true});await f.view.open('song');assert.equal(f.links[0],'https://band.example/song.html?id=song');assert.deepEqual(f.calls,[]);assert.equal(f.document.querySelector('#public-song-consent'),null);
 const g=fixture({published:true,clipboardFails:true});await g.view.open('song');assert.equal(g.document.querySelector('#public-hear-url').value,'https://band.example/song.html?id=song');assert.equal(g.document.querySelector('#content script'),null);
});
test('Private Songs und Kontowechsel können keine öffentliche Songfreigabe auslösen',async()=>{
 const f=fixture();await assert.rejects(f.view.open('private'),/Band-Songs/);assert.deepEqual(f.calls,[]);
 await f.view.open('song');f.team.user={id:'nix'};const consent=f.document.querySelector('#public-song-consent');consent.checked=true;consent.onchange();await f.document.querySelector('#public-song-publish').onclick();assert.deepEqual(f.calls,[]);assert.match(f.document.querySelector('#public-song-progress').textContent,/Konto wurde gewechselt/);
});
test('Zurückziehen entfernt die einzelne Freigabe ohne Synchronisation oder Medienlöschung',async()=>{
 const f=fixture({published:true});await f.view.open('song',{manage:true});await f.document.querySelector('#public-song-withdraw').onclick();assert.deepEqual(f.calls,[['withdraw','song']]);
});
test('Öffentliche Songseite spielt genau den ausgewählten Song ohne Anmeldung und escaped Texte',async()=>{
 const html=await readFile(new URL('../app/song.html',import.meta.url),'utf8'),{window,document}=parseHTML(html),requests=[];
 globalThis.window=window;globalThis.document=document;globalThis.location=new URL('https://band.example/song.html?id=one');
 globalThis.fetch=async(input,options)=>{requests.push({url:String(input),headers:options.headers});return new Response(JSON.stringify({track:{id:'one',blobId:'mp3',title:'<script>unsafe()</script>',artist:'Dex & Nix',duration:120},assets:[{id:'mp3',path:'media/one.mp3'}],work:{lyrics:'<img onerror=unsafe()>',credits:'Dex'},theme:'trinity',urls:{'media/one.mp3':'https://media.example/one.mp3'}}),{headers:{'Content-Type':'application/json'}});};
 const audio=document.querySelector('audio');let plays=0;audio.play=async()=>{plays++;};audio.pause=()=>{};
 await import('../app/song.mjs');assert.equal(document.querySelector('h1').textContent,'<script>unsafe()</script>');assert.equal(document.querySelector('main script'),null);assert.equal(document.querySelector('main img[onerror]'),null);
 assert.equal(requests.length,1);assert.match(requests[0].url,/\/song\/one$/);assert.equal(requests[0].headers.Authorization,undefined);assert.equal(plays,0);
 await document.querySelector('#play-song').onclick();assert.equal(audio.src,'https://media.example/one.mp3');assert.equal(plays,1);audio.dispatchEvent(new window.Event('ended'));assert.equal(plays,1);
});
