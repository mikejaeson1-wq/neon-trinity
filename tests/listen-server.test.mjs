import test from 'node:test';
import assert from 'node:assert/strict';
import {makeHandler,localInput,playerInput,safePublicBase} from '../supabase/functions/neon-public/handler.mjs';
const dex='b791f08f-56b3-4620-a121-0ad8faf110b3',nix='22222222-2222-4222-8222-222222222222',assetId='11111111-1111-4111-8111-111111111111',roomId='a'.repeat(64);
function fixture(){
 const now=Date.now(),tables={nt_rooms:[],nt_listen_assets:[],nt_catalog:[{id:1,data:{tracks:[{id:'band',blobId:'band-blob',title:'Band Song',artist:'Neon Trinity',duration:200}],assets:[{id:'band-blob',provider:'supabase',path:'media/band.mp3'}]}}],nt_config:[{id:1,public_base:'https://band.example'}],nt_releases:[]},objects=new Map(),signed=[];
 const asset={id:assetId,owner_id:dex,track_id:'local-one',title:'Private MP3',artist:'Dex',duration:180,byte_size:9,path:dex+'/'+assetId+'.mp3',expires_at:new Date(now+900000).toISOString(),lyrics:'never exposed',cover:'never exposed'};
 const room={id:roomId,host_id:dex,host_alias:'Dex',track_id:'local-one',local_asset_id:assetId,position:40,playing:true,updated_at:new Date(now).toISOString(),expires_at:new Date(now+90000).toISOString()};
 tables.nt_listen_assets.push(asset);tables.nt_rooms.push(room);objects.set('nt-listen/'+asset.path,{name:assetId+'.mp3',metadata:{size:9,mimetype:'audio/mpeg'}});
 function client(admin,actor=dex){
  const visible=(table,row)=>admin||table!=='nt_listen_assets'||row.owner_id===actor;
  const from=table=>{
   let op='select',payload,filters=[],one=false;
   const q={
    select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},lt(k,v){filters.push(r=>r[k]<v);return q;},limit(){return q;},
    insert(data){op='insert';payload=data;return q;},update(data){op='update';payload=data;return q;},delete(){op='delete';return q;},
    single(){one=true;return q;},maybeSingle(){one=true;return q;},
    then(resolve,reject){try{
     let rows=tables[table].filter(r=>visible(table,r)&&filters.every(f=>f(r)));
     if(op==='insert'){
      const row=structuredClone(payload);
      if(table==='nt_listen_assets'){row.id=crypto.randomUUID();row.owner_id=actor;row.path=actor+'/'+row.id+'.mp3';row.expires_at=new Date(Date.now()+900000).toISOString();}
      tables[table].push(row);rows=[row];
     }
     if(op==='update')for(const row of rows)Object.assign(row,payload);
     if(op==='delete'){tables[table]=tables[table].filter(r=>!rows.includes(r));if(table==='nt_listen_assets')tables.nt_rooms=tables.nt_rooms.filter(r=>!rows.some(a=>a.id===r.local_asset_id));}
     return Promise.resolve({data:structuredClone(one?rows[0]||null:rows),error:null}).then(resolve,reject);
    }catch(e){return Promise.reject(e).then(resolve,reject);}}
   };return q;
  };
  return {from,auth:{getUser:async()=>({data:{user:actor==='expired'?null:{id:actor}},error:null})},rpc:async()=>({data:{id:actor,alias:actor===dex?'Dex':'Nix',allowed:[dex,nix].includes(actor)},error:null}),storage:{from:bucket=>({
   createSignedUrl:async(path,ttl)=>{signed.push({bucket,path,ttl});return {data:{signedUrl:'https://media.example/'+bucket+'/'+path+'?signed=true'},error:null};},
   createSignedUrls:async()=>({data:[],error:null}),
   list:async prefix=>({data:[...objects.entries()].filter(([k])=>k.startsWith(bucket+'/'+prefix+'/')).map(([,v])=>v),error:null}),
   remove:async paths=>{for(const path of paths)objects.delete(bucket+'/'+path);return {data:[],error:null};}
  })}};
 }
 const handle=makeHandler((_url,key,options)=>client(key==='service',options?.global?.headers?.Authorization?.slice(7)||dex),key=>key==='SUPABASE_SERVICE_ROLE_KEY'?'service':key==='SUPABASE_URL'?'https://supabase.example':'anon');
 const request=async(path,method='GET',data,actor)=>{const headers={};if(actor)headers.Authorization='Bearer '+actor;const response=await handle(new Request('https://supabase.example/functions/v1/neon-public'+path,{method,headers,...(data?{body:JSON.stringify(data)}:{})}));return {status:response.status,data:await response.json()};};
 return {tables,objects,signed,asset,room,request};
}
test('Ein Gast hört ausschließlich den aktuellen privaten Song über einen kurzlebigen Link, ohne Zugriff auf Sammlung oder Cover',async()=>{
 const f=fixture(),result=await f.request('/listen/'+roomId);
 assert.equal(result.status,200);assert.equal(result.data.track.title,'Private MP3');assert.equal(result.data.track.id,'listen-'+assetId);assert.equal(result.data.position,40);assert.equal(result.data.playing,true);
 assert.deepEqual(Object.keys(result.data.track).sort(),['artist','blobId','duration','id','title']);assert.ok(!JSON.stringify(result.data).includes('never exposed'));assert.deepEqual(f.signed,[{bucket:'nt-listen',path:f.asset.path,ttl:120}]);
 assert.equal((await f.request('/listen/'+'b'.repeat(64))).status,410);f.room.expires_at=new Date(Date.now()-1000).toISOString();assert.equal((await f.request('/listen/'+roomId)).status,410);assert.equal(f.signed.length,1);
});
test('Der bestehende öffentliche Band-Mithörweg und Albumweg bleiben verfügbar',async()=>{
 const f=fixture();f.room.local_asset_id=null;f.room.track_id='band';const result=await f.request('/listen/'+roomId);assert.equal(result.status,200);assert.equal(result.data.track.id,'band');assert.equal(f.signed[0].bucket,'nt-media');
 f.tables.nt_releases.push({id:'release',data:{album:{id:'release'},tracks:[]},asset_paths:[]});assert.equal((await f.request('/album/release')).status,200);
});
test('Abgelaufene oder nicht zum Gastgeber gehörende lokale Quellen werden Gästen nicht signiert',async()=>{
 const f=fixture();f.asset.owner_id=nix;assert.equal((await f.request('/listen/'+roomId)).status,410);assert.equal(f.signed.length,0);f.asset.owner_id=dex;f.asset.expires_at=new Date(Date.now()-1).toISOString();assert.equal((await f.request('/listen/'+roomId)).status,410);assert.equal(f.signed.length,0);
});
test('Reservieren und Steuern erfordern eine verifizierte Bandidentität; Fremdquellen und unvollständige Uploads werden abgewiesen',async()=>{
 const f=fixture(),input={trackId:'mine',title:'Mine',artist:'Dex',duration:200,byteSize:9,owner_id:nix,path:'foreign/file.mp3'};
 assert.equal((await f.request('/listen-media','POST',input)).status,401);assert.equal((await f.request('/listen-media','POST',input,'expired')).status,401);assert.equal((await f.request('/listen-media','POST',input,'outsider')).status,403);
 const reserved=await f.request('/listen-media','POST',input,dex);assert.equal(reserved.status,201);assert.ok(reserved.data.path.startsWith(dex+'/'));assert.ok(!reserved.data.path.includes('foreign'));
 const player={trackId:'mine',private:true,localAssetId:reserved.data.id,position:50,playing:true};assert.equal((await f.request('/listen','POST',player,dex)).status,400);
 assert.equal((await f.request('/listen','POST',{trackId:'local-one',private:true,localAssetId:assetId,position:0,playing:true},nix)).status,403);
 assert.equal((await f.request('/listen/'+roomId,'PATCH',{trackId:'local-one',localAssetId:assetId,position:0,playing:true},nix)).status,410);
 const row=f.tables.nt_listen_assets.find(a=>a.id===reserved.data.id);f.objects.set('nt-listen/'+row.path,{name:row.id+'.mp3',metadata:{size:9,mimetype:'audio/mpeg'}});
 const created=await f.request('/listen','POST',player,dex);assert.equal(created.status,201);assert.ok(created.data.url.startsWith('https://band.example/album.html?room='));
 assert.equal((await f.request('/listen/'+created.data.id,'PATCH',{...player,position:82,playing:false},dex)).status,200);const guest=await f.request('/listen/'+created.data.id);assert.equal(guest.data.position,82);assert.equal(guest.data.playing,false);
});
test('Beenden entfernt nur die temporäre Kopie; abgelaufene Reservierungen werden beim nächsten Start bereinigt',async()=>{
 const f=fixture(),original=structuredClone(f.tables.nt_catalog);assert.equal((await f.request('/listen/'+roomId,'DELETE',null,dex)).status,200);assert.equal(f.tables.nt_rooms.length,0);assert.equal(f.tables.nt_listen_assets.length,0);assert.equal(f.objects.size,0);assert.deepEqual(f.tables.nt_catalog,original);
 const g=fixture();g.asset.expires_at=new Date(Date.now()-10000).toISOString();g.room.expires_at=new Date(Date.now()-1000).toISOString();
 assert.equal((await g.request('/listen-media','POST',{trackId:'next',title:'Next',artist:'Dex',duration:60,byteSize:10},dex)).status,201);assert.ok(!g.tables.nt_listen_assets.some(a=>a.id===assetId));assert.equal(g.objects.size,0);assert.equal(g.tables.nt_rooms.length,0);
});
test('Eingaben können keine beliebigen Speicherpfade, Besitzer oder ungültigen Wiedergabewerte einschleusen',()=>{
 const valid={trackId:'one',title:'One',artist:'Dex',duration:180,byteSize:100};
 assert.deepEqual(Object.keys(localInput({...valid,path:'/etc/passwd',owner_id:nix})).sort(),['artist','byte_size','duration','title','track_id']);
 for(const patch of [{byteSize:50331649},{byteSize:1.2},{duration:Infinity},{title:''},{trackId:'../private'},{artist:'x'.repeat(161)}])assert.throws(()=>localInput({...valid,...patch}));
 assert.throws(()=>playerInput({trackId:'one',position:0,playing:true,private:true}));assert.throws(()=>playerInput({trackId:'one',position:0,playing:true,localAssetId:'bad'}));
 assert.equal(safePublicBase('https://user:pass@evil.example'),'');assert.equal(safePublicBase('https://band.example/'),'https://band.example');
});
