// The mobile player uses Spotify's PKCE flow. No client secret or shared tokens.
export const MOBILE_SPOTIFY_REDIRECT='https://mikejaeson1-wq.github.io/neon-trinity/mobile.html';
export const MOBILE_SPOTIFY_SCOPES='playlist-read-private playlist-read-collaborative user-read-private user-read-email user-read-playback-state user-modify-playback-state streaming';
const SESSION='neon-trinity-mobile-spotify',PENDING=SESSION+'-login';
const spotifyId=value=>typeof value==='string'&&/^[A-Za-z0-9]{22}$/.test(value);
const bounded=(value,max)=>Math.max(0,Math.min(max,Number(value)||0));
export function spotifyImage(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&(/(^|\.)scdn\.co$|(^|\.)spotifycdn\.com$/.test(url.hostname))?url.href:'';}catch{return '';}}
const random=()=>[...crypto.getRandomValues(new Uint8Array(48))].map(n=>n.toString(16).padStart(2,'0')).join('');
const jsonRead=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
let sdkPromise;
export function loadSpotifySDK(){
  if(globalThis.Spotify?.Player)return Promise.resolve(globalThis.Spotify);
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{sdkPromise=null;reject(new Error('Spotify-Player konnte nicht geladen werden. Prüfe Internetverbindung und Inhaltsblocker.'));},20000);
    globalThis.onSpotifyWebPlaybackSDKReady=()=>{clearTimeout(timer);resolve(globalThis.Spotify);};
    let script=document.querySelector('#spotify-sdk');if(script)script.remove();script=document.createElement('script');script.id='spotify-sdk';script.src='https://sdk.scdn.co/spotify-player.js';script.onerror=()=>{clearTimeout(timer);sdkPromise=null;reject(new Error('Spotify-Player ist nicht erreichbar.'));};document.head.append(script);
  });return sdkPromise;
}
export class MobileSpotify{
  constructor({storage=globalThis.sessionStorage,fetcher=globalThis.fetch,loadSDK=loadSpotifySDK,onChange=()=>{},onPlayback=()=>{}}={}){
    Object.assign(this,{storage,fetcher,loadSDK,onChange,onPlayback});this.owner=null;this.generation=0;this.refreshing=null;this.player=null;this.sdkStarting=null;this.reset();
  }
  reset(){this.tokens=null;this.profile=null;this.playlists=[];this.next=0;this.items=[];this.itemsNext=null;this.selection=null;this.playback=null;this.deviceId='';this.devices=[];this.device='';this.retryUntil=0;this.message='';this.loading=false;this.sdkState='idle';}
  assertOwner(generation){if(generation!==this.generation||!this.owner)throw new Error('Das angemeldete Konto hat sich geändert.');}
  setOwner(owner){
    const id=owner?.id||null;if(id===this.owner){if(!id){this.storage.removeItem(SESSION);this.storage.removeItem(PENDING);}return;}this.generation++;this.player?.disconnect();this.player=null;this.sdkStarting=null;this.refreshing=null;this.owner=id;this.reset();
    const stored=jsonRead(this.storage,SESSION),pending=jsonRead(this.storage,PENDING);
    if(stored&&stored.owner!==id)this.storage.removeItem(SESSION);if(pending&&pending.owner!==id)this.storage.removeItem(PENDING);
    if(id&&stored?.owner===id&&/^[a-f0-9]{32}$/i.test(stored.clientId||'')&&typeof stored.refresh_token==='string'&&stored.refresh_token.length<5000)this.tokens=stored;
    this.onChange();this.onPlayback();
  }
  get connected(){return !!this.tokens;}
  async beginLogin(clientId){
    if(!this.owner)throw new Error('Bitte zuerst mit Discord anmelden.');if(!/^[a-f0-9]{32}$/i.test(clientId||''))throw new Error('Dex muss im Studio zuerst die Spotify Client ID hinterlegen.');
    const generation=this.generation,verifier=random(),state=random();
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));this.assertOwner(generation);
    const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    this.storage.setItem(PENDING,JSON.stringify({owner:this.owner,clientId,verifier,state,expiresAt:Date.now()+10*60*1000}));
    const url=new URL('https://accounts.spotify.com/authorize');url.search=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:MOBILE_SPOTIFY_REDIRECT,scope:MOBILE_SPOTIFY_SCOPES,state,code_challenge_method:'S256',code_challenge:challenge,show_dialog:'true'}).toString();return url.href;
  }
  async finishLogin(url){
    const params=new URL(url).searchParams;if(!params.has('code')&&!params.has('error'))return false;
    const pending=jsonRead(this.storage,PENDING);this.storage.removeItem(PENDING);
    if(!this.owner||!pending||pending.owner!==this.owner||pending.expiresAt<Date.now()||!params.get('state')||params.get('state')!==pending.state)throw new Error('Die Spotify-Anmeldung ist abgelaufen oder gehört zu einem anderen Konto. Bitte erneut verbinden.');
    if(params.has('error'))throw new Error('Die Spotify-Anmeldung wurde abgebrochen.');
    const code=params.get('code');if(!code||code.length>4096)throw new Error('Ungültige Spotify-Anmeldung.');const generation=this.generation;
    const tokens=await this.tokenRequest({grant_type:'authorization_code',client_id:pending.clientId,code,redirect_uri:MOBILE_SPOTIFY_REDIRECT,code_verifier:pending.verifier});this.assertOwner(generation);
    if(!tokens.refresh_token)throw new Error('Spotify hat keine erneuerbare Anmeldung zurückgegeben.');this.saveTokens(tokens,pending.clientId);return true;
  }
  saveTokens(value,clientId=this.tokens?.clientId){
    if(!this.owner||typeof value.access_token!=='string'||!value.access_token||value.access_token.length>5000)throw new Error('Ungültige Spotify-Antwort.');
    const refresh=value.refresh_token||this.tokens?.refresh_token;if(typeof refresh!=='string'||!refresh||refresh.length>5000)throw new Error('Bitte Spotify erneut verbinden.');
    const tokens={owner:this.owner,clientId,access_token:value.access_token,refresh_token:refresh,expiresAt:Date.now()+bounded(value.expires_in||3600,86400)*1000};
    this.storage.setItem(SESSION,JSON.stringify(tokens));this.tokens=tokens;
  }
  async tokenRequest(input){
    const response=await this.fetcher('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(input),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
    const value=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(response.status===400?'Spotify-Anmeldung abgelaufen. Bitte neu verbinden.':'Spotify-Anmeldung ist gerade nicht verfügbar.'),{status:response.status});return value;
  }
  async accessToken(){
    if(!this.owner||!this.tokens||this.tokens.owner!==this.owner)throw new Error('Bitte Spotify verbinden.');if(this.tokens.expiresAt>Date.now()+60000)return this.tokens.access_token;
    if(this.refreshing)return this.refreshing;
    const generation=this.generation,tokens=this.tokens;
    const task=(async()=>{try{const value=await this.tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id:tokens.clientId});this.assertOwner(generation);this.saveTokens(value);return this.tokens.access_token;}catch(e){if(generation===this.generation&&[400,401].includes(e.status))this.disconnect();throw e;}finally{if(generation===this.generation)this.refreshing=null;}})();this.refreshing=task;return task;
  }
  async api(path,{method='GET',body,retry=true}={}){
    if(typeof path!=='string'||!/^\/(me(?:[/?]|$)|playlists\/[A-Za-z0-9]{22}\/items\?)/.test(path)||path.includes('..')||path.includes('#'))throw new Error('Ungültige Spotify-Anfrage.');
    if(this.retryUntil>Date.now())throw Object.assign(new Error('Spotify-Anfragelimit erreicht. Bitte später erneut versuchen.'),{status:429});const generation=this.generation,token=await this.accessToken();this.assertOwner(generation);
    const response=await this.fetcher('https://api.spotify.com/v1'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});this.assertOwner(generation);
    if(response.status===204)return null;
    if(response.status===401&&retry){this.tokens.expiresAt=0;await this.accessToken();return this.api(path,{method,body,retry:false});}
    const value=await response.json().catch(()=>({}));this.assertOwner(generation);
    if(!response.ok){if(response.status===429)this.retryUntil=Date.now()+Math.max(5,Number(response.headers.get('retry-after'))||30)*1000;
      const messages={401:'Bitte Spotify erneut verbinden.',403:'Spotify erlaubt diese Aktion nicht. Premium, Freischaltung in eurer Spotify-App und die angeforderten Berechtigungen prüfen.',404:'Kein Spotify-Gerät aktiv. Aktiviere „Auf diesem Handy“ oder öffne Spotify.'};throw Object.assign(new Error(messages[response.status]||'Spotify-Anfrage fehlgeschlagen. Bitte erneut versuchen.'),{status:response.status});}
    return value;
  }
  async load(more=false){
    if(this.loading)return;const generation=this.generation;this.loading=true;this.onChange();try{
      const offset=more?this.next:0;if(offset===null)return;const [profile,page]=await Promise.all([this.profile?Promise.resolve(this.profile):this.api('/me'),this.api('/me/playlists?limit=50&offset='+bounded(offset,100000))]);this.assertOwner(generation);
      this.profile={name:String(profile.display_name||'Dein Spotify').slice(0,160),product:profile.product||''};
      const rows=(page.items||[]).filter(p=>spotifyId(p?.id)).map(p=>({id:p.id,name:String(p.name||'Playlist').slice(0,180),image:spotifyImage(p.images?.[0]?.url),owner:String(p.owner?.display_name||'').slice(0,160)}));this.playlists=more?[...this.playlists,...rows.filter(p=>!this.playlists.some(a=>a.id===p.id))]:rows;this.next=page.next?Number(offset)+(page.items?.length||50):null;this.message='';
    }finally{if(generation===this.generation){this.loading=false;this.onChange();}}
  }
  async open(id,more=false){
    const selection=this.playlists.find(p=>p.id===id);if(!selection)return;const generation=this.generation;if(!more){this.selection=selection;this.items=[];this.itemsNext=0;}const offset=more?this.itemsNext:0;if(offset===null)return;
    try{const page=await this.api(`/playlists/${id}/items?limit=50&offset=${bounded(offset,100000)}`);this.assertOwner(generation);if(this.selection?.id!==id)return;
      const items=(page.items||[]).map((entry,i)=>{const t=entry?.item||entry?.track;return {index:Number(offset)+i,id:t?.id||'',name:String(t?.name||'Nicht verfügbar').slice(0,180),artist:(t?.artists||[]).map(a=>String(a.name||'').slice(0,100)).join(' · '),duration:bounded(t?.duration_ms,86400000)/1000,playable:!!t&&!entry.is_local&&t.is_playable!==false&&!t.restrictions&&t.type==='track'};});this.items=more?[...this.items,...items]:items;this.itemsNext=page.next?Number(offset)+(page.items?.length||50):null;this.message='';
    }catch(e){if(generation===this.generation)this.message=e.status===403?'Spotify zeigt die Titel nur für eigene und kollaborative Playlists.':e.message;throw e;}finally{if(generation===this.generation)this.onChange();}
  }
  async prepareSDK(){
    if(this.player)return;if(this.sdkStarting)return this.sdkStarting;if(!this.connected)return;const generation=this.generation;this.sdkState='loading';this.onChange();
    const task=(async()=>{try{const SDK=await this.loadSDK();this.assertOwner(generation);const player=new SDK.Player({name:'Neon Trinity · Handy',getOAuthToken:callback=>{this.accessToken().then(token=>{if(generation===this.generation)callback(token);}).catch(e=>{if(generation===this.generation){this.message=e.message;this.onChange();}});},volume:.8,enableMediaSession:false});this.player=player;
      player.addListener('ready',({device_id})=>{if(generation!==this.generation)return;this.deviceId=device_id;this.device=this.device||device_id;this.sdkState='ready';this.message='Handy-Player bereit. Wähle einen Song und tippe auf ▶.';this.onChange();});
      player.addListener('not_ready',()=>{if(generation!==this.generation)return;this.deviceId='';this.sdkState='offline';this.message='Handy-Player ist offline. Bitte neu verbinden.';this.onChange();});
      player.addListener('player_state_changed',state=>{if(generation!==this.generation||!state||this.device&&this.device!==this.deviceId)return;this.acceptSDKState(state);});
      for(const event of ['initialization_error','authentication_error','account_error','playback_error'])player.addListener(event,()=>{if(generation!==this.generation)return;this.sdkState='error';this.message=event==='account_error'?'Spotify Premium ist für die Wiedergabe erforderlich.':event==='initialization_error'?'Dieser Browser unterstützt den geschützten Spotify-Player nicht. Nutze Safari/Chrome oder ein Spotify-Connect-Gerät.':'Spotify-Player konnte nicht starten. Bitte neu verbinden.';this.onChange();});
      player.addListener('autoplay_failed',()=>{if(generation!==this.generation)return;this.message='Bitte noch einmal auf ▶ tippen, um den Ton auf diesem Handy zu erlauben.';this.onChange();});
      if(!await player.connect())throw new Error('Spotify-Player konnte keine Verbindung herstellen.');if(generation!==this.generation){player.disconnect();this.assertOwner(generation);}
    }catch(e){if(generation===this.generation){this.sdkState='error';this.message=e.message;this.player?.disconnect();this.player=null;this.onChange();}throw e;}finally{if(generation===this.generation)this.sdkStarting=null;}})();this.sdkStarting=task;return task;
  }
  // Call synchronously from the click handler, before any awaited work (iOS).
  activate(){try{this.player?.activateElement()?.catch?.(()=>{});}catch{}}
  acceptSDKState(state){
    const t=state.track_window?.current_track;this.playback={title:String(t?.name||'Spotify').slice(0,180),artist:(t?.artists||[]).map(a=>a.name).join(' · '),image:spotifyImage(t?.album?.images?.[0]?.url),trackId:t?.id||'',playing:!state.paused,position:bounded(state.position,86400000)/1000,duration:bounded(state.duration,86400000)/1000,shuffle:!!state.shuffle,repeat:['off','context','track'][state.repeat_mode]||'off',disallows:state.disallows||{},device:{id:this.deviceId,name:'Dieses Handy'}};this.playbackAt=Date.now();this.onPlayback();
  }
  async refreshPlayback(){
    const value=await this.api('/me/player');if(!value){this.playback=null;this.onPlayback();return;}
    this.playback={title:String(value.item?.name||'Spotify').slice(0,180),artist:(value.item?.artists||[]).map(a=>a.name).join(' · '),image:spotifyImage(value.item?.album?.images?.[0]?.url),trackId:value.item?.id||'',playing:!!value.is_playing,position:bounded(value.progress_ms,86400000)/1000,duration:bounded(value.item?.duration_ms,86400000)/1000,shuffle:!!value.shuffle_state,repeat:value.repeat_state||'off',disallows:value.actions?.disallows||{},device:value.device?{id:value.device.id,name:String(value.device.name||'Spotify').slice(0,160)}:null};this.playbackAt=Date.now();this.onPlayback();
  }
  position(){const p=this.playback;return p?Math.min(p.duration,Math.max(0,p.position+(p.playing?(Date.now()-this.playbackAt)/1000:0))):0;}
  async refreshDevices(){const data=await this.api('/me/player/devices');this.devices=(data.devices||[]).filter(d=>!d.is_restricted&&typeof d.id==='string').map(d=>({id:d.id,name:String(d.name||'Spotify').slice(0,160)}));this.onChange();}
  async command(action,{playlistId,index,position,value}={}){
    if(!this.connected)throw new Error('Bitte Spotify verbinden.');let device=this.device||this.deviceId;
    if(!device){this.prepareSDK().catch(()=>{});throw new Error('Der Handy-Player wird vorbereitet. Bitte gleich erneut auf ▶ tippen oder ein Spotify-Gerät wählen.');}
    const query='?device_id='+encodeURIComponent(device);
    if(action==='playlist'){
      if(!spotifyId(playlistId)||!this.playlists.some(p=>p.id===playlistId))throw new Error('Diese Playlist ist nicht in deinem Spotify-Konto geladen.');if(index!=null&&!this.items.some(t=>this.selection?.id===playlistId&&t.index===index&&t.playable))throw new Error('Dieser Titel ist nicht verfügbar.');
      await this.api('/me/player',{method:'PUT',body:{device_ids:[device],play:false}});
      await this.api('/me/player/play'+query,{method:'PUT',body:{context_uri:'spotify:playlist:'+playlistId,...(index!=null?{offset:{position:index}}:{})}});
    }else if(action==='resume'||action==='pause')await this.api('/me/player/'+(action==='resume'?'play':'pause')+query,{method:'PUT'});
    else if(action==='next'||action==='previous')await this.api('/me/player/'+action+query,{method:'POST'});
    else if(action==='seek')await this.api('/me/player/seek'+query+'&position_ms='+Math.floor(bounded(position,86400)*1000),{method:'PUT'});
    else if(action==='shuffle')await this.api('/me/player/shuffle'+query+'&state='+String(!!value),{method:'PUT'});
    else if(action==='repeat'){if(!['off','context','track'].includes(value))throw new Error('Ungültiger Wiederholmodus.');await this.api('/me/player/repeat'+query+'&state='+value,{method:'PUT'});}
    else throw new Error('Unbekannter Spotify-Befehl.');await this.refreshPlayback();
  }
  async pauseOwned(){if(this.playback?.playing&&this.playback.device?.id===this.deviceId){try{await this.player?.pause();}catch{}}}
  disconnect(){this.generation++;this.player?.disconnect();this.player=null;this.sdkStarting=null;this.refreshing=null;this.storage.removeItem(SESSION);this.storage.removeItem(PENDING);this.reset();this.onChange();this.onPlayback();}
}
