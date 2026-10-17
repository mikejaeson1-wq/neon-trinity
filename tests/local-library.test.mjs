import test from 'node:test';
import assert from 'node:assert/strict';
import {newState,validateState} from '../app/core.mjs';
import {ownLocalTracks,ownLocalPlaylists,availableTracks,playlistTracks,localPlaylistRecord,backupForOwner,backupBlobIds} from '../app/local-library.mjs';
import {snapshot,emptyCatalog,applyToState,validateRecord} from '../app/shared.mjs';
import {TeamClient} from '../app/team.mjs';
import {activityFor} from '../desktop/discord.cjs';
const band={id:'band-song',blobId:'band-mp3',title:'Shared',artist:'Neon Trinity',duration:180,size:123};
const dex={...band,id:'dex-song',blobId:'dex-mp3',coverBlobId:'dex-cover',title:'Private Dex Song',ownerId:'dex-user',visibility:'local'};
const nix={...dex,id:'nix-song',blobId:'nix-mp3',coverBlobId:'nix-cover',title:'Private Nix Song',ownerId:'nix-user'};
const fixture=()=>({...newState(),tracks:[band],localTracks:[dex,nix],localPlaylists:[{id:'local-dex',title:'Dex only',trackIds:[dex.id,band.id],visibility:'local',ownerId:dex.ownerId}]});
test('Private lokale Songs und Playlists sind pro Konto sichtbar und bleiben bei Team-Pulls erhalten',()=>{
 const s=fixture();assert.deepEqual(availableTracks(s,dex.ownerId).map(t=>t.id),[band.id,dex.id]);assert.deepEqual(ownLocalTracks(s,nix.ownerId),[nix]);assert.deepEqual(ownLocalTracks(s,null),[]);assert.equal(ownLocalPlaylists(s,nix.ownerId).length,0);
 assert.ok(!playlistTracks(s,dex.ownerId,'private').some(t=>t.id===dex.id));assert.equal(localPlaylistRecord(s.localPlaylists[0],dex.ownerId,s).visibility,'local');assert.throws(()=>localPlaylistRecord({...s.localPlaylists[0],trackIds:[nix.id]},dex.ownerId,s),/nicht verfügbar/);
 const before=structuredClone(s.localTracks);applyToState(s,emptyCatalog());assert.deepEqual(s.localTracks,before);assert.equal(ownLocalPlaylists(s,dex.ownerId).length,1);
});
test('Auch falsch zugeordnete lokale Datensätze und Dateien gelangen nicht in Uploads, Alben oder Bandplaylists',async()=>{
 const s=fixture();s.tracks.push(dex);s.playlists=[{id:'band-list',title:'Show',trackIds:[band.id,dex.id]},s.localPlaylists[0]];s.albums=[{id:'album',title:'Band album',trackIds:[band.id,dex.id],coverBlobId:dex.coverBlobId}];s.teamAssets=[{id:dex.blobId},{id:dex.coverBlobId}];
 const snap=snapshot(s);assert.deepEqual(snap.tracks.map(t=>t.id),[band.id]);assert.deepEqual(snap.albums[0].trackIds,[band.id]);assert.equal(snap.albums[0].coverBlobId,undefined);assert.deepEqual(snap.playlists[0].trackIds,[band.id]);assert.equal(snap.playlists.length,1);assert.deepEqual(snap.assets,[]);assert.ok(!JSON.stringify(snap).includes(dex.title));assert.throws(()=>validateRecord('tracks',dex),/Private lokale/);
 let uploaded=0,written;
 const client=new TeamClient({getState:()=>s,setState:()=>{},getBlob:async()=>new Blob(['audio'],{type:'audio/mpeg'}),putBlob:async()=>{},backend:{info:{},upload:async(id)=>{uploaded++;assert.equal(id,band.blobId);return {id,provider:'supabase'};},save:async ops=>{written=ops;return {catalog:snapshot(s)};}}});client.user={id:dex.ownerId,alias:'Dex'};client.baseline=emptyCatalog();
 await client.push(s);assert.equal(uploaded,1);assert.ok(!JSON.stringify(written).includes('dex-'));await assert.rejects(client.savePrivate({id:'cloud-private',title:'Private',trackIds:[dex.id]}),/nur in lokalen/);
 assert.equal(activityFor({private:true,title:dex.title,roomUrl:'https://band.example/?room=secret'}),null);
});
test('Backups enthalten nur eigene private MP3s und lehnen kollidierende Eigentümer-Verweise ab',()=>{
 const s=fixture();const own=backupForOwner(s,dex.ownerId);assert.deepEqual(own.localTracks,[dex]);assert.deepEqual([...backupBlobIds(own)].sort(),['band-mp3','dex-cover','dex-mp3']);assert.ok(!JSON.stringify(own).includes(nix.title));assert.equal(backupForOwner(s,null).localTracks.length,0);assert.equal(validateState(s).localTracks.length,2);
 const bad=fixture();bad.localPlaylists[0].trackIds=[nix.id];assert.throws(()=>validateState(bad),/anderen Kontos/);bad.localPlaylists=[];bad.localTracks[0].blobId=band.blobId;assert.throws(()=>validateState(bad),/Dateiverweis/);
});
