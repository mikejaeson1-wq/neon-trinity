import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
const error=(message:string,status=400)=>Object.assign(new Error(message),{status});
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const validId=(id:unknown)=>typeof id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(id);
const roomId=(id:string)=>/^[a-f0-9]{64}$/.test(id);
const check=(r:any)=>{if(r.error)throw error('Die Daten konnten nicht gelesen oder gespeichert werden.',500);return r.data;};
export function safePublicBase(value:unknown){try{const u=new URL(String(value));if(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash)return u.href.replace(/\/$/,'');}catch{}return '';}
export function playerInput(input:any){if(!validId(input?.trackId)||!Number.isFinite(input.position)||input.position<0||input.position>86400||typeof input.playing!=='boolean')throw error('Ungültiger Wiedergabestatus.');return {track_id:input.trackId,position:input.position,playing:input.playing,updated_at:new Date().toISOString(),expires_at:new Date(Date.now()+90000).toISOString()};}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors,status:204});
 try{
  const base=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const db=createClient(base,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const url=new URL(req.url),path=url.pathname.split('/neon-public')[1]||'/',parts=path.split('/').filter(Boolean);
  if(path==='/health'&&req.method==='GET')return response({service:'neon-trinity-supabase',ready:true});
  if(parts[0]==='album'&&parts.length===2&&validId(parts[1])&&req.method==='GET'){
   const release=check(await db.from('nt_releases').select('data,asset_paths').eq('id',parts[1]).maybeSingle());
   if(!release)throw error('Dieses Album ist nicht veröffentlicht.',404);
   const signed=release.asset_paths.length?check(await db.storage.from('nt-media').createSignedUrls(release.asset_paths,300)):[];
   const urls=Object.fromEntries(signed.map((r:any)=>[r.path,r.signedUrl]));
   return response({...release.data,urls});
  }
  if(parts[0]!=='listen'||parts.length>2)throw error('Unbekannte Anfrage.',404);
  const id=parts[1];if(id&&!roomId(id))throw error('Ungültiger Hörlink.',404);
  if(req.method==='GET'&&id){
   const room=check(await db.from('nt_rooms').select('*').eq('id',id).gt('expires_at',new Date().toISOString()).maybeSingle());
   if(!room)throw error('Diese Hörsession wurde beendet oder ist abgelaufen.',410);
   const catalog=check(await db.from('nt_catalog').select('data').eq('id',1).single()).data;
   const track=catalog.tracks.find((t:any)=>t.id===room.track_id),asset=catalog.assets.find((a:any)=>a.id===track?.blobId&&a.provider==='supabase');
   if(!track||!asset)throw error('Der aktuelle Song ist nicht mehr verfügbar.',410);
   const signed=check(await db.storage.from('nt-media').createSignedUrl(asset.path,120));
   return response({id:room.id,host:room.host_alias,track:{id:track.id,blobId:track.blobId,title:track.title,artist:track.artist,duration:track.duration},mediaUrl:signed.signedUrl,position:room.position,playing:room.playing,updatedAt:new Date(room.updated_at).getTime(),serverTime:Date.now()});
  }
  const authorization=req.headers.get('Authorization')||'';
  if(!authorization.startsWith('Bearer '))throw error('Bitte zuerst mit Discord anmelden.',401);
  const userDb=createClient(base,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const userResult=await userDb.auth.getUser();if(userResult.error||!userResult.data.user)throw error('Die Anmeldung ist abgelaufen.',401);
  const actorResult=await userDb.rpc('nt_identity'),actor=actorResult.data;
  if(actorResult.error||!actor?.allowed)throw error('Dieses Discord-Konto ist nicht für die Band freigeschaltet.',403);
  if(req.method==='DELETE'&&id){check(await userDb.from('nt_rooms').delete().eq('id',id).eq('host_id',actor.id));return response({ok:true});}
  if(!['POST','PATCH'].includes(req.method))throw error('Diese Anfrage wird nicht unterstützt.',405);
  const raw=await req.text();if(raw.length>4096)throw error('Die Anfrage ist zu groß.',413);let input;try{input=JSON.parse(raw);}catch{throw error('Ungültige JSON-Anfrage.');}
  const player=playerInput(input),catalog=check(await userDb.from('nt_catalog').select('data').eq('id',1).single()).data;
  if(!catalog.tracks.some((t:any)=>t.id===player.track_id))throw error('Dieser Song ist noch nicht in der gemeinsamen Mediathek.');
  if(req.method==='POST'&&!id){
   const room=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
   check(await userDb.from('nt_rooms').insert({id:room,host_id:actor.id,host_alias:actor.alias,...player}));
   // Use the shared, administrator-controlled address rather than a visitor-supplied link.
   const config=check(await db.from('nt_config').select('public_base').eq('id',1).single());
   const publicBase=safePublicBase(config.public_base);if(!publicBase)throw error('Die öffentliche Website-Adresse fehlt.',500);
   return response({id:room,url:publicBase+'/album.html?room='+room,host:actor.alias},201);
  }
  if(req.method==='PATCH'&&id){const row=check(await userDb.from('nt_rooms').update(player).eq('id',id).eq('host_id',actor.id).select('id').maybeSingle());if(!row)throw error('Nur der Gastgeber kann diese Hörsession steuern.',403);return response({ok:true});}
  throw error('Unbekannte Anfrage.',404);
 }catch(e){return response({error:e instanceof Error?e.message:'Die Anfrage ist fehlgeschlagen.'},Number((e as any)?.status)||500);}
});
