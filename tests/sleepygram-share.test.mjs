import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SleepygramAPI} from '../app/sleepygram-share.mjs';
import {canShareToSleepygram,sleepygramChoices} from '../app/sleepygram-source.mjs';
test('Sleepygram shares own local/band media and refuses received private songs or other accounts',async()=>{
 const user={id:'dex',alias:'Dex'},record={id:'song',title:'Night',ownerId:'dex',blobId:'mp3',coverBlobId:'image'};
 assert.equal(canShareToSleepygram({kind:'track',record,user,band:false}),true);
 assert.equal(canShareToSleepygram({kind:'track',record:{...record,ownerId:'nix'},user,band:false}),false);
 assert.equal(canShareToSleepygram({kind:'track',record:{...record,visibility:'shared'},user,band:true}),false);
 assert.equal(canShareToSleepygram({kind:'track',record,user:{id:'other',alias:'Guest'},band:true}),false);
 const read=[],choices=sleepygramChoices({kind:'track',record,user,band:false,getBlob:async id=>{read.push(id);return new Blob(['media'],{type:id==='mp3'?'audio/mpeg':'image/png'});}});
 assert.equal(choices.length,2);assert.deepEqual(read,[]);assert.equal((await choices[0].getBlob()).type,'audio/mpeg');assert.deepEqual(read,['mp3']);assert.equal(record.blobId,'mp3');
});
test('Relay calls carry only the current session, reject missing identity and detect account changes',async()=>{
 let person={id:'dex',alias:'Dex'},calls=0,swap=false;
 const api=new SleepygramAPI({getIdentity:()=>person,getToken:async()=>'discord-session',fetcher:async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer discord-session');assert.match(url,/\/api\/sleepygram\/studio-session$/);if(swap)person={id:'nix',alias:'Nix'};return Response.json({me:{id:'profile-dex'}});}});
 assert.equal((await api.session('dex')).me.id,'profile-dex');assert.equal(calls,1);
 await assert.rejects(api.session('nix'),/gewechselt/);assert.equal(calls,1);
 swap=true;await assert.rejects(api.session('dex'),/gewechselt/);assert.equal(calls,2);
 person=null;await assert.rejects(api.session('dex'),/anmelden/);assert.equal(calls,2);
});
test('Sharing validates media limits before uploading any bytes',async()=>{
 let calls=0;const api=new SleepygramAPI({getIdentity:()=>({id:'dex'}),getToken:async()=>'token',fetcher:async()=>{calls++;return Response.json({});}});
 await assert.rejects(api.upload(new File(['x'],'script.svg',{type:'application/javascript'}),'dex'),/Bild oder einen Song/);
 await assert.rejects(api.upload(new File([],'empty.mp3',{type:'audio/mpeg'}),'dex'),/maximal/);assert.equal(calls,0);
});
