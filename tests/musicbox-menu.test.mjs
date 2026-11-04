import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {installMusicboxMenu} from '../app/musicbox-menu.mjs';
test('Rechtsklick bietet Song- und Album-Links, sperrt private Musik und lässt Texteingaben unverändert',()=>{const {document,window}=parseHTML('<html><body><article data-musicbox-kind="album" data-musicbox-id="album"><span id="album-name">Album</span><input></article><div data-musicbox-kind="track" data-musicbox-id="song">Song</div><div data-musicbox-kind="track" data-musicbox-id="private">Private</div></body></html>');const copied=[],removed=[];const cleanup=installMusicboxMenu({document,resolve:(kind,id)=>({kind,id,title:'<script>Title</script>',available:id!=='private',reason:'Nur auf diesem Gerät'}),onCopy:(...input)=>copied.push(input),onRemove:(...input)=>removed.push(input)});const click=element=>{const event=new window.Event('contextmenu',{bubbles:true,cancelable:true});element.dispatchEvent(event);return event;};let event=click(document.querySelector('#album-name'));assert.equal(event.defaultPrevented,true);assert.equal(document.querySelector('#musicbox-menu script'),null);document.querySelector('#copy-musicbox').onclick();assert.deepEqual(copied,[['album','album']]);click(document.querySelector('[data-musicbox-id="song"]'));document.querySelector('#remove-musicbox').onclick();assert.deepEqual(removed,[['track','song']]);click(document.querySelector('[data-musicbox-id="private"]'));assert.equal(document.querySelector('#copy-musicbox').disabled,true);assert.match(document.querySelector('#musicbox-menu').textContent,/Nur auf diesem Gerät/);event=click(document.querySelector('input'));assert.equal(event.defaultPrevented,false);cleanup();assert.equal(document.querySelector('#musicbox-menu'),null);});

test('Rechtsklick bietet getrennte HTML-Hörlinks für Discord und bestehende MP3-Musikbox-Links',()=>{
 const {document,window}=parseHTML('<html><body><div data-musicbox-kind="track" data-musicbox-id="song">Song</div><div data-musicbox-kind="album" data-musicbox-id="album">Album</div></body></html>'),copied=[],managed=[];
 const cleanup=installMusicboxMenu({document,resolve:(kind,id)=>({kind,id,title:id,available:true}),onCopy:()=>{},onRemove:()=>{},onPublicLink:(...args)=>copied.push(args),onPublicManage:(...args)=>managed.push(args)});
 const open=id=>document.querySelector('[data-musicbox-id="'+id+'"]').dispatchEvent(new window.Event('contextmenu',{bubbles:true,cancelable:true}));
 open('song');assert.match(document.querySelector('#copy-public-link').textContent,/HTML-Seite für Discord/);document.querySelector('#copy-public-link').onclick();assert.deepEqual(copied,[['track','song']]);
 open('album');document.querySelector('#manage-public-link').onclick();assert.deepEqual(managed,[['album','album']]);assert.ok(document.querySelector('#copy-musicbox'));cleanup();
});

test('Stimmen bearbeiten ist für eigene Songs erreichbar und für empfangene Freigaben ausgeblendet',()=>{
 const {document,window}=parseHTML('<html><body><div data-musicbox-kind="track" data-musicbox-id="own">Eigener Song</div><div data-musicbox-kind="track" data-musicbox-id="shared">Empfangen</div></body></html>'),edited=[];
 const cleanup=installMusicboxMenu({document,resolve:(kind,id)=>({kind,id,title:id,available:false,canEditVoices:id==='own'}),onCopy:()=>{},onRemove:()=>{},onVoices:id=>edited.push(id)});
 const open=id=>document.querySelector('[data-musicbox-id="'+id+'"]').dispatchEvent(new window.Event('contextmenu',{bubbles:true,cancelable:true}));
 open('own');document.querySelector('#edit-song-voices').onclick();assert.deepEqual(edited,['own']);open('shared');assert.equal(document.querySelector('#edit-song-voices'),null);cleanup();
});
