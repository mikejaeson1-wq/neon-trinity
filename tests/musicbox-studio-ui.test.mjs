import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import 'fake-indexeddb/auto';
import {TeamClient} from '../app/team.mjs';
import {MusicboxLinks} from '../app/musicbox-links.mjs';
import {emptyCatalog,snapshot} from '../app/shared.mjs';
import {SupabaseBackend} from '../app/cloud.mjs';
const {window,document}=parseHTML(await readFile(new URL('../app/index.html',import.meta.url),'utf8'));globalThis.window=window;globalThis.document=document;globalThis.location={hash:'#library',protocol:'http:'};globalThis.BroadcastChannel=undefined;window.scrollTo=()=>{};
const copied=[],created=[];Object.defineProperty(globalThis,'navigator',{value:{storage:{estimate:async()=>({usage:0})},clipboard:{writeText:async url=>copied.push(url)}},configurable:true});
const nativeTimeout=globalThis.setTimeout;globalThis.setTimeout=(...args)=>{const t=nativeTimeout(...args);t.unref?.();return t;};
const audio=document.querySelector('audio');audio.pause=()=>audio.paused=true;const dialog=document.querySelector('dialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new window.Event('close'));};
TeamClient.prototype.detect=async function(){this.user={id:'dex',alias:'Dex',allowed:true};this.baseline=emptyCatalog();const state=this.getState();state.tracks=[{id:'song',title:'Band Song',blobId:'mp3',duration:90,artist:'Neon Trinity'}];state.albums=[{id:'existing',title:'Earlier Album',trackIds:['song']},{id:'album',title:'Band Album',trackIds:['song']}];state.published={existing:{at:new Date().toISOString()}};state.localTracks=[{id:'local',title:'Private Song',blobId:'local-mp3',ownerId:'dex',visibility:'local',duration:90}];return true;};
MusicboxLinks.prototype.create=async function(kind,id){created.push([kind,id]);return {kind,title:kind==='track'?'Band Song':'Band Album',trackCount:1,url:'https://xyhkpwhfgjamssojjzbu.supabase.co/storage/v1/object/public/nt-musicbox/audio/11111111-1111-4111-8111-111111111111.mp3'};};
const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(resolve=>nativeTimeout(resolve,5));}throw Error('Musicbox UI timed out');};const navigate=view=>{location.hash='#'+view;window.dispatchEvent(new window.Event('hashchange'));};
test('Studio-Rechtsklick kopiert Song- und Album-MP3-URLs und bietet für private lokale Songs keine öffentliche Musikbox-Freigabe an',async()=>{await import('../app/app.mjs');await until(()=>document.querySelector('[data-musicbox-id="song"]'));const open=target=>target.dispatchEvent(new window.Event('contextmenu',{bubbles:true,cancelable:true}));open(document.querySelector('[data-musicbox-id="song"]'));document.querySelector('#copy-musicbox').onclick();await until(()=>document.querySelector('#musicbox-url'));assert.deepEqual(created,[['track','song']]);assert.equal(copied.length,1);assert.match(document.querySelector('#musicbox-url').value,/\.mp3$/);document.querySelector('#musicbox-done').onclick();navigate('albums');open(document.querySelector('[data-musicbox-id="album"]'));document.querySelector('#copy-musicbox').onclick();await until(()=>created.length===2&&document.querySelector('#musicbox-url'));assert.deepEqual(created[1],['album','album']);document.querySelector('#musicbox-done').onclick();navigate('local');open(document.querySelector('[data-musicbox-id="local"]'));assert.equal(document.querySelector('#copy-musicbox').disabled,true);assert.match(document.querySelector('#musicbox-menu').textContent,/Musikbox-Links benötigen eine Bandkopie/);});

test('Studio-Rechtsklick kopiert eine einzelne Song-HTML-Seite und nach Zustimmung exakt das gewählte Album statt des ersten Releases',async()=>{
 const published=[];SupabaseBackend.prototype.publicSong=async id=>({id});TeamClient.prototype.push=async()=>{};
 TeamClient.prototype.api=async function(path,method,data){assert.equal(path,'/api/publish');published.push(data);const catalog=snapshot(this.getState());catalog.publications=data.albumIds.map(id=>({id,at:new Date().toISOString()}));return {catalog,url:'https://band.example/album.html?id=existing'};};
 const open=target=>target.dispatchEvent(new window.Event('contextmenu',{bubbles:true,cancelable:true}));
 navigate('library');open(document.querySelector('[data-musicbox-id="song"]'));document.querySelector('#copy-public-link').onclick();await until(()=>copied.some(url=>url.includes('/song.html?id=song')));
 navigate('albums');open(document.querySelector('[data-musicbox-id="album"]'));document.querySelector('#copy-public-link').onclick();assert.equal(document.querySelector('#publish-now').disabled,true);
 const consent=document.querySelector('#publish-consent');consent.checked=true;consent.onchange({target:consent});await document.querySelector('#publish-now').onclick();
 assert.deepEqual(published[0].albumIds,['existing','album']);assert.equal(published[0].targetId,'album');assert.match(copied.at(-1),/album.html\?id=album$/);assert.match(document.querySelector('.public-link').href,/album.html\?id=album$/);
 document.querySelector('#publish-done').onclick();navigate('local');open(document.querySelector('[data-musicbox-id="local"]'));assert.equal(document.querySelector('#copy-public-link').disabled,true);
});
