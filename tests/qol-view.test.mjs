import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {StudioQoL} from '../app/qol-view.mjs';
import {newState} from '../app/core.mjs';
import {STUDIO_VERSION} from '../app/version.mjs';
const {window,document}=parseHTML(await readFile(new URL('../app/index.html',import.meta.url),'utf8'));globalThis.window=window;globalThis.document=document;window.scrollTo=()=>{};
let owner={id:'dex'},context='song-a';const state=newState();
const q=new StudioQoL({getState:()=>state,getOwner:()=>owner,restorePreferences(){},getTrack:()=>null,tracks:()=>[],player:()=>({source:'studio',title:'',paused:true}),getQueue:()=>({queue:[]}),persist:async()=>{},formContexts:()=>({work:context}),render(){},toast(){},fail:e=>{throw e;}});q.sync();q.settings().seenVersion=STUDIO_VERSION;
const form=(text='')=>'<h1>Werkstatt</h1><form data-plus-form="work"><textarea name="notes">'+text+'</textarea></form>';
test('Formularentwürfe bleiben dem jeweiligen Song zugeordnet und erhalten sich beim Wechsel zurück',()=>{
 document.querySelector('#main').innerHTML=form();q.afterRender('studio/work');document.querySelector('[name=notes]').value='Unsaved notes for A';q.captureView();
 context='song-b';document.querySelector('#main').innerHTML=form('Saved notes for B');q.afterRender('studio/work');assert.equal(document.querySelector('[name=notes]').value,'Saved notes for B');document.querySelector('[name=notes]').value='Unsaved notes for B';q.captureView();
 context='song-a';document.querySelector('#main').innerHTML=form();q.afterRender('studio/work');assert.equal(document.querySelector('[name=notes]').value,'Unsaved notes for A');
});
test('Mehrere gleich benannte Checkboxen behalten unabhängig ihre Auswahl',()=>{
 document.querySelector('#main').innerHTML='<h1>Profil</h1><form id="extras"><input type="checkbox" name="pinned" value="a"><input type="checkbox" name="pinned" value="b"></form>';q.afterRender('profiles');const inputs=[...document.querySelectorAll('[name=pinned]')];inputs[0].checked=true;inputs[1].checked=false;q.captureView();document.querySelector('#main').innerHTML='<h1>Profil</h1><form id="extras"><input type="checkbox" name="pinned" value="a"><input type="checkbox" name="pinned" value="b"></form>';q.afterRender('profiles');assert.equal(document.querySelectorAll('[name=pinned]')[0].checked,true);assert.equal(document.querySelectorAll('[name=pinned]')[1].checked,false);
});
test('Neue globale Suchbegriffe werden nicht durch einen früheren Suchentwurf überschrieben',()=>{
 q.settings().views.search={search:'Old search'};document.querySelector('#global-search').value='New search';document.querySelector('#main').innerHTML='<h1>Suche</h1>';q.afterRender('search');assert.equal(document.querySelector('#global-search').value,'New search');
});
test('Kontowechsel übernimmt keine Entwürfe des vorherigen Kontos',()=>{
 q.captureView();owner={id:'nix'};q.sync();q.settings().seenVersion=STUDIO_VERSION;context='song-a';document.querySelector('#main').innerHTML=form('Own saved notes');q.afterRender('studio/work');assert.equal(document.querySelector('[name=notes]').value,'Own saved notes');assert.equal(q.sleep.active,false);
});
