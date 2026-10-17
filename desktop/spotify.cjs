const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const REDIRECT='http://127.0.0.1:48732/spotify/callback';
const SCOPES='playlist-read-private playlist-read-collaborative user-read-private user-read-playback-state user-modify-playback-state';
const clientId=value=>typeof value==='string'&&/^[a-f0-9]{32}$/i.test(value);
const spotifyId=value=>typeof value==='string'&&/^[A-Za-z0-9]{22}$/.test(value);
const ownerId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
const bounded=(n,max)=>Math.min(max,Math.max(0,Number(n)||0));
function imageURL(value){try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&(/(^|\.)scdn\.co$/.test(u.hostname)||/(^|\.)spotifycdn\.com$/.test(u.hostname)))return u.href;}catch{}return '';}
function apiError(status,body,headers){
 const reason=body?.error?.reason||'',message=status===401?'Spotify-Anmeldung abgelaufen. Bitte erneut verbinden.':status===403?'Spotify hat den Zugriff abgelehnt. Prüfe Premium, die Nutzerfreigabe in der Spotify-App und die Berechtigungen.':status===404?'Kein erreichbarer Spotify-Player. Öffne Spotify auf dem gewünschten Gerät und starte dort einmal Musik.':status===429?'Spotify-Anfragelimit erreicht. Bitte später erneut versuchen.':status>=500?'Spotify ist gerade nicht erreichbar.':'Spotify konnte die Aktion nicht ausführen.';
 return Object.assign(new Error(message),{status,retryAfter:status===429?Math.max(5,Math.min(3600,Number(headers?.get('retry-after'))||30)):0,reason,data:{retryAfter:status===429?Math.max(5,Math.min(3600,Number(headers?.get('retry-after'))||30)):0}});
}
class DesktopSpotify{
 constructor({app,safeStorage,shell,fetchImpl=globalThis.fetch,port=48732,now=()=>Date.now()}){Object.assign(this,{app,safeStorage,shell,fetchImpl,port,now});this.accounts={};this.refreshes=new Map();this.server=null;this.pending=null;this.timer=null;this.writes=Promise.resolve();}
 get file(){return path.join(this.app.getPath('userData'),'spotify-accounts.enc');}
 get redirect(){return `http://127.0.0.1:${this.port}/spotify/callback`;}
 secure(){return this.safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||this.safeStorage.getSelectedStorageBackend()!=='basic_text');}
 account(owner){if(!ownerId(owner))throw new Error('Bitte zuerst mit Discord im Studio anmelden.');return this.accounts[owner]||{};}
 async load(){try{if(this.secure()){const value=JSON.parse(this.safeStorage.decryptString(await fs.readFile(this.file)));if(value?.accounts&&typeof value.accounts==='object')this.accounts=value.accounts;}}catch{}}
 async save(){if(!this.secure())throw new Error('Der sichere Windows-Kennwortspeicher ist nicht verfügbar.');const bytes=this.safeStorage.encryptString(JSON.stringify({accounts:this.accounts}));this.writes=this.writes.catch(()=>{}).then(async()=>{await fs.mkdir(this.app.getPath('userData'),{recursive:true});const temp=this.file+'.tmp';await fs.writeFile(temp,bytes,{mode:0o600});await fs.rename(temp,this.file);});return this.writes;}
 status(owner){const a=this.account(owner);return {clientId:a.clientId||'',connected:!!(a.refreshToken||a.accessToken),profile:a.profile||null,redirectUri:this.redirect};}
 async configure(owner,id){if(!clientId(id))throw new Error('Die Spotify Client-ID muss aus 32 Zeichen (0–9, a–f) bestehen.');const old=this.account(owner);if(old.clientId!==id){await this.cancelLogin();this.accounts[owner]={clientId:id};await this.save();}return this.status(owner);}
 async cancelLogin(){clearTimeout(this.timer);this.timer=null;const server=this.server;this.server=null;this.pending=null;if(server){server.closeAllConnections();await new Promise(resolve=>server.close(()=>resolve()));}}
 async startLogin(owner,id){
  await this.configure(owner,id);await this.cancelLogin();if(!this.secure())throw new Error('Der sichere Windows-Kennwortspeicher ist nicht verfügbar.');
  const verifier=crypto.randomBytes(48).toString('base64url'),state=crypto.randomBytes(32).toString('hex');this.pending={owner,id,verifier,state,status:'pending'};
  this.server=http.createServer((req,res)=>{
   const url=new URL(req.url,this.redirect);if(req.method!=='GET'||req.headers.host!==`127.0.0.1:${this.port}`||url.pathname!=='/spotify/callback'||url.searchParams.get('state')!==this.pending?.state||this.pending.status!=='pending'){res.writeHead(404);res.end('Not found');return;}
   const code=url.searchParams.get('code');if(code&&code.length<4096){this.pending.code=code;this.pending.status='ready';}else{this.pending.status='error';this.pending.error='Die Spotify-Anmeldung wurde abgebrochen oder abgelehnt.';}
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});res.end('<!doctype html><html lang="de"><meta charset="utf-8"><title>Neon Trinity · Spotify</title><h1>Zurück zum Studio</h1><p>Du kannst dieses Fenster schließen und zum Neon Trinity Studio zurückkehren.</p></html>');clearTimeout(this.timer);this.server?.close();this.server=null;
  });
  try{await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(this.port,'127.0.0.1',resolve);});if(this.port===0)this.port=this.server.address().port;}catch(e){this.server=null;this.pending=null;throw new Error(e.code==='EADDRINUSE'?'Der lokale Spotify-Anmeldeport ist belegt. Bitte das andere Anmeldefenster schließen.':'Das Spotify-Anmeldefenster konnte nicht geöffnet werden.');}
  this.timer=setTimeout(()=>{this.cancelLogin().catch(()=>{});},180000);this.timer.unref?.();
  const url=new URL('https://accounts.spotify.com/authorize');url.search=new URLSearchParams({client_id:id,response_type:'code',redirect_uri:this.redirect,state,scope:SCOPES,code_challenge_method:'S256',code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),show_dialog:'true'}).toString();
  try{await this.shell.openExternal(url.href);}catch(e){await this.cancelLogin();throw new Error('Spotify konnte nicht im Browser geöffnet werden.');}return {status:'pending'};
 }
 async token(fields){const response=await this.fetchImpl('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields),redirect:'error',signal:AbortSignal.timeout(15000)});const value=await response.json().catch(()=>({}));if(!response.ok)throw apiError(response.status,value,response.headers);if(typeof value.access_token!=='string'||value.access_token.length>10000||!Number.isFinite(value.expires_in)||value.expires_in<=0||value.token_type?.toLowerCase()!=='bearer')throw new Error('Spotify hat ungültige Sitzungsdaten geliefert.');return value;}
 async pollLogin(owner){
  const p=this.pending;if(!p||p.owner!==owner)throw new Error('Bitte die Spotify-Anmeldung erneut starten.');if(p.status==='error'){await this.cancelLogin();throw new Error(p.error);}if(p.status==='pending')return {status:'pending'};if(p.task)return p.task;
  p.task=(async()=>{const value=await this.token({grant_type:'authorization_code',client_id:p.id,redirect_uri:this.redirect,code:p.code,code_verifier:p.verifier});if(this.pending!==p)throw new Error('Die Spotify-Anmeldung wurde beendet.');this.accounts[owner]={clientId:p.id,accessToken:value.access_token,refreshToken:value.refresh_token,expiresAt:this.now()+value.expires_in*1000};await this.save();this.pending=null;await this.profile(owner);return {status:'ready',...this.status(owner)};})();return p.task;
 }
 async access(owner,force=false){
  const a=this.account(owner);if(!force&&a.accessToken&&a.expiresAt>this.now()+30000)return a.accessToken;if(!a.refreshToken)throw Object.assign(new Error('Bitte dein Spotify-Konto verbinden.'),{status:401});if(this.refreshes.has(owner))return this.refreshes.get(owner);
  const task=(async()=>{let value;try{value=await this.token({grant_type:'refresh_token',client_id:a.clientId,refresh_token:a.refreshToken});}catch(e){if([400,401].includes(e.status)&&this.accounts[owner]===a){this.accounts[owner]={clientId:a.clientId};await this.save();}throw e;}if(this.accounts[owner]!==a)throw new Error('Die Spotify-Verbindung wurde inzwischen getrennt.');Object.assign(a,{accessToken:value.access_token,refreshToken:value.refresh_token||a.refreshToken,expiresAt:this.now()+value.expires_in*1000});await this.save();return a.accessToken;})();this.refreshes.set(owner,task);try{return await task;}finally{if(this.refreshes.get(owner)===task)this.refreshes.delete(owner);}
 }
 async api(owner,endpoint,method='GET',body,retry=true){
  if(typeof endpoint!=='string'||!/^\/(me(?:\/|\?|$)|playlists\/)/.test(endpoint)||endpoint.includes('..'))throw new Error('Ungültige Spotify-Anfrage.');
  const token=await this.access(owner),response=await this.fetchImpl('https://api.spotify.com/v1'+endpoint,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(response.status===204)return null;const data=await response.json().catch(()=>({}));if(response.status===401&&retry){await this.access(owner,true);return this.api(owner,endpoint,method,body,false);}if(!response.ok)throw apiError(response.status,data,response.headers);return data;
 }
 async profile(owner){const a=this.account(owner),p=await this.api(owner,'/me');if(this.accounts[owner]!==a)throw new Error('Das Konto wurde gewechselt.');a.profile={id:String(p.id||'').slice(0,160),name:String(p.display_name||p.id||'Spotify').slice(0,160)};await this.save();return a.profile;}
 async playlists(owner,offset=0){const at=Math.floor(bounded(offset,100000)),page=await this.api(owner,`/me/playlists?limit=50&offset=${at}`);return {offset:at,next:page.next?at+(page.items?.length||50):null,total:page.total||0,items:(page.items||[]).filter(p=>spotifyId(p?.id)).map(p=>({id:p.id,name:String(p.name||'Playlist').slice(0,180),owner:String(p.owner?.display_name||'').slice(0,160),image:imageURL(p.images?.[0]?.url),total:p.items?.total??p.tracks?.total??null,collaborative:!!p.collaborative,url:'https://open.spotify.com/playlist/'+p.id}))};}
 async items(owner,id,offset=0){if(!spotifyId(id))throw new Error('Ungültige Spotify-Playlist.');const at=Math.floor(bounded(offset,100000)),page=await this.api(owner,`/playlists/${id}/items?limit=50&offset=${at}`);return {id,offset:at,next:page.next?at+(page.items?.length||50):null,total:page.total||0,items:(page.items||[]).map((entry,i)=>{const t=entry?.item||entry?.track;return {index:at+i,id:t?.id||'',name:String(t?.name||'Nicht verfügbar').slice(0,180),artist:(t?.artists||[]).map(a=>String(a.name||'').slice(0,100)).join(' · '),duration:Math.max(0,Number(t?.duration_ms)||0),playable:!!t&&!entry.is_local&&t.is_playable!==false&&!t.restrictions&&t.type==='track'};})};}
 async devices(owner){const value=await this.api(owner,'/me/player/devices');return (value?.devices||[]).filter(d=>!d.is_restricted&&typeof d.id==='string').map(d=>({id:d.id,name:String(d.name||'Spotify').slice(0,160),active:!!d.is_active,type:d.type,volume:d.volume_percent}));}
 async playback(owner){const value=await this.api(owner,'/me/player');if(!value)return null;return {playing:!!value.is_playing,position:Math.max(0,Number(value.progress_ms)||0),duration:Math.max(0,Number(value.item?.duration_ms)||0),title:String(value.item?.name||'').slice(0,180),artist:(value.item?.artists||[]).map(a=>String(a.name||'').slice(0,100)).join(' · '),url:spotifyId(value.item?.id)?'https://open.spotify.com/track/'+value.item.id:'https://open.spotify.com',contextId:/^spotify:playlist:[A-Za-z0-9]{22}$/.test(value.context?.uri||'')?value.context.uri.split(':')[2]:'',trackId:spotifyId(value.item?.id)?value.item.id:'',image:imageURL(value.item?.album?.images?.[0]?.url||value.item?.images?.[0]?.url),shuffle:!!value.shuffle_state,repeat:['off','context','track'].includes(value.repeat_state)?value.repeat_state:'off',volume:value.device?.volume_percent??null,supportsVolume:value.device?.supports_volume!==false,device:value.device?{id:value.device.id,name:String(value.device.name||'Spotify').slice(0,160),restricted:!!value.device.is_restricted}:null,disallows:value.actions?.disallows||value.actions||{}};}
 async command(owner,input){const action=input?.action,device=input?.deviceId||'';if(device&&!/^[A-Za-z0-9_-]{1,160}$/.test(device))throw new Error('Ungültiges Spotify-Gerät.');const q=new URLSearchParams();if(device)q.set('device_id',device);let method='PUT',endpoint,body;
  if(action==='playlist'){if(!spotifyId(input.playlistId))throw new Error('Ungültige Spotify-Playlist.');endpoint='/me/player/play';body={context_uri:'spotify:playlist:'+input.playlistId,...(Number.isInteger(input.index)&&input.index>=0&&input.index<=100000?{offset:{position:input.index}}:{})};}
  else if(action==='resume')endpoint='/me/player/play';else if(action==='pause')endpoint='/me/player/pause';
  else if(action==='next'||action==='previous'){endpoint='/me/player/'+action;method='POST';}
  else if(action==='seek'){endpoint='/me/player/seek';q.set('position_ms',String(Math.round(bounded(input.value,86400000))));}
  else if(action==='volume'){endpoint='/me/player/volume';q.set('volume_percent',String(Math.round(bounded(input.value,100))));}
  else if(action==='shuffle'){if(typeof input.value!=='boolean')throw new Error('Ungültige Zufallswiedergabe.');endpoint='/me/player/shuffle';q.set('state',String(input.value));}
  else if(action==='repeat'){if(!['off','context','track'].includes(input.value))throw new Error('Ungültige Wiederholung.');endpoint='/me/player/repeat';q.set('state',input.value);}
  else if(action==='transfer'){if(!device)throw new Error('Bitte ein Spotify-Gerät wählen.');endpoint='/me/player';body={device_ids:[device],play:false};q.delete('device_id');}
  else throw new Error('Unbekannter Spotify-Befehl.');return this.api(owner,endpoint+(q.size?'?'+q:''),method,body);
 }
 async disconnect(owner){const a=this.account(owner);if(this.pending?.owner===owner)await this.cancelLogin();this.accounts[owner]={clientId:a.clientId||''};await this.save();return this.status(owner);}
}
module.exports={DesktopSpotify,REDIRECT,SCOPES,imageURL,apiError};
