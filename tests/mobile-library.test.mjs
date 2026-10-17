import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {MobileLibrary} from '../app/mobile-library.mjs';
import {CLOUD} from '../app/cloud-config.mjs';
const json=value=>new Response(JSON.stringify(value));
test('Handy-Mediathek liest Banddaten und ausschließlich die persönlichen Playlists des verifizierten Kontos',async()=>{
 const calls=[];let release;const client=createClient(CLOUD.url,CLOUD.key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input)=>{const url=new URL(input);calls.push(url);if(url.pathname.endsWith('nt_catalog'))return json({data:{tracks:[{id:'song',blobId:'audio'}],albums:[],playlists:[{id:'band-list'}],assets:[{id:'audio',provider:'supabase',path:'media/audio.mp3'}]}});if(url.pathname.endsWith('nt_private_playlists')){if(release===false)await new Promise(resolve=>release=resolve);return json([{id:'personal',data:{title:'Only Dex',trackIds:['song']}}]);}if(url.pathname.includes('/storage/'))return json({signedURL:'/object/sign/nt-media/media/audio.mp3?token=signed'});throw Error('Unexpected '+url);}}});
 const m=new MobileLibrary(client);m.setOwner({id:'dex'});await m.load();assert.equal(calls.find(u=>u.pathname.endsWith('nt_private_playlists')).searchParams.get('owner_id'),'eq.dex');assert.equal(m.playlists[1].personal,true);const signed=await m.media('audio');assert.match(signed,/token=signed/);assert.equal(calls.filter(u=>u.pathname.includes('/storage/')).length,1);assert.equal(await m.media('audio'),signed);assert.equal(calls.filter(u=>u.pathname.includes('/storage/')).length,1);
 release=false;const pending=m.load();await new Promise(resolve=>setImmediate(resolve));m.setOwner({id:'nix'});release();await assert.rejects(pending,/Konto/);assert.deepEqual(m.playlists,[]);assert.deepEqual(m.tracks,[]);assert.equal(m.signed.size,0);client.auth.stopAutoRefresh();
});
test('Gäste lesen nur veröffentlichte Alben; das Laden eines Covers ändert keine Titelliste',async()=>{
 const client=createClient(CLOUD.url,CLOUD.key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async()=>json([{id:'album',data:{album:{title:'Public',trackIds:['song']},tracks:[{id:'song',blobId:'audio'}],assets:[{id:'audio',path:'media/song.mp3',provider:'supabase'}]}}])}});const m=new MobileLibrary(client);await m.load();const oldFetch=globalThis.fetch;globalThis.fetch=async()=>json({tracks:[{id:'should-not-replace'}],assets:[{id:'audio',path:'media/song.mp3',provider:'supabase'}],urls:{'media/song.mp3':CLOUD.url+'/storage/v1/object/sign/nt-media/media/song.mp3?token=public'}});
 try{assert.match(await m.media('audio'),/token=public/);assert.equal(m.tracks[0].id,'song');assert.equal(m.playlists.length,0);await assert.rejects(m.publicAlbum('draft'),/nicht veröffentlicht/);}finally{globalThis.fetch=oldFetch;client.auth.stopAutoRefresh();}
});
