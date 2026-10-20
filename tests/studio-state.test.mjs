import test from 'node:test';
import assert from 'node:assert/strict';
import {newState} from '../app/core.mjs';
import {StudioJournal,ownerSettings,playbackPrivacy,retainedBlobIds} from '../app/studio-state.mjs';
test('Anzeige und Mithören sind je Nutzer und Song unabhängig steuerbar',()=>{
 const s=newState(),t={id:'mine',visibility:'local'};assert.deepEqual(playbackPrivacy(s,'dex',t),{show:true,listen:true});ownerSettings(s,'dex').privacy.tracks.mine={show:false,listen:true};assert.deepEqual(playbackPrivacy(s,'dex',t),{show:false,listen:true});assert.deepEqual(playbackPrivacy(s,'nix',t),{show:true,listen:true});ownerSettings(s,'dex').privacy.localListen=false;assert.equal(playbackPrivacy(s,'dex',t).listen,false);
});
test('Löschen und Bearbeiten sind wiederherstellbar; zwischenzeitliche Änderungen werden nicht überschrieben',()=>{
 const s=newState(),j=new StudioJournal();s.tracks=[{id:'song',title:'Original',blobId:'mp3'}];j.mark(s,'dex');s.tracks=[];const deleted=j.capture(s,'dex');assert.ok(retainedBlobIds(s,'dex').has('mp3'));j.restore(s,'dex',deleted.id);j.capture(s,'dex');assert.equal(s.tracks[0].title,'Original');
 s.tracks[0].title='Neu';const edited=j.capture(s,'dex');s.tracks[0].title='Von Nix verändert';assert.throws(()=>j.restore(s,'dex',edited.id),/inzwischen geändert/);assert.equal(s.tracks[0].title,'Von Nix verändert');
});
test('Der Verlauf eines anderen Kontos ist verborgen und darf fremde lokale Einträge nicht wiederherstellen',()=>{
 const s=newState(),j=new StudioJournal();s.localTracks=[{id:'private',ownerId:'dex',title:'Privat',blobId:'secret'}];j.mark(s,'dex');s.localTracks=[];const entry=j.capture(s,'dex');assert.equal(j.entries(s,'nix').length,0);assert.throws(()=>j.restore(s,'nix',entry.id),/nicht für dein Konto/);j.restore(s,'dex',entry.id);assert.equal(s.localTracks[0].ownerId,'dex');
});

test('Eine ausgeschaltete Titelanzeige erzeugt auch für lokale Musik keine Discord-Aktivität',async()=>{const {activityFor}=await import('../desktop/discord.cjs');assert.equal(activityFor({source:'local',title:'Private MP3',paused:false,hidePresence:true}),null);assert.equal(activityFor({source:'local',title:'Private MP3',paused:false,hidePresence:false}).type,2);});
