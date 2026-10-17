import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {SupabaseBackend} from '../app/cloud.mjs';
import {TeamClient} from '../app/team.mjs';
import {emptyCatalog} from '../app/shared.mjs';
import {newState} from '../app/core.mjs';
import {CLOUD} from '../app/cloud-config.mjs';
globalThis.document={querySelector:()=>null};globalThis.window={};
test('Ein deaktivierter Discord-Anbieter wird vor dem Desktop-Login verständlich gemeldet',async()=>{let started=false;const oldWindow=globalThis.window;globalThis.window={neonDesktop:{cloudStartLogin:async()=>{started=true;}}};const team=new TeamClient({backend:{info:{},discordAvailable:async()=>false},getState:()=>newState(),setState:()=>{},getBlob:async()=>null,putBlob:async()=>{}});try{await assert.rejects(team.login(),/Discord ist in Supabase noch nicht aktiviert/);assert.equal(started,false);}finally{globalThis.window=oldWindow;}});
const clone=structuredClone;
function fixture(){
 const server={data:emptyCatalog(),revision:0,media:new Map(),releases:new Map(),privatePlaylists:new Map(),casMisses:0};
 const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 async function fetcher(input,init={}){
  const url=new URL(String(input)),method=init.method||'GET',actor=new Headers(init.headers).get('X-Test-Actor');
  if(url.pathname.endsWith('/rpc/nt_identity'))return response({id:actor,alias:actor,allowed:true});
  if(url.pathname.endsWith('/nt_config'))return response({discord_client_id:'123456789012345678',public_base:'https://band.example'});
  if(url.pathname.endsWith('/nt_catalog')){
   if(method==='GET')return response({data:clone(server.data),revision:server.revision});
   if(method==='PATCH'){
    await new Promise(resolve=>setTimeout(resolve,1));
    if(url.searchParams.get('revision')!=='eq.'+server.revision){server.casMisses++;return response(null);}
    server.data=clone(JSON.parse(init.body).data);server.revision++;
    return response({data:clone(server.data),revision:server.revision});
   }
  }
  if(url.pathname.endsWith('/nt_private_playlists')){
   if(method==='GET')return response([...server.privatePlaylists.values()].filter(row=>row.owner_id===actor));
   if(method==='POST'){const row=JSON.parse(init.body);assert.equal(row.owner_id,actor);server.privatePlaylists.set(actor+'/'+row.id,clone(row));return response(row);}
   const id=url.searchParams.get('id')?.slice(3),key=actor+'/'+id,row=server.privatePlaylists.get(key);
   if(!row||url.searchParams.get('revision')!=='eq.'+row.revision)return response(null);
   if(method==='PATCH'){const next={...row,...JSON.parse(init.body)};server.privatePlaylists.set(key,clone(next));return response(next);}
   if(method==='DELETE'){server.privatePlaylists.delete(key);return response({id});}
  }
  if(url.pathname.endsWith('/nt_releases')){
   if(method==='GET')return response([...server.releases.values()].map(r=>({id:r.id})));
   if(method==='POST'){const body=JSON.parse(init.body);for(const row of Array.isArray(body)?body:[body])server.releases.set(row.id,clone(row));return response(null);}
   if(method==='DELETE'){for(const id of server.releases.keys())if(url.searchParams.get('id')?.includes(id))server.releases.delete(id);return response(null);}
  }
  throw new Error('Unexpected Supabase request: '+method+' '+url.pathname);
 }
 function client(alias){
  const sdk=createClient(CLOUD.url,CLOUD.key,{global:{fetch:fetcher,headers:{'X-Test-Actor':alias}},auth:{persistSession:false,autoRefreshToken:false,storageKey:'nt-test-'+alias+'-'+crypto.randomUUID()}});
  sdk.channel=()=>({on(){return this;},subscribe(){return this;}});sdk.removeChannel=async()=>{};
  sdk.storage.from=()=>({upload:async(path,blob,options)=>{assert.equal(options.upsert,false);if(server.media.has(path))return {error:{message:'already exists',statusCode:409}};server.media.set(path,blob);return {data:{path},error:null};},download:async path=>({data:server.media.get(path),error:null})});
  const backend=new SupabaseBackend(sdk),cache=new Map();let state=newState();
  const team=new TeamClient({backend,getState:()=>state,setState:value=>{state=value;},getBlob:async id=>cache.get(id)||null,putBlob:async(id,blob)=>cache.set(id,blob)});
  return {team,backend,cache,get state(){return state;},async ready(){await team.resume();return this;},close(){clearInterval(team.timer);sdk.auth.stopAutoRefresh();}};
 }
 return {server,client};
}
test('Drei unabhängige Supabase-Clients teilen MP3s und führen parallele Änderungen zusammen',async()=>{
 const f=fixture(),dex=f.client('Dex'),nix=f.client('Nix'),jax=f.client('Jax');
 try{
  await Promise.all([dex.ready(),nix.ready(),jax.ready()]);
  dex.cache.set('audio',new Blob(['ID3 shared music'],{type:'audio/mpeg'}));
  dex.state.tracks.push({id:'song',blobId:'audio',title:'Neon Drive',artist:'Neon Trinity',voices:'Dex · Nix · Jax',duration:180,size:16});
  dex.state.albums.push({id:'album',title:'Neon Trinity',description:'',year:2026,trackIds:['song']});
  await dex.team.push(clone(dex.state));await Promise.all([nix.team.pull(),jax.team.pull()]);
  assert.equal(nix.state.tracks[0].title,'Neon Drive');assert.equal(await(await jax.team.fetchBlob('audio')).text(),'ID3 shared music');
  nix.state.albums[0].title='Nix Mix';jax.state.playlists.push({id:'jax-set',title:'Jax Live',description:'',trackIds:['song']});
  await Promise.all([nix.team.push(clone(nix.state)),jax.team.push(clone(jax.state))]);
  assert.equal(f.server.data.albums[0].title,'Nix Mix');assert.equal(f.server.data.playlists[0].title,'Jax Live');assert.ok(f.server.casMisses>0);
  await dex.team.pull();await nix.team.pull();dex.state.tracks[0].title='Dex Version';nix.state.tracks[0].title='Nix Version';
  await dex.team.push(clone(dex.state));await assert.rejects(nix.team.push(clone(nix.state)),e=>e.status===409);assert.ok(nix.team.conflict);
  await jax.team.pull();jax.state.playlists.push({id:'new-show',title:'Neue Show',description:'',trackIds:['song']});await jax.team.push(clone(jax.state));
  await nix.team.resolve(true);assert.equal(f.server.data.tracks[0].title,'Nix Version');assert.ok(f.server.data.playlists.some(p=>p.id==='new-show'));
 }finally{dex.close();nix.close();jax.close();}
});
test('Supabase-Publikation enthält nur freigegebene Dateien; Zurückziehen erhält die gemeinsame Musik',async()=>{
 const f=fixture(),dex=f.client('Dex');try{await dex.ready();dex.cache.set('blob-public',new Blob(['MP3'],{type:'audio/mpeg'}));dex.cache.set('blob-draft',new Blob(['PRIVATE'],{type:'audio/mpeg'}));
 dex.state.tracks.push({id:'public',blobId:'blob-public',title:'Release',artist:'Band',duration:123,size:3},{id:'draft',blobId:'blob-draft',title:'Draft',artist:'Band',duration:80,size:7});
 dex.state.albums.push({id:'album',title:'Release',description:'',trackIds:['public'],year:2026});await dex.team.push(clone(dex.state));
 await dex.backend.publish(['album'],'trinity');assert.deepEqual(f.server.releases.get('album').data.tracks.map(t=>t.id),['public']);assert.equal(f.server.releases.get('album').asset_paths.length,1);assert.ok(!JSON.stringify(f.server.releases.get('album')).includes('blob-draft'));
 await dex.backend.publish([],'trinity');assert.equal(f.server.releases.size,0);assert.equal(f.server.media.size,2);assert.equal(f.server.data.tracks.length,2);
 }finally{dex.close();}
});
test('Eine wiederholte Datei-ID wird nur mit identischen Bytes wiederverwendet',async()=>{const f=fixture(),dex=f.client('Dex');try{const blob=new Blob(['music'],{type:'audio/mpeg'});const first=await dex.backend.upload('same-id',blob);assert.equal(first.provider,'supabase');assert.equal(first.sha.length,64);await dex.backend.upload('same-id',blob);await assert.rejects(dex.backend.upload('same-id',new Blob(['different'],{type:'audio/mpeg'})),/andere Daten/);assert.equal(await f.server.media.get(first.path).text(),'music');}finally{dex.close();}});
test('Lokale Bearbeitungen während eines laufenden Abgleichs bleiben erhalten',async()=>{const f=fixture(),dex=f.client('Dex');try{await dex.ready();dex.state.playlists.push({id:'first',title:'Erste Setlist',description:'',trackIds:[]});const save=dex.team.push(clone(dex.state));dex.state.playlists.push({id:'later',title:'Während Upload erstellt',description:'',trackIds:[]});await save;assert.ok(dex.state.playlists.some(p=>p.id==='later'));await dex.team.push(clone(dex.state));assert.equal(f.server.data.playlists.length,2);}finally{dex.close();}});

