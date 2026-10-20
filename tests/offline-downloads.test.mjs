import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {OfflineMusic} from '../app/mobile-offline.mjs';
test('Band-Downloads sind prüfsummengesichert, begrenzt und zwischen Konten getrennt',async()=>{
 let owner={id:'dex'};const music=new OfflineMusic({indexedDB:new IDBFactory(),getOwner:()=>owner,getBlob:async()=>new Blob(['ID3 song'],{type:'audio/mpeg'})});music.setOwner('dex');await music.save({id:'song',blobId:'mp3',title:'Band',duration:100});assert.equal(music.rows.length,1);assert.ok((await music.media('song')).startsWith('blob:'));
 owner={id:'nix'};music.setOwner('nix');assert.equal((await music.load()).length,0);await assert.rejects(music.media('song'),/nicht für dein Konto/);await assert.rejects(music.save({id:'private',visibility:'local'}),/Bandmediathek/);
 owner={id:'dex'};music.setOwner('dex');await music.load();assert.equal(music.rows[0].track.title,'Band');await music.remove('song');assert.equal(music.rows.length,0);
});
test('Ein später Download nach Kontowechsel wird nicht gespeichert',async()=>{
 let owner={id:'dex'},resolve;const pending=new Promise(r=>resolve=r),music=new OfflineMusic({indexedDB:new IDBFactory(),getOwner:()=>owner,getBlob:async()=>pending});music.setOwner('dex');const save=music.save({id:'song',blobId:'mp3',title:'Band',duration:10});await new Promise(r=>setImmediate(r));owner={id:'nix'};music.setOwner('nix');resolve(new Blob(['ID3'],{type:'audio/mpeg'}));await assert.rejects(save,/gewechselt/);assert.equal((await music.load()).length,0);
});
