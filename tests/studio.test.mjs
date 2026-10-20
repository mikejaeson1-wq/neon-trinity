import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import 'fake-indexeddb/auto';
const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8');
const {window,document}=parseHTML(html);
globalThis.window=window;globalThis.document=document;
// The virtual DOM has no browser tabs to communicate with.
globalThis.BroadcastChannel=undefined;
globalThis.location={hash:'#overview',protocol:'http:'};window.scrollTo=()=>{};
Object.defineProperty(globalThis,'navigator',{value:{storage:{estimate:async()=>({usage:0}),persist:async()=>true}},configurable:true});
const originalTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn,delay,...args)=>{const timer=originalTimeout(fn,delay,...args);timer.unref?.();return timer;};
const audio=document.querySelector('#audio');audio.pause=()=>{audio.paused=true;};audio.play=async()=>{audio.paused=false;};audio.load=()=>{};
globalThis.Audio=class{duration=180;removeAttribute(){}load(){}set src(value){queueMicrotask(()=>this.onloadedmetadata?.());}};
globalThis.MediaMetadata=class{constructor(data){Object.assign(this,data);}};
const dialog=document.querySelector('dialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;
globalThis.FormData=class{constructor(form){this.values=[...form.querySelectorAll('input[name],textarea[name],select[name]')].filter(el=>!['checkbox','radio'].includes(el.type)||el.checked).map(el=>[el.name,el.type==='file'?el.files?.[0]||new File([],''):el.value]);}get(key){return this.values.find(([k])=>k===key)?.[1]??null;}has(key){return this.values.some(([k])=>k===key);}entries(){return this.values[Symbol.iterator]();}[Symbol.iterator](){return this.entries();}};
await import('../app/app.mjs');
const {loadState}=await import('../app/db.mjs');
const navigate=route=>{location.hash='#'+route;window.dispatchEvent(new window.Event('hashchange'));};
const click=selector=>{const element=document.querySelector(selector);assert.ok(element,selector);element.dispatchEvent(new window.Event('click',{bubbles:true}));};
const waitFor=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(resolve=>originalTimeout(resolve,5));}throw new Error('UI operation timed out');};
test('Studio bedient Import, Playlist, Album, Auftritt und Theme über echte Formularhandler',async()=>{
  assert.match(document.querySelector('main').textContent,/Drei Stimmen/);
  const file=new File(['ID3\0\0test-audio'],'Night Drive.mp3',{type:'audio/mpeg'});
  await document.querySelector('#audio-files').onchange({target:{files:[file]}});
  let state=await loadState();assert.equal(state.tracks.length,1);assert.equal(state.tracks[0].title,'Night Drive');assert.equal(state.tracks[0].duration,180);
  // Importing the same bytes twice keeps a single copy.
  await document.querySelector('#audio-files').onchange({target:{files:[file]}});
  assert.equal((await loadState()).tracks.length,1);
  navigate('playlists');click('[data-action="new-playlist"]');
  document.querySelector('#group-form input[name=title]').value='Estelglin Live';
  const checkbox=document.querySelector('#song-selection input');checkbox.checked=true;
  document.querySelector('#song-selection').onchange({target:checkbox});
  await document.querySelector('#group-form').onsubmit({preventDefault(){},target:document.querySelector('#group-form')});
  state=await loadState();assert.equal(state.playlists[0].title,'Estelglin Live');assert.deepEqual(state.playlists[0].trackIds,[state.tracks[0].id]);
  navigate('albums');click('[data-action="new-album"]');
  document.querySelector('#group-form input[name=title]').value='Neon Nights';
  const song=document.querySelector('#song-selection input');song.checked=true;document.querySelector('#song-selection').onchange({target:song});
  await document.querySelector('#group-form').onsubmit({preventDefault(){},target:document.querySelector('#group-form')});
  state=await loadState();assert.equal(state.albums[0].title,'Neon Nights');assert.equal(state.albums[0].trackIds.length,1);
  navigate('events');click('[data-action="new-event"]');
  const form=document.querySelector('#event-form');form.querySelector('[name=title]').value='Live in Estelglin';form.querySelector('[name=date]').value='2026-11-01T20:00';form.querySelector('[name=location]').value='Main Stage';
  const select=form.querySelector('[name=playlistId]');select.querySelectorAll('option').forEach(o=>o.removeAttribute('selected'));select.querySelectorAll('option')[1].setAttribute('selected','');
  await form.onsubmit({preventDefault(){},target:form});
  state=await loadState();assert.equal(state.events[0].title,'Live in Estelglin');assert.equal(state.events[0].playlistId,state.playlists[0].id);
  navigate('settings');click('[data-action="theme"][data-theme="hextech"]');await waitFor(()=>document.documentElement.dataset.theme==='hextech');assert.equal((await loadState()).theme,'hextech');
  assert.match(document.querySelector('main').textContent,/Supabase/);
});

test('Studio 1.0 bietet Werkzeuge an und behält gelöschte MP3s für die gezielte Wiederherstellung',async()=>{
 navigate('studio/history');assert.match(document.querySelector('main').textContent,/Rückgängig & Papierkorb/);assert.ok(document.querySelector('[data-plus="history-restore"]'));
 const state=await loadState(),track=state.tracks[0];navigate('library');click('[data-action="edit-track"][data-id="'+track.id+'"]');document.querySelector('#delete-track').onclick();document.querySelector('#confirm-action').onclick();await waitFor(()=>!document.querySelector('#modal').open);
 assert.equal((await loadState()).tracks.length,0);const {getBlob}=await import('../app/db.mjs');assert.ok(await getBlob(track.blobId),'Das Original bleibt für den Papierkorb erhalten');
 navigate('studio/history');click('[data-plus="history-restore"]');await waitFor(()=>document.querySelector('main').textContent.includes('Änderung zurückgenommen'));assert.equal((await loadState()).tracks[0].id,track.id);
 for(const tab of ['queue','backup','audio','design','rooms','status']){navigate('studio/'+tab);assert.ok(document.querySelector('.plus-tabs'),'Navigation bleibt erreichbar: '+tab);assert.ok(document.querySelector('main').textContent.length>100);}
 navigate('studio/design');assert.ok(document.querySelector('[data-plus="skin-classic"]'));assert.equal(document.querySelectorAll('[name^="mode"]').length,4);
 navigate('live');assert.match(document.querySelector('main').textContent,/Bereit für die Bühne/);assert.ok(document.querySelector('[data-plus="live-lock"]'));
});

test('Eigener Skin und Visualizer-Szene werden über die neuen Formulare gespeichert; Classic bleibt erreichbar',async()=>{
 navigate('studio/design');const form=document.querySelector('[data-plus-form=skin]');form.querySelector('[name=name]').value='Dex Terminal';form.querySelector('[name=accent]').value='#ee44ff';await form.onsubmit({preventDefault(){}});
 let state=await loadState(),own=state.studioOwners['local-device'];assert.equal(own.skins[0].name,'Dex Terminal');assert.equal(own.skins[0].accent,'#ee44ff');assert.equal(state.appearance.player.skin,'custom');
 const scene=document.querySelector('[data-plus-form=scene]');scene.querySelector('[name=name]').value='Neon Pulse';await scene.onsubmit({preventDefault(){}});state=await loadState();assert.equal(state.studioOwners['local-device'].scenes[0].name,'Neon Pulse');
 click('[data-plus="skin-classic"]');await waitFor(()=>document.querySelector('.player').dataset.skin==='classic');assert.equal((await loadState()).appearance.player.skin,'classic');
});