test('Echte Supabase-Clients speichern persönliche Playlists getrennt pro Konto und erkennen Änderungen vom zweiten Gerät',async()=>{
 const f=fixture(),dex=f.client('Dex'),second=f.client('Dex'),nix=f.client('Nix'),jax=f.client('Jax');
 try{
  await Promise.all([dex.ready(),nix.ready(),jax.ready()]);
  const first=await dex.team.savePrivate({id:'personal',title:'Dex private order',description:'only me',trackIds:[]});
  await Promise.all([second.ready(),nix.team.pull(),jax.team.pull()]);
  assert.equal(second.state.privatePlaylists[0].title,first.title);assert.equal(nix.state.privatePlaylists.length,0);assert.equal(jax.state.privatePlaylists.length,0);assert.equal(f.server.data.playlists.length,0);
  await second.team.savePrivate({...first,title:'From second device'});
  await assert.rejects(dex.team.savePrivate({...first,title:'Stale edit'}),e=>e.status===409);
  await dex.team.pullPrivate();assert.equal(dex.state.privatePlaylists[0].title,'From second device');
  await dex.team.deletePrivate(dex.state.privatePlaylists[0]);assert.equal(f.server.privatePlaylists.size,0);
 }finally{dex.close();second.close();nix.close();jax.close();}
});
