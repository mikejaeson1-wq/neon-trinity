import test from 'node:test';
import assert from 'node:assert/strict';
import {ListeningMedia} from '../app/listen-media.mjs';
import {ListeningSession} from '../app/listen.mjs';
const assetId='11111111-1111-4111-8111-111111111111';
const turn=()=>new Promise(r=>setImmediate(r));
function fixture(){
 let owner={id:'dex'},track={id:'private-one',blobId:'blob-one',ownerId:'dex',visibility:'local',title:'Unveröffentlicht',artist:'Dex',duration:180,lyrics:'not shared',coverBlobId:'private-cover'};
 const requests=[],uploads=[];let counter=0;
 const backend={publicRequest:async(path,method,data)=>{requests.push({path,method,data});return method==='POST'?{id:++counter===1?assetId:'22222222-2222-4222-8222-222222222222',path:'dex/temporary.mp3'}:{ok:true};},client:{storage:{from:bucket=>({upload:async(path,blob,options)=>{uploads.push({bucket,path,blob,options});return {error:null};}})}}};
 const media=new ListeningMedia({backend,getOwner:()=>owner,getTrack:id=>id===track.id?track:null,getBlob:async()=>new Blob(['ID3 audio'],{type:'audio/mpeg'})});
 return {media,backend,requests,uploads,get owner(){return owner;},set owner(v){owner=v;},get track(){return track;},set track(v){track=v;}};
}
test('Nur die ausgewählte eigene MP3 und freigegebene Metadaten werden einmal vorbereitet; Bandwechsel entfernt die Kopie',async()=>{
 const f=fixture(),p={trackId:f.track.id,private:true,position:20,playing:true},first=await f.media.prepare(p),again=await f.media.prepare({...p,position:40});
 assert.equal(first.localAssetId,assetId);assert.equal(again.localAssetId,assetId);assert.equal(f.uploads.length,1);assert.equal(f.uploads[0].bucket,'nt-listen');assert.equal(f.uploads[0].options.upsert,false);assert.equal(await f.uploads[0].blob.text(),'ID3 audio');
 assert.deepEqual(Object.keys(f.requests[0].data).sort(),['artist','byteSize','duration','title','trackId'].sort());assert.ok(!JSON.stringify(f.requests).includes('private-cover'));assert.ok(!JSON.stringify(f.requests).includes('not shared'));
 await f.media.commit(assetId);assert.equal(f.requests.filter(r=>r.method==='DELETE').length,0);
 const band=await f.media.prepare({trackId:'band',private:false,position:0,playing:true});assert.equal(band.localAssetId,null);await f.media.commit(null);assert.equal(f.requests.at(-1).path,'/listen-media/'+assetId);assert.equal(f.track.visibility,'local');
});
test('Songwechsel behält die alte Kopie bis zur erfolgreichen Umschaltung; fehlende Dateien und fremde Konten werden abgewiesen',async()=>{
 const f=fixture();await f.media.prepare({trackId:f.track.id,private:true});
 f.track={...f.track,id:'private-two',blobId:'blob-two'};const next=await f.media.prepare({trackId:f.track.id,private:true});
 assert.equal(f.requests.filter(r=>r.method==='DELETE').length,0);await f.media.commit(next.localAssetId);assert.equal(f.requests.filter(r=>r.method==='DELETE').length,1);
 f.owner={id:'nix'};await assert.rejects(f.media.prepare({trackId:f.track.id,private:true}),/angemeldeten Konto/);await f.media.clear();assert.equal(f.media.entries.size,0);
});
test('Abbrechen während einer Reservierung verhindert den Upload und entsorgt die verspätete Reservierung',async()=>{
 const f=fixture();let resolve;f.backend.publicRequest=async(path,method)=>{f.requests.push({path,method});if(method==='POST')return new Promise(r=>resolve=r);return {ok:true};};
 const pending=f.media.prepare({trackId:f.track.id,private:true});await turn();await f.media.clear();resolve({id:assetId,path:'dex/cancelled.mp3'});
 await assert.rejects(pending,/gewechselt/);assert.equal(f.uploads.length,0);assert.equal(f.requests.at(-1).method,'DELETE');assert.equal(f.media.entries.size,0);
});
test('Kontowechsel während des Uploads gibt keine alte Datei an das neue Konto weiter',async()=>{
 const f=fixture();let resolve;f.backend.client.storage.from=()=>({upload:async()=>new Promise(r=>resolve=r)});
 const pending=f.media.prepare({trackId:f.track.id,private:true});await turn();f.owner={id:'nix'};await f.media.clear();resolve({error:null});
 await assert.rejects(pending,/angemeldeten Konto|gewechselt/);assert.equal(f.media.entries.size,0);assert.equal(f.requests.at(-1).method,'DELETE');
});
test('Nach dem MP3-Upload wird die aktuelle Position und Pause gesendet; laufender Hörlink bleibt beim Wechsel auf Bandmusik erhalten',async()=>{
 const f=fixture();let resolve;f.backend.client.storage.from=()=>({upload:async()=>new Promise(r=>resolve=r)});
 let player={trackId:f.track.id,private:true,position:2,playing:true};const calls=[];
 const session=new ListeningSession({media:f.media,team:{active:true,api:async(path,method,data)=>{calls.push({path,method,data});return method==='POST'?{id:'a'.repeat(64),url:'https://band.example/album.html?room='+'a'.repeat(64)}:{ok:true};}},getPlayer:()=>player,onRemote:()=>{}});
 const pending=session.host();await turn();player={...player,position:42,playing:false};resolve({error:null});await pending;assert.equal(calls[0].data.position,42);assert.equal(calls[0].data.playing,false);assert.equal(calls[0].data.localAssetId,assetId);
 const url=session.url;player={trackId:'band',private:false,position:0,playing:true};await session.updateHost();assert.equal(session.url,url);assert.equal(calls.at(-1).method,'PATCH');assert.equal(calls.at(-1).data.localAssetId,null);assert.equal(f.media.entries.size,0);await session.leave();
});
