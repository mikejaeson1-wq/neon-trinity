const fail=(message,status=400,extra={})=>Object.assign(new Error(message),{status,...extra});
const check=r=>{if(r.error)throw fail('Die Hörsession konnte nicht gelesen oder gespeichert werden.',500);return r.data;};
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
export const tokenHash=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value))));
export async function codeHash(code,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(code),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
const token=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const equal=(a,b)=>{if(typeof a!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
async function body(req){const raw=await req.text();if(raw.length>16384)throw fail('Die Anfrage ist zu groß.',413);try{return JSON.parse(raw);}catch{throw fail('Ungültige JSON-Anfrage.');}}
const empty=()=>({mode:'link',code_hash:'',code_salt:'',invited_discord_ids:[],revision:null});
export async function preferences(db,owner){return check(await db.from('nt_listen_preferences').select('*').eq('owner_id',owner).maybeSingle())||empty();}
export async function settings(db,room){return check(await db.from('nt_room_settings').select('*').eq('room_id',room.id).maybeSingle())||empty();}
const publicSettings=s=>({mode:s.mode,codeConfigured:!!s.code_hash,invitedDiscordIds:s.invited_discord_ids||[]});
async function inputSettings(input,current){
 if(!['link','code','invite'].includes(input?.mode))throw fail('Bitte eine gültige Hörraum-Freigabe wählen.');
 const invited=Array.isArray(input.invitedDiscordIds)?[...new Set(input.invitedDiscordIds)]:[];if(invited.length>50||invited.some(id=>typeof id!=='string'||!/^\d{16,22}$/.test(id)))throw fail('Bitte gültige Discord-Benutzer-IDs eingeben.');
 let hash='',salt='';if(input.mode==='code'){const code=String(input.code||'').trim();if(code){if(code.length<8||code.length>80)throw fail('Der Zugangscode muss 8 bis 80 Zeichen haben.');salt=crypto.randomUUID().replaceAll('-','');hash=await codeHash(code,salt);}else if(current?.code_hash){hash=current.code_hash;salt=current.code_salt;}else throw fail('Bitte zuerst einen Zugangscode festlegen.');}
 if(input.mode==='invite'&&!invited.length)throw fail('Bitte mindestens ein Discord-Konto einladen.');return {mode:input.mode,code_hash:hash,code_salt:salt,invited_discord_ids:invited,revision:crypto.randomUUID()};
}
export async function installPreferences(db,room,owner){const p=await preferences(db,owner);check(await db.from('nt_room_settings').insert({room_id:room,mode:p.mode,code_hash:p.code_hash,code_salt:p.code_salt,invited_discord_ids:p.invited_discord_ids,revision:p.revision||crypto.randomUUID()}));}
export async function authorizeRoom(req,db,room,authenticate){
 const s=await settings(db,room);if(s.mode==='link')return s;
 const ticket=req.headers.get('x-listen-ticket')||'';if(/^[a-f0-9]{64}$/.test(ticket)){const grant=check(await db.from('nt_room_grants').select('token_hash').eq('room_id',room.id).eq('revision',s.revision).eq('token_hash',await tokenHash(ticket)).gt('expires_at',new Date().toISOString()).maybeSingle());if(grant)return s;}
 if(req.headers.get('Authorization')){try{const {actor}=await authenticate(false);if(actor.id===room.host_id)return s;}catch{}}
 throw fail(s.mode==='code'?'Dieser Hörraum benötigt einen Zugangscode.':'Dieser Hörraum ist für eingeladene Discord-Konten.',403,{accessMode:s.mode});
}
export async function listeners(db,room){
 const now=new Date().toISOString();check(await db.from('nt_room_guests').delete().eq('room_id',room.id).lt('expires_at',now));
 const rows=check(await db.from('nt_room_guests').select('display_name,listening').eq('room_id',room.id).gt('expires_at',now).limit(100));return rows.map(r=>({name:r.display_name,listening:r.listening===true}));
}
async function requireGuest(req,db,room,id){
 const secret=req.headers.get('x-listen-guest')||'';if(!uuid(id)||!/^[a-f0-9]{64}$/.test(secret))throw fail('Bitte das Mithören erneut starten.',410,{errorCode:'guest-expired'});
 const row=check(await db.from('nt_room_guests').select('*').eq('room_id',room.id).eq('id',id).gt('expires_at',new Date().toISOString()).maybeSingle());if(!row||!equal(row.token_hash,await tokenHash(secret)))throw fail('Bitte das Mithören erneut starten.',410,{errorCode:'guest-expired'});return row;
}
async function catalog(db,room){
 const releases=check(await db.from('nt_releases').select('data')),all=releases.flatMap(r=>r.data?.tracks||[]);
 if(!room.local_asset_id){const data=check(await db.from('nt_catalog').select('data').eq('id',1).single()).data;const current=data.tracks.find(t=>t.id===room.track_id);if(current)all.unshift(current);}
 return [...new Map(all.filter(t=>t&&typeof t.id==='string').map(t=>[t.id,{id:t.id,title:String(t.title||'').slice(0,160),artist:String(t.artist||'Neon Trinity').slice(0,160)}])).values()].slice(0,500);
}
export async function roomRoute({req,parts,db,authenticate}){
 if(parts[0]==='listen-preferences'&&parts.length===1){
  const {actor}=await authenticate(true);if(req.method==='GET')return {data:publicSettings(await preferences(db,actor.id))};
  if(req.method!=='PATCH')throw fail('Diese Anfrage wird nicht unterstützt.',405);const input=await body(req),value=await inputSettings(input,await preferences(db,actor.id));
  if(input.roomId){if(!/^[a-f0-9]{64}$/.test(input.roomId))throw fail('Ungültiger Hörraum.');const room=check(await db.from('nt_rooms').select('id').eq('id',input.roomId).eq('host_id',actor.id).gt('expires_at',new Date().toISOString()).maybeSingle());if(!room)throw fail('Nur der Gastgeber kann diesen Hörraum ändern.',403);check(await db.from('nt_room_settings').upsert({room_id:room.id,...value}));check(await db.from('nt_room_grants').delete().eq('room_id',room.id));}
  check(await db.from('nt_listen_preferences').upsert({owner_id:actor.id,...value}));return {data:publicSettings(value)};
 }
 if(parts[0]!=='listen'||parts.length!==3)return null;const [,id,action]=parts;if(!/^[a-f0-9]{64}$/.test(id))throw fail('Ungültiger Hörraum.',404);
 const room=check(await db.from('nt_rooms').select('*').eq('id',id).gt('expires_at',new Date().toISOString()).maybeSingle());if(!room)throw fail('Diese Hörsession wurde beendet oder ist abgelaufen.',410);
 if(action==='status'||action==='requests'){
  const {actor}=await authenticate(true);if(actor.id!==room.host_id)throw fail('Nur der Gastgeber kann diese Hörsession verwalten.',403);
  if(action==='requests'&&req.method==='PATCH'){const input=await body(req);if(!uuid(input.id)||!['approved','declined'].includes(input.status))throw fail('Ungültiger Songwunsch.');check(await db.from('nt_room_requests').update({status:input.status}).eq('id',input.id).eq('room_id',id).eq('status','pending'));return {data:{ok:true}};}
  if(req.method!=='GET')throw fail('Diese Anfrage wird nicht unterstützt.',405);const people=await listeners(db,room),requests=check(await db.from('nt_room_requests').select('id,guest_id,track_id,created_at').eq('room_id',id).eq('status','pending').order('created_at').limit(50));const guests=check(await db.from('nt_room_guests').select('id,display_name').eq('room_id',id));return {data:{listeners:people,requests:requests.map(r=>({id:r.id,trackId:r.track_id,name:guests.find(g=>g.id===r.guest_id)?.display_name||'Gast',at:r.created_at})),settings:publicSettings(await settings(db,room))}};
 }
 if(action==='access'&&req.method==='POST'){
  const s=await settings(db,room),input=await body(req);if(s.mode==='link')return {data:{ok:true}};
  let renewed=false;if(input.renew===true){await authorizeRoom(req,db,room,authenticate);renewed=true;}
  if(!renewed&&s.mode==='code'){if(typeof input.code!=='string'||input.code.trim().length>80||!equal(s.code_hash,await codeHash(input.code.trim(),s.code_salt)))throw fail('Der Zugangscode stimmt nicht.',403,{accessMode:'code'});}
  else if(!renewed) {const {actor}=await authenticate(false);if(actor.id!==room.host_id&&!s.invited_discord_ids.includes(String(actor.discordId||'')))throw fail('Dieses Discord-Konto ist nicht eingeladen.',403,{accessMode:'invite'});}
  const accessToken=token(),expiresAt=Date.now()+10*60000;check(await db.from('nt_room_grants').insert({token_hash:await tokenHash(accessToken),room_id:id,revision:s.revision,expires_at:new Date(expiresAt).toISOString()}));return {data:{accessToken,expiresAt}};
 }
 await authorizeRoom(req,db,room,authenticate);
 if(action==='catalog'&&req.method==='GET')return {data:{tracks:await catalog(db,room)}};
 if(action==='guest'&&req.method==='POST'){
  const input=await body(req),name=String(input.name||'Gast').trim();if(!name||name.length>60)throw fail('Bitte einen Anzeigenamen bis 60 Zeichen wählen.');
  if(input.id){const guest=await requireGuest(req,db,room,input.id);check(await db.from('nt_room_guests').update({display_name:name,listening:input.listening===true,updated_at:new Date().toISOString(),expires_at:new Date(Date.now()+45000).toISOString()}).eq('id',guest.id).eq('room_id',id));return {data:{id:guest.id}};}
  const people=await listeners(db,room);if(people.length>=100)throw fail('Dieser Hörraum ist gerade voll.',429);const secret=token(),guest=check(await db.from('nt_room_guests').insert({room_id:id,token_hash:await tokenHash(secret),display_name:name,listening:input.listening===true,updated_at:new Date().toISOString(),expires_at:new Date(Date.now()+45000).toISOString()}).select('id').single());return {data:{id:guest.id,guestToken:secret},status:201};
 }
 if(action==='request'&&req.method==='POST'){
  const input=await body(req),guest=await requireGuest(req,db,room,input.guestId),tracks=await catalog(db,room);if(!tracks.some(t=>t.id===input.trackId))throw fail('Bitte einen freigegebenen Band-Song auswählen.');
  const pending=check(await db.from('nt_room_requests').select('id').eq('room_id',id).eq('guest_id',guest.id).eq('status','pending').limit(5));if(pending.length>=5)throw fail('Bitte erst die Antwort auf deine bisherigen Songwünsche abwarten.',429);
  check(await db.from('nt_room_requests').insert({room_id:id,guest_id:guest.id,track_id:input.trackId}));return {data:{ok:true},status:201};
 }
 throw fail('Unbekannte Hörraum-Anfrage.',404);
}
