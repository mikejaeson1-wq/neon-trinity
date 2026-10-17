import test from 'node:test';
import assert from 'node:assert/strict';
import {newState} from '../app/core.mjs';
import {snapshot,emptyCatalog,applyToState,validateRecord} from '../app/shared.mjs';
import {personalPlaylists,visiblePlaylists,privateRecord} from '../app/private-playlists.mjs';
import {TeamClient} from '../app/team.mjs';
const dex={id:'dex-user',alias:'Dex',allowed:true},nix={id:'nix-user',alias:'Nix',allowed:true};
const own=privateRecord({id:'private-dex',title:'Meine geheime Reihenfolge',trackIds:['song-one']},dex.id);
test('Persönliche Playlists werden weder in Band-Snapshots noch unter einem anderen Konto angezeigt',()=>{
  const state=newState();state.playlists=[{id:'band',title:'Gemeinsame Show',trackIds:[]}];state.privatePlaylists=[own,privateRecord({...own,id:'private-nix'},nix.id)];
  assert.deepEqual(visiblePlaylists(state,dex.id).map(x=>x.id),['band','private-dex']);
  assert.deepEqual(visiblePlaylists(state,nix.id).map(x=>x.id),['band','private-nix']);
  assert.deepEqual(visiblePlaylists(state,null).map(x=>x.id),['band']);
  assert.ok(!JSON.stringify(snapshot(state)).includes('geheime'));
  // A misplaced private record must not enter the shared synchronization path.
  state.playlists.push(own);assert.ok(!JSON.stringify(snapshot(state)).includes('geheime'));
  assert.throws(()=>validateRecord('playlists',own),/Persönliche/);
  const before=structuredClone(state.privatePlaylists);applyToState(state,emptyCatalog());assert.deepEqual(state.privatePlaylists,before);
});
test('Eigene Playlists laden auf einem zweiten Gerät, bleiben aus dem Bandkatalog und verschwinden beim Abmelden',async()=>{
  globalThis.document={querySelector:()=>null};globalThis.window={};
  const rows=new Map();let sharedWrites=0;
  const backend=actor=>({info:{publicBase:'https://example.com'},actor,identity:async()=>actor,catalog:async()=>({data:emptyCatalog()}),save:async()=>{sharedWrites++;return {catalog:emptyCatalog()};},privatePlaylists:async()=>structuredClone(rows.get(actor.id)||[]),savePrivatePlaylist:async record=>{const saved={...privateRecord(record,actor.id),_rev:crypto.randomUUID()};rows.set(actor.id,[...(rows.get(actor.id)||[]).filter(p=>p.id!==record.id),saved]);return saved;},client:{auth:{signOut:async()=>({error:null})},removeChannel:async()=>{},channel:()=>({on(){return this;},subscribe(){return this;}})}});
  const device=actor=>{let state=newState();const client=new TeamClient({getState:()=>state,setState:s=>state=s,getBlob:async()=>null,putBlob:async()=>{},backend:backend(actor)});return {client,get state(){return state;}};};
  const first=device(dex);await first.client.resume();await first.client.savePrivate(own);await first.client.push(first.state);assert.equal(sharedWrites,0);assert.equal(personalPlaylists(first.state,dex.id).length,1);
  const second=device(dex);await second.client.resume();assert.equal(second.state.privatePlaylists[0].title,own.title);
  const other=device(nix);await other.client.resume();assert.equal(other.state.privatePlaylists?.length||0,0);assert.ok(!JSON.stringify(snapshot(first.state)).includes(own.title));
  await first.client.logout();assert.deepEqual(first.state.privatePlaylists,[]);
  await second.client.logout();await other.client.logout();
});
