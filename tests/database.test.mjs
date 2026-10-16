import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {newState} from '../app/core.mjs';
import {loadState,saveState,putBlob,getBlob,allBlobs,replaceDatabase} from '../app/db.mjs';
test('Lokale Datenbank speichert Songs und Bilder über erneutes Laden hinweg',async()=>{const state=newState();state.tracks.push({id:'song',blobId:'file',title:'Test'});await putBlob('file',new Blob(['mp3-bytes'],{type:'audio/mpeg'}));await saveState(state);const loaded=await loadState();assert.equal(loaded.tracks[0].title,'Test');assert.equal(await (await getBlob('file')).text(),'mp3-bytes');assert.equal((await allBlobs()).length,1);});
test('Vollständige Wiederherstellung ersetzt Zustand und Dateien zusammen',async()=>{const state=newState();state.playlists.push({id:'new',title:'New set',trackIds:[]});await replaceDatabase(state,[{key:'cover',blob:new Blob(['cover-bytes'],{type:'image/png'})}]);assert.equal((await loadState()).playlists[0].title,'New set');assert.equal(await getBlob('file'),undefined);assert.equal(await (await getBlob('cover')).text(),'cover-bytes');});
