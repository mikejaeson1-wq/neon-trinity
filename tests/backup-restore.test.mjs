import test from 'node:test';import assert from 'node:assert/strict';import 'fake-indexeddb/auto';import {newState} from '../app/core.mjs';import {saveState,loadState,putBlob,getBlob} from '../app/db.mjs';import {restoreFolderBackup} from '../app/backup-restore.mjs';
const dex='11111111-1111-4111-8111-111111111111',nix='22222222-2222-4222-8222-222222222222',track=(id,owner)=>({id,ownerId:owner,visibility:'local',blobId:id+'-blob',title:id,duration:10});
test('Vorbereitete Wiederherstellung erhält fremde lokale Daten und verändert die Band nur auf ausdrücklichen Wunsch',async()=>{
 let state=newState(),owner={id:dex};state.tracks=[{id:'band',title:'Aktuelle Bandfassung',blobId:'band-blob',duration:20}];state.localTracks=[track('nix-private',nix)];state.studioOwners={[nix]:{work:{secret:{notes:'Nix private'}}}};await putBlob('nix-private-blob',new Blob(['nix'],{type:'audio/mpeg'}));await saveState(state);
 const restore=newState();restore.tracks=[{id:'band',title:'Alte Bandfassung',blobId:'band-blob',duration:20}];restore.localTracks=[track('dex-private',dex)];restore.studioOwners={[dex]:{audio:{normalize:true}}};
 const manifest={ownerId:dex,state:restore,blobs:[{key:'dex-private-blob',size:3,type:'audio/mpeg'}]},options={manifest,read:async()=>new Uint8Array([73,68,51]),getState:()=>state,setState:v=>state=v,getOwner:()=>owner,owner:dex};
 await restoreFolderBackup(options);assert.equal(state.tracks[0].title,'Aktuelle Bandfassung');assert.equal(state.localTracks.length,2);assert.equal(await (await getBlob('nix-private-blob')).text(),'nix');assert.equal(state.studioOwners[nix].work.secret.notes,'Nix private');assert.equal((await loadState()).localTracks.length,2);
 await restoreFolderBackup({...options,shared:true});assert.equal(state.tracks[0].title,'Alte Bandfassung');
});
test('Ein Lesefehler oder Kontowechsel vor dem Commit lässt die laufende Datenbank unverändert',async()=>{
 let state=newState(),owner={id:dex};state.tracks=[{id:'band',title:'Behalten',blobId:'band-blob',duration:20}];await saveState(state);const restore=newState();restore.localTracks=[track('private-two',dex)];const manifest={ownerId:dex,state:restore,blobs:[{key:'private-two-blob',size:3,type:'audio/mpeg'}]},options={manifest,getState:()=>state,setState:v=>state=v,getOwner:()=>owner,owner:dex};
 await assert.rejects(restoreFolderBackup({...options,read:async()=>new Uint8Array([1])}),/unvollständig/);assert.equal((await loadState()).tracks[0].title,'Behalten');assert.equal(await getBlob('private-two-blob'),undefined);
 await assert.rejects(restoreFolderBackup({...options,read:async()=>{owner={id:nix};return new Uint8Array([73,68,51]);}}),/Konto/);assert.equal((await loadState()).tracks[0].title,'Behalten');
});
