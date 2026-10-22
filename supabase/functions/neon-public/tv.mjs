const error=(message,status=400)=>Object.assign(new Error(message),{status});
const checked=r=>{if(r.error)throw error('Der TV-Dienst ist gerade nicht erreichbar.',500);return r.data;};
export const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
const token=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
async function body(req){const text=await req.text();if(text.length>4096)throw error('Anfrage zu groß.',413);try{return JSON.parse(text);}catch{throw error('Ungültige Anfrage.');}}
export async function tvRoute({req,parts,db,authenticate}){
 if(parts[0]!=='tv')return null;if(req.method!=='POST')throw error('Diese TV-Anfrage benötigt POST.',405);const input=await body(req),action=parts[1],now=new Date().toISOString();
 if(action==='pair'){
  checked(await db.from('nt_tv_pairs').delete().lt('expires_at',now));const count=await db.from('nt_tv_pairs').select('id',{count:'exact',head:true}).is('owner_id',null);if(count.error)checked(count);if(count.count>=100)throw error('Bitte die TV-Anmeldung später erneut versuchen.',429);
  const device=token(),approval=token(),row=checked(await db.from('nt_tv_pairs').insert({device_hash:await hash(device),approval_hash:await hash(approval)}).select('id,expires_at').single());return {id:row.id,device,approval,expiresAt:row.expires_at};
 }
 if(!/^[a-f0-9-]{36}$/.test(input.id||''))throw error('Ungültige TV-Anmeldung.');
 if(action==='approve'){
  const {actor}=await authenticate(true);if(!/^[a-f0-9]{64}$/.test(input.approval||''))throw error('Ungültige Bestätigung.');const row=checked(await db.from('nt_tv_pairs').update({owner_id:actor.id,owner_alias:actor.alias,expires_at:new Date(Date.now()+30*86400000).toISOString()}).eq('id',input.id).eq('approval_hash',await hash(input.approval)).is('owner_id',null).gt('expires_at',now).select('id').maybeSingle());if(!row)throw error('Die TV-Anmeldung wurde bereits verwendet oder ist abgelaufen.',410);return {ok:true};
 }
 if(!/^[a-f0-9]{64}$/.test(input.device||''))throw error('Ungültiger Geräteschlüssel.',401);
 const pair=checked(await db.from('nt_tv_pairs').select('*').eq('id',input.id).eq('device_hash',await hash(input.device)).gt('expires_at',now).maybeSingle());if(!pair)throw error('Die TV-Anmeldung ist abgelaufen. Bitte erneut verbinden.',401);
 if(action==='logout'){checked(await db.from('nt_tv_pairs').delete().eq('id',pair.id));return {ok:true};}
 if(!pair.owner_id)return {pending:true};if(!checked(await db.rpc('nt_tv_member',{target:pair.owner_id})))throw error('Der Bandzugang dieses Kontos wurde beendet.',403);
 if(action==='catalog'){
  const catalog=checked(await db.from('nt_catalog').select('data').eq('id',1).single()).data,grants=checked(await db.from('nt_song_grants').select('id,song_id,expires_at').eq('recipient_id',pair.owner_id).or('expires_at.is.null,expires_at.gt.'+now));
  const songs=grants.length?checked(await db.from('nt_personal_songs').select('id,title,artist,duration').in('id',grants.map(g=>g.song_id))):[];
  return {alias:pair.owner_alias,tracks:catalog.tracks.map(t=>({id:t.id,title:t.title,artist:t.artist,duration:t.duration,source:'band'})).concat(songs.map(s=>({...s,id:'shared-'+s.id,source:'shared'}))),albums:catalog.albums.map(a=>({id:a.id,title:a.title,trackIds:a.trackIds})),playlists:catalog.playlists.map(p=>({id:p.id,title:p.title,trackIds:p.trackIds}))};
 }
 if(action==='media'){
  let bucket='nt-media',path;
  if(String(input.track).startsWith('shared-')){const id=input.track.slice(7);if(!/^[a-f0-9-]{36}$/.test(id))throw error('Ungültiger Song.');const grant=checked(await db.from('nt_song_grants').select('id').eq('song_id',id).eq('recipient_id',pair.owner_id).or('expires_at.is.null,expires_at.gt.'+now).maybeSingle());if(!grant)throw error('Diese private Freigabe wurde beendet.',403);const song=checked(await db.from('nt_personal_songs').select('owner_id').eq('id',id).single());bucket='nt-personal-shares';path=song.owner_id+'/'+id+'.mp3';}
  else{const data=checked(await db.from('nt_catalog').select('data').eq('id',1).single()).data,t=data.tracks.find(t=>t.id===input.track),asset=t&&data.assets.find(a=>a.id===t.blobId&&a.provider==='supabase');if(!asset)throw error('Song nicht verfügbar.',404);path=asset.path;}
  return {url:checked(await db.storage.from(bucket).createSignedUrl(path,60)).signedUrl};
 }
 throw error('Unbekannte TV-Anfrage.',404);
}
