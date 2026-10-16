import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
test('Der öffentliche Player zeigt nur Release-Daten, escaped Metadaten und spielt die Titelliste ab',async()=>{
 const html=await readFile(new URL('../app/album.html',import.meta.url),'utf8'),{window,document}=parseHTML(html);
 globalThis.window=window;globalThis.document=document;globalThis.location=new URL('https://band.example/album.html?id=release');
 const tracks=[{id:'one',blobId:'file-one',title:'<script>unsafe()</script>',artist:'Dex & Nix',duration:120},{id:'two',blobId:'file-two',title:'Second Song',artist:'Jax',duration:90}];
 globalThis.fetch=async()=>new Response(JSON.stringify({album:{id:'release',title:'Neon <Release>',description:'<img onerror=unsafe()>',year:2026,trackIds:['one','two']},tracks,assets:[{id:'file-one',path:'media/one.mp3'},{id:'file-two',path:'media/two.mp3'}],theme:'trinity',urls:{'media/one.mp3':'https://media.example/one.mp3','media/two.mp3':'https://media.example/two.mp3'}}),{headers:{'Content-Type':'application/json'}});
 const audio=document.querySelector('audio');audio.play=async()=>{};audio.pause=()=>{};
 await import('../app/album.mjs');
 assert.equal(document.querySelector('h1').textContent,'Neon <Release>');assert.equal(document.querySelector('main script'),null);assert.equal(document.querySelector('main img[onerror]'),null);assert.equal(document.querySelectorAll('tbody tr').length,2);
 await document.querySelector('#play-album').onclick();assert.equal(audio.src,'https://media.example/one.mp3');assert.equal(document.querySelector('#playing-title').textContent,tracks[0].title);
 audio.dispatchEvent(new window.Event('ended'));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(audio.src,'https://media.example/two.mp3');
 assert.ok(!document.querySelector('main').textContent.includes('Auftritte'));
});
