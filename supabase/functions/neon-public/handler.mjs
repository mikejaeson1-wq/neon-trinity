import {roomRoute,authorizeRoom,listeners,installPreferences} from './rooms.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-listen-ticket, x-listen-guest','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
const error=(message,status=400)=>Object.assign(new Error(message),{status});
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(id);
const roomId=id=>/^[a-f0-9]{64}$/.test(id);
const uuid=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
const check=r=>{if(r.error)throw error('Die Daten konnten nicht gelesen oder gespeichert werden.',500);return r.data;};
export function safePublicBase(value){try{const u=new URL(String(value));if(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash)return u.href.replace(/\/$/,'');}catch{}return '';}
export function playerInput(input){
 if(!validId(input?.trackId)||!Number.isFinite(input.position)||input.position<0||input.position>86400||typeof input.playing!=='boolean'||input.localAssetId!=null&&!uuid(input.localAssetId)||input.private&&!input.localAssetId)throw error('Ungültiger Wiedergabestatus.');
 return {track_id:input.trackId,local_asset_id:input.localAssetId||null,position:input.position,playing:input.playing,updated_at:new Date().toISOString(),expires_at:new Date(Date.now()+90000).toISOString()};
}
export function localInput(input){
 if(!validId(input?.trackId)||typeof input.title!=='string'||!input.title.trim()||input.title.length>160||typeof input.artist!=='string'||!input.artist.trim()||input.artist.length>160||!Number.isFinite(input.duration)||input.duration<=0||input.duration>86400||!Number.isInteger(input.byteSize)||input.byteSize<1||input.byteSize>50331648)throw error('Ungültige lokale MP3.');
 return {track_id:input.trackId,title:input.title.trim(),artist:input.artist.trim(),duration:input.duration,byte_size:input.byteSize};
}
async function body(req){const raw=await req.text();if(raw.length>4096)throw error('Die Anfrage ist zu groß.',413);try{return JSON.parse(raw);}catch{throw error('Ungültige JSON-Anfrage.');}}
async function removeAsset(db,asset){
 check(await db.storage.from('nt-listen').remove([asset.path]));
 check(await db.from('nt_listen_assets').delete().eq('id',asset.id).eq('owner_id',asset.owner_id));
}
async function cleanupExpired(db,owner){
 const now=new Date().toISOString();
 check(await db.from('nt_rooms').delete().eq('host_id',owner).lt('expires_at',now));
 const expired=check(await db.from('nt_listen_assets').select('id,path,owner_id').eq('owner_id',owner).lt('expires_at',now).limit(16));
 const active=check(await db.from('nt_rooms').select('local_asset_id').eq('host_id',owner).gt('expires_at',now));
 const used=new Set(active.map(r=>r.local_asset_id));for(const asset of expired)if(!used.has(asset.id))await removeAsset(db,asset);
}
export function makeHandler(createClient,env){
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:cors,status:204});
  try{
   const base=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY'),anon=env('SUPABASE_ANON_KEY');
   const db=createClient(base,service,{auth:{persistSession:false,autoRefreshToken:false}});
   const url=new URL(req.url),path=url.pathname.split('/neon-public')[1]||'/',parts=path.split('/').filter(Boolean);
   if(path==='/health'&&req.method==='GET')return response({service:'neon-trinity-supabase',ready:true,privateListening:true});
   if(parts[0]==='album'&&parts.length===2&&validId(parts[1])&&req.method==='GET'){
    const release=check(await db.from('nt_releases').select('data,asset_paths').eq('id',parts[1]).maybeSingle());
    if(!release)throw error('Dieses Album ist nicht veröffentlicht.',404);
    const signed=release.asset_paths.length?check(await db.storage.from('nt-media').createSignedUrls(release.asset_paths,300)):[];
    const urls=Object.fromEntries(signed.map(r=>[r.path,r.signedUrl]));return response({...release.data,urls});
   }
   let authenticated=null;
   const authenticate=async(member=true)=>{
    if(!authenticated){const authorization=req.headers.get('Authorization')||'';if(!authorization.startsWith('Bearer '))throw error('Bitte zuerst mit Discord anmelden.',401);
     const userDb=createClient(base,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}}),userResult=await userDb.auth.getUser();if(userResult.error||!userResult.data.user)throw error('Die Anmeldung ist abgelaufen.',401);
     const actorResult=await userDb.rpc('nt_identity');if(actorResult.error||!actorResult.data?.id)throw error('Das Discord-Konto konnte nicht geprüft werden.',403);authenticated={actor:actorResult.data,userDb};}
    if(member&&!authenticated.actor.allowed)throw error('Dieses Discord-Konto ist nicht für die Band freigeschaltet.',403);return authenticated;
   };
   const extended=await roomRoute({req,parts,db,authenticate});if(extended)return response(extended.data,extended.status||200);
   const mediaRoute=parts[0]==='listen-media';
   if(!['listen','listen-media'].includes(parts[0])||parts.length>2)throw error('Unbekannte Anfrage.',404);
   const id=parts[1];if(id&&!(mediaRoute?uuid(id):roomId(id)))throw error('Ungültiger Hörlink.',404);
   if(!mediaRoute&&req.method==='GET'&&id){
    const room=check(await db.from('nt_rooms').select('*').eq('id',id).gt('expires_at',new Date().toISOString()).maybeSingle());
    if(!room)throw error('Diese Hörsession wurde beendet oder ist abgelaufen.',410);
    await authorizeRoom(req,db,room,authenticate);
    let track,path,bucket='nt-media';
    if(room.local_asset_id){
     const asset=check(await db.from('nt_listen_assets').select('*').eq('id',room.local_asset_id).eq('owner_id',room.host_id).eq('track_id',room.track_id).gt('expires_at',new Date().toISOString()).maybeSingle());
     if(!asset)throw error('Die Freigabe des lokalen Songs ist abgelaufen.',410);
     track={id:'listen-'+asset.id,blobId:'listen-'+asset.id,title:asset.title,artist:asset.artist,duration:asset.duration};path=asset.path;bucket='nt-listen';
    }else{
     const catalog=check(await db.from('nt_catalog').select('data').eq('id',1).single()).data;
     const song=catalog.tracks.find(t=>t.id===room.track_id),asset=catalog.assets.find(a=>a.id===song?.blobId&&a.provider==='supabase');
     if(!song||!asset)throw error('Der aktuelle Song ist nicht mehr verfügbar.',410);
     track={id:song.id,blobId:song.blobId,title:song.title,artist:song.artist,duration:song.duration};path=asset.path;
    }
    const signed=check(await db.storage.from(bucket).createSignedUrl(path,120));
    return response({id:room.id,host:room.host_alias,track,mediaUrl:signed.signedUrl,position:room.position,playing:room.playing,updatedAt:new Date(room.updated_at).getTime(),serverTime:Date.now(),listeners:await listeners(db,room)});
   }
   const {actor,userDb}=await authenticate(true);
   if(req.method==='POST'||req.method==='DELETE')await cleanupExpired(db,actor.id);
   if(mediaRoute){
    if(req.method==='POST'&&!id){
     const input=localInput(await body(req));
     const pending=check(await userDb.from('nt_listen_assets').select('id').gt('expires_at',new Date().toISOString()).limit(8));
     if(pending.length>=8)throw error('Bitte zuerst die vorherige Mithörfreigabe beenden.',429);
     const asset=check(await userDb.from('nt_listen_assets').insert(input).select('id,path').single());
     return response(asset,201);
    }
    if(req.method==='DELETE'&&id){
     const asset=check(await userDb.from('nt_listen_assets').select('id,path,owner_id').eq('id',id).eq('owner_id',actor.id).maybeSingle());
     if(asset)await removeAsset(db,asset);return response({ok:true});
    }
    throw error('Diese Anfrage wird nicht unterstützt.',405);
   }
   if(req.method==='DELETE'&&id){
    const room=check(await userDb.from('nt_rooms').select('local_asset_id').eq('id',id).eq('host_id',actor.id).maybeSingle());
    check(await userDb.from('nt_rooms').delete().eq('id',id).eq('host_id',actor.id));
    if(room?.local_asset_id){const asset=check(await userDb.from('nt_listen_assets').select('id,path,owner_id').eq('id',room.local_asset_id).maybeSingle());if(asset)await removeAsset(db,asset);}
    return response({ok:true});
   }
   if(!['POST','PATCH'].includes(req.method))throw error('Diese Anfrage wird nicht unterstützt.',405);
   const input=await body(req),player=playerInput(input);
   let previous=null;
   if(req.method==='PATCH'&&id){
    previous=check(await userDb.from('nt_rooms').select('local_asset_id').eq('id',id).eq('host_id',actor.id).gt('expires_at',new Date().toISOString()).maybeSingle());
    if(!previous)throw error('Die Hörsession ist beendet oder gehört einem anderen Gastgeber.',410);
   }
   if(player.local_asset_id){
    const asset=check(await userDb.from('nt_listen_assets').select('*').eq('id',player.local_asset_id).eq('owner_id',actor.id).eq('track_id',player.track_id).gt('expires_at',new Date().toISOString()).maybeSingle());
    if(!asset)throw error('Dieser lokale Song ist für dein Konto nicht freigegeben.',403);
    if(previous?.local_asset_id!==asset.id){
     const objects=check(await db.storage.from('nt-listen').list(actor.id,{search:asset.id+'.mp3',limit:2}));
     const object=objects.find(o=>o.name===asset.id+'.mp3');
     if(!object||Number(object.metadata?.size)!==Number(asset.byte_size)||object.metadata?.mimetype!=='audio/mpeg')throw error('Bitte die lokale MP3 zuerst vollständig hochladen.');
    }
    check(await db.from('nt_listen_assets').update({expires_at:new Date(Date.now()+15*60000).toISOString()}).eq('id',asset.id).eq('owner_id',actor.id));
   }else{
    const catalog=check(await userDb.from('nt_catalog').select('data').eq('id',1).single()).data;
    if(!catalog.tracks.some(t=>t.id===player.track_id))throw error('Dieser Song ist noch nicht in der gemeinsamen Mediathek.');
   }
   if(req.method==='POST'&&!id){
    const config=check(await db.from('nt_config').select('public_base').eq('id',1).single());
    const publicBase=safePublicBase(config.public_base);if(!publicBase)throw error('Die öffentliche Website-Adresse fehlt.',500);
    const room=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
    check(await userDb.from('nt_rooms').insert({id:room,host_id:actor.id,host_alias:actor.alias,...player}));
    try{await installPreferences(db,room,actor.id);}catch(e){await userDb.from('nt_rooms').delete().eq('id',room).eq('host_id',actor.id);throw e;}
    return response({id:room,url:publicBase+'/album.html?room='+room,host:actor.alias},201);
   }
   if(req.method==='PATCH'&&id){
    const row=check(await userDb.from('nt_rooms').update(player).eq('id',id).eq('host_id',actor.id).gt('expires_at',new Date().toISOString()).select('id').maybeSingle());
    if(!row)throw error('Diese Hörsession wurde inzwischen beendet.',410);return response({ok:true});
   }
   throw error('Unbekannte Anfrage.',404);
  }catch(e){return response({error:e instanceof Error?e.message:'Die Anfrage ist fehlgeschlagen.',...(e?.accessMode?{accessMode:e.accessMode}:{}),...(e?.errorCode?{errorCode:e.errorCode}:{})},Number(e?.status)||500);}
 };
}
