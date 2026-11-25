import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,validateState} from '../app/core.mjs';
import {snapshot,applyOperations,emptyCatalog,diffCatalog,applyToState} from '../app/shared.mjs';
import {backupBlobIds,backupForOwner} from '../app/local-library.mjs';
import {StudioJournal,playbackPrivacy} from '../app/studio-state.mjs';
import {musicboxSelection,musicboxFingerprint} from '../app/musicbox-links.mjs';
const track=(id,extra={})=>({id,blobId:id+'-audio',title:id,artist:'Event Artist',duration:120,...extra});

test('Event Musik bleibt beim Abgleich, in Alben und in Sicherungen von Band- und Privatmusik getrennt',()=>{
 const state=newState();state.tracks=[track('band')];state.eventTracks=[track('event',{visibility:'event'})];state.localTracks=[track('private',{visibility:'local',ownerId:'dex'})];state.albums=[{id:'album',title:'Bandalbum',trackIds:['band','event','private']}];
 const desired=snapshot(state);assert.deepEqual(desired.tracks.map(t=>t.id),['band']);assert.deepEqual(desired.eventTracks.map(t=>t.id),['event']);assert.deepEqual(desired.albums[0].trackIds,['band']);
 const saved=applyOperations(emptyCatalog(),diffCatalog(emptyCatalog(),desired),'Dex');assert.equal(saved.eventTracks[0].visibility,'event');assert.equal(saved.tracks.length,1);const other=newState();applyToState(other,saved);assert.equal(other.eventTracks[0].title,'event');
 const restored=validateState(backupForOwner(state,'dex'));assert.equal(restored.eventTracks[0].id,'event');assert.ok(backupBlobIds(restored).has('event-audio'));assert.ok(backupBlobIds(restored).has('private-audio'));
 const legacy=newState();delete legacy.eventTracks;assert.deepEqual(validateState(legacy).eventTracks,[]);
 const bad=structuredClone(state);bad.eventTracks[0].ownerId='dex';assert.throws(()=>validateState(bad),/Private lokale/);
 const reused=structuredClone(state);reused.localTracks[0].blobId='event-audio';assert.throws(()=>validateState(reused),/Dateiverweis/);
});
test('Verlauf stellt gelöschte Event-Musik wieder her; der Band-Hörraum wird nicht mit fremder Event-Musik gestartet',()=>{
 const state=newState(),journal=new StudioJournal();state.eventTracks=[track('event',{visibility:'event'})];journal.mark(state,'dex');state.eventTracks=[];const deleted=journal.capture(state,'dex');assert.ok(backupBlobIds(state).has('event-audio'));journal.restore(state,'dex',deleted.id);assert.equal(state.eventTracks[0].id,'event');assert.equal(playbackPrivacy(state,'dex',state.eventTracks[0]).listen,false);assert.equal(state.tracks.length,0);
});
test('Musikbox-Auswahl akzeptiert ausschließlich Event-Musik aus der richtigen Sammlung und trennt ihre Fingerprints',async()=>{
 const catalog=emptyCatalog();catalog.tracks=[track('band')];catalog.eventTracks=[track('event',{visibility:'event'})];catalog.assets=catalog.eventTracks.map(t=>({id:t.blobId,provider:'supabase',type:'audio/mpeg',sha:'a'.repeat(64)}));
 const selection=musicboxSelection(catalog,'event-track','event');assert.equal(selection.tracks[0].id,'event');assert.equal(selection.title,'event');assert.throws(()=>musicboxSelection(catalog,'track','event'));assert.throws(()=>musicboxSelection(catalog,'event-track','band'));
 const band={...selection,kind:'track'};assert.notEqual(await musicboxFingerprint(selection),await musicboxFingerprint(band));catalog.eventTracks[0].ownerId='nix';assert.throws(()=>musicboxSelection(catalog,'event-track','event'),/Private/);
});
