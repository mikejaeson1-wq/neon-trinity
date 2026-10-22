import {MobilePlus} from './mobile-plus.mjs';
import {QueueNavigator,nextRepeat,repeatLabel} from './qol.mjs';
const navigation=new QueueNavigator();
import {createClient} from './vendor/supabase.mjs';
import {CLOUD} from './cloud-config.mjs';
import {escapeHTML as h,time} from './core.mjs';
import {MobileLibrary} from './mobile-library.mjs';
import {MobileSpotify,MOBILE_SPOTIFY_REDIRECT} from './mobile-spotify.mjs';
const $=selector=>document.querySelector(selector),audio=$('#mobile-audio');
const client=createClient(CLOUD.url,CLOUD.key,{auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,storageKey:'neon-trinity-community-auth'}});
const library=new MobileLibrary(client);
let mobilePlus=null,offlineIdentity=false;
let mediaKey='',user=null,actor=null,authVersion=0,source='band',tab='band',group=null,currentId=null,queue=[],shuffle=false,repeat='off',playVersion=0,clientId='',installPrompt=null,polling=false;
const spotify=new MobileSpotify({onChange:renderSpotify,onPlayback:drawPlayer});
const message=text=>{$('#mobile-message').textContent=text||'';};
const fail=error=>message(error?.message||'Das hat gerade nicht geklappt. Bitte erneut versuchen.');
function selectTab(value){tab=value;if(mobilePlus){mobilePlus.tab=value;if(value==='remote')mobilePlus.loadRemote().catch(fail);if(value==='offline')mobilePlus.render();}for(const id of ['band','spotify','offline','remote'])$('#'+id+'-section').hidden=value!==id;for(const id of ['band','spotify','offline','remote']){const el=$('#'+id+'-tab');if(value===id)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');}}
$('#offline-tab').onclick=()=>selectTab('offline');$('#remote-tab').onclick=()=>selectTab('remote');
$('#band-tab').onclick=()=>selectTab('band');$('#spotify-tab').onclick=()=>selectTab('spotify');
function rows(){if(!actor&&!group)return [];return group?(group.trackIds||[]).map(id=>library.tracks.find(t=>t.id===id)).filter(Boolean):library.tracks;}
function songButton(track,index,spotifyTrack=false){const active=spotifyTrack?source==='spotify'&&track.id===spotify.playback?.trackId:source==='band'&&track.id===currentId;return '<button class="song '+(active?'active':'')+'" data-'+(spotifyTrack?'spotify-index':'track')+'="'+h(spotifyTrack?track.index:track.id)+'" '+(track.playable===false?'disabled':'')+' aria-current="'+active+'"><span>'+(active?'♫':String(index+1).padStart(2,'0'))+'</span><span><strong>'+h(spotifyTrack?track.name:track.title)+'</strong><small>'+h(track.artist||'Neon Trinity')+'</small></span><span>'+time(track.duration)+'</span></button>';}
function renderBand(){
  $('#band-heading').textContent=actor?'Deine Bandmediathek':'Unsere Alben';$('#all-tracks').hidden=!actor||!group;$('#track-heading').textContent=group?.title||(actor?'Alle Songs':'Album auswählen');
  $('#band-groups').innerHTML=library.albums.map(a=>'<button class="album-card" data-album="'+h(a.id)+'"><img '+(a.coverBlobId?'data-cover="'+h(a.coverBlobId)+'"':'')+' src="assets/neon-trinity.png" alt=""><strong>'+h(a.title)+'</strong><small>'+h(a.year||'NEON TRINITY')+' · '+(a.trackIds?.length||0)+' Songs</small></button>').join('')+library.playlists.map(p=>'<button class="album-card" data-playlist="'+h(p.id)+'"><span class="playlist-tile"><span>≡ ♫</span><small>'+h(p.personal?'NUR FÜR DICH':'BAND PLAYLIST')+'</small></span><strong>'+h(p.title)+'</strong><small>'+(p.trackIds?.length||0)+' Songs</small></button>').join('');
  $('#band-tracks').innerHTML=rows().map((t,i)=>'<div class="offline-row">'+songButton(t,i)+(mobilePlus?.downloadButton(t)||'')+'</div>').join('')||'<p>'+(!actor&&!group?'Wähle ein veröffentlichtes Album. Mit Discord erhält das Trio auch die eigene Bandmediathek.':'Hier sind noch keine Songs.')+'</p>';
  for(const button of document.querySelectorAll('[data-album]'))button.onclick=async()=>{try{const version=authVersion,a=library.albums.find(a=>a.id===button.dataset.album);if(!actor)await library.publicAlbum(a.id);if(version!==authVersion)return;group=a;renderBand();}catch(e){fail(e);}};
  for(const button of document.querySelectorAll('[data-playlist]'))button.onclick=()=>{group=library.playlists.find(p=>p.id===button.dataset.playlist);renderBand();};
  for(const button of document.querySelectorAll('[data-track]'))button.onclick=()=>playBand(button.dataset.track,rows().map(t=>t.id)).catch(fail);
  for(const image of document.querySelectorAll('[data-cover]'))library.media(image.dataset.cover).then(url=>{if(url&&image.isConnected)image.src=url;}).catch(()=>{});
}
$('#all-tracks').onclick=()=>{group=null;renderBand();};
$('#refresh-band').onclick=()=>refreshBand().catch(fail);
async function refreshBand(){const version=authVersion;await library.load();if(version!==authVersion)return;if(group)group=library.albums.find(a=>a.id===group.id)||library.playlists.find(p=>p.id===group.id)||null;renderBand();}
function stopBand(){playVersion++;audio.pause();audio.removeAttribute('src');audio.load();currentId=null;queue=[];}
async function playBand(id,ids=queue,offline=false){
  offline=offline||navigator.onLine===false;const track=offline?mobilePlus?.music?.rows.find(r=>r.track.id===id)?.track:library.tracks.find(t=>t.id===id);if(!track)return;const version=++playVersion,ownerVersion=authVersion;audio.pause();await spotify.pauseOwned();if(version!==playVersion||ownerVersion!==authVersion)return;
  const url=offline?await mobilePlus.music.media(id):await library.media(track.blobId);if(version!==playVersion||ownerVersion!==authVersion)return;if(!url)throw new Error('Die Audiodatei ist gerade nicht verfügbar. Bitte aktualisieren.');
  source=offline?'offline':'band';if(ids!==queue)navigation.reset();currentId=id;navigation.commit(id);queue=ids.filter(id=>offline?mobilePlus.music.rows.some(r=>r.track.id===id):library.tracks.some(t=>t.id===id));audio.src=url;setBandMediaSession(track);drawPlayer();renderBand();
  try{await audio.play();message('');}catch{message('Tippe unten auf ▶, um den Ton auf deinem Handy zu starten.');}drawPlayer();
}
function adjacent(direction,auto=false){const id=navigation.next(queue,currentId,{direction,auto,shuffle,repeat,available:key=>source==='offline'?!!mobilePlus?.music?.rows.some(r=>r.track.id===key):library.tracks.some(t=>t.id===key)});if(id)return playBand(id,queue,source==='offline');}
function setBandMediaSession(track){
  if(!navigator.mediaSession)return;
  if(globalThis.MediaMetadata)navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist||'Neon Trinity',album:source==='spotify'?'Spotify':'Neon Trinity',artwork:[{src:track.image||new URL('assets/icon.png',location.href).href,sizes:'512x512',type:'image/png'}]});
  const seek=position=>{if(source==='spotify')spotify.command('seek',{position}).catch(fail);else if(Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(audio.duration,position));};const handlers={play:()=>source==='spotify'?spotify.command('resume').catch(fail):audio.play().catch(fail),pause:()=>source==='spotify'?spotify.command('pause').catch(fail):audio.pause(),previoustrack:()=>(source==='spotify'?spotify.command('previous'):adjacent(-1))?.catch(fail),nexttrack:()=>(source==='spotify'?spotify.command('next'):adjacent(1))?.catch(fail),seekto:details=>{if(Number.isFinite(details.seekTime))seek(details.seekTime);},seekbackward:d=>seek((source==='spotify'?spotify.position():audio.currentTime)-(d.seekOffset||10)),seekforward:d=>seek((source==='spotify'?spotify.position():audio.currentTime)+(d.seekOffset||10))};
  for(const [action,handler]of Object.entries(handlers))try{navigator.mediaSession.setActionHandler(action,()=>{});navigator.mediaSession.setActionHandler(action,handler);}catch{}
}
function renderSpotify(){
  if(!$('#spotify-message'))return;$('#spotify-redirect').textContent=MOBILE_SPOTIFY_REDIRECT;$('#spotify-login').hidden=spotify.connected;$('#spotify-login').disabled=!actor;for(const id of ['spotify-disconnect','spotify-refresh','spotify-device-panel'])$('#'+id).hidden=!spotify.connected;
  $('#spotify-message').textContent=spotify.message||(!actor?'Melde dich mit deinem Discord-Bandkonto an.':spotify.loading?'Deine Playlists werden geladen …':spotify.profile?'Verbunden mit '+spotify.profile.name+'. Nur für dich.':'Dein eigenes Spotify-Konto verbinden.');
  $('#spotify-setup').hidden=spotify.connected;$('#spotify-playlists').hidden=!!spotify.selection;
  $('#spotify-playlists').innerHTML=spotify.playlists.map(p=>'<button class="album-card" data-spotify-playlist="'+h(p.id)+'"><img src="'+h(p.image||'assets/icon.png')+'" alt=""><strong>'+h(p.name)+'</strong><small>'+h(p.owner)+'</small></button>').join('');
  $('#spotify-more').hidden=!!spotify.selection||!spotify.connected||spotify.next===null;$('#spotify-more').disabled=spotify.loading;
  $('#spotify-selection').textContent=spotify.selection?.name||'Deine Playlists';$('#spotify-back').hidden=!spotify.selection;
  $('#spotify-tracks').innerHTML=(spotify.selection?'<button class="small-button" id="spotify-play-selection">▶ Playlist abspielen</button>':'')+spotify.items.map((t,i)=>songButton(t,i,true)).join('');$('#spotify-items-more').hidden=!spotify.selection||spotify.itemsNext===null;
  for(const button of document.querySelectorAll('[data-spotify-playlist]'))button.onclick=()=>spotify.open(button.dataset.spotifyPlaylist).catch(fail);
  for(const button of document.querySelectorAll('[data-spotify-index]'))button.onclick=()=>{spotify.activate();playSpotify(spotify.selection.id,Number(button.dataset.spotifyIndex)).catch(fail);};
  if($('#spotify-play-selection'))$('#spotify-play-selection').onclick=()=>{spotify.activate();playSpotify(spotify.selection.id).catch(fail);};
  const options=[...(spotify.deviceId?[{id:spotify.deviceId,name:'Dieses Handy · Neon Trinity'}]:[]),...spotify.devices.filter(d=>d.id!==spotify.deviceId)];
  $('#spotify-device').innerHTML=options.map(d=>'<option value="'+h(d.id)+'">'+h(d.name)+'</option>').join('')||'<option value="">Handy-Player wird vorbereitet …</option>';
  for(const option of $('#spotify-device').querySelectorAll('option'))option.selected=false;const selected=[...$('#spotify-device').querySelectorAll('option')].find(o=>o.value===spotify.device);if(selected)selected.selected=true;
  $('#spotify-handset').textContent=spotify.sdkState==='ready'?'Auf diesem Handy aktivieren':spotify.sdkState==='loading'?'Handy-Player wird vorbereitet …':'Handy-Player neu verbinden';
}
$('#spotify-login').onclick=async()=>{try{location.assign(await spotify.beginLogin(clientId));}catch(e){fail(e);}};
$('#spotify-disconnect').onclick=()=>{spotify.pauseOwned().catch(()=>{});spotify.disconnect();if(source==='spotify')source='band';drawPlayer();};
$('#spotify-refresh').onclick=()=>spotify.load().catch(fail);$('#spotify-more').onclick=()=>spotify.load(true).catch(fail);$('#spotify-items-more').onclick=()=>spotify.open(spotify.selection.id,true).catch(fail);
$('#spotify-back').onclick=()=>{spotify.selection=null;spotify.items=[];renderSpotify();};
$('#spotify-device').onchange=e=>{spotify.device=e.target.value;};
$('#spotify-devices').onclick=()=>spotify.refreshDevices().catch(fail);
$('#spotify-handset').onclick=()=>{spotify.activate();if(spotify.deviceId){spotify.device=spotify.deviceId;spotify.message='Dieses Handy ist gewählt. Tippe bei einem Song auf ▶.';renderSpotify();}else{spotify.player?.disconnect();spotify.player=null;spotify.prepareSDK().catch(fail);}};
async function playSpotify(playlistId,index){stopBand();source='spotify';await spotify.command('playlist',{playlistId,index});drawPlayer();}
function drawPlayer(){
  if(!$('#player-title'))return;const track=source==='spotify'?spotify.playback:source==='offline'?mobilePlus?.music?.rows.find(r=>r.track.id===currentId)?.track:library.tracks.find(t=>t.id===currentId),duration=source==='spotify'?track?.duration:audio.duration||track?.duration||0,position=source==='spotify'?spotify.position():audio.currentTime||0,playing=source==='spotify'?track?.playing:!audio.paused;
  $('#player-source').textContent=source==='spotify'?'SPOTIFY':source==='offline'?'OFFLINE · DEIN KONTO':'NEON TRINITY';$('#player-title').textContent=track?.title||'Bereit für deinen Sound.';$('#player-artist').textContent=track?.artist||'Wähle einen Song';$('#player-art').src=source==='spotify'?track?.image||'assets/icon-192.png':'assets/icon-192.png';
  $('#player-toggle').textContent=playing?'Ⅱ':'▶';$('#player-toggle').setAttribute('aria-label',playing?'Pause':'Abspielen');$('#player-time').textContent=time(position)+' / '+time(Number.isFinite(duration)?duration:0);
  if(document.activeElement!==$('#player-seek'))$('#player-seek').value=duration>0?position/duration*1000:0;
  const disallows=source==='spotify'?track?.disallows||{}:{};
  $('#player-toggle').disabled=!track||!!(playing?disallows.pausing:disallows.resuming);$('#player-seek').disabled=!track||!Number.isFinite(duration)||duration<=0||!!disallows.seeking;
  $('#player-next').disabled=!track||source==='band'&&!queue.length||!!disallows.skipping_next;$('#player-previous').disabled=!track||source==='band'&&!queue.length||!!disallows.skipping_prev;
  $('#player-shuffle').setAttribute('aria-pressed',String(source==='spotify'?!!track?.shuffle:shuffle));$('#player-repeat').setAttribute('aria-pressed',String(source==='spotify'?track?.repeat&&track.repeat!=='off':repeat!=='off'));const mode=source==='spotify'?track?.repeat||'off':repeat;$('#player-repeat').textContent=mode==='track'?'REP1':'REP';$('#player-repeat').title=repeatLabel(mode);$('#player-repeat').setAttribute('aria-label',repeatLabel(mode));
  $('#player-device').textContent=source==='spotify'?(track?.device?.name||'Spotify Premium · Gerät wählen'):'';
  if(track&&mediaKey!==source+track.title+track.artist){mediaKey=source+track.title+track.artist;setBandMediaSession(track);}if(!track&&navigator.mediaSession){mediaKey='';navigator.mediaSession.metadata=null;}
  if(navigator.mediaSession)try{navigator.mediaSession.playbackState=playing?'playing':'paused';if(duration>0&&Number.isFinite(duration))navigator.mediaSession.setPositionState?.({duration,position:Math.min(position,duration),playbackRate:1});}catch{}
}
$('#player-toggle').onclick=()=>{if(source==='spotify'){spotify.activate();spotify.command(spotify.playback?.playing?'pause':'resume').catch(fail);}else if(audio.paused)audio.play().catch(fail);else audio.pause();};
$('#player-next').onclick=()=>{spotify.activate();(source==='spotify'?spotify.command('next'):adjacent(1))?.catch(fail);};
$('#player-previous').onclick=()=>{spotify.activate();(source==='spotify'?spotify.command('previous'):audio.currentTime>3?(audio.currentTime=0,Promise.resolve()):adjacent(-1))?.catch(fail);};
$('#player-seek').onchange=e=>{const ratio=Number(e.target.value)/1000;if(source==='spotify')spotify.command('seek',{position:ratio*(spotify.playback?.duration||0)}).catch(fail);else if(Number.isFinite(audio.duration))audio.currentTime=ratio*audio.duration;};
$('#player-shuffle').onclick=()=>{if(source==='spotify')spotify.command('shuffle',{value:!spotify.playback?.shuffle}).catch(fail);else{shuffle=!shuffle;navigation.reset();navigation.commit(currentId);savePreferences();drawPlayer();}};
$('#player-repeat').onclick=()=>{if(source==='spotify')spotify.command('repeat',{value:spotify.playback?.repeat==='off'?'context':spotify.playback?.repeat==='context'?'track':'off'}).catch(fail);else{repeat=nextRepeat(repeat);savePreferences();drawPlayer();}};
for(const event of ['timeupdate','play','pause','loadedmetadata'])audio.addEventListener(event,drawPlayer);
audio.addEventListener('ended',()=>{if(source==='spotify')return;adjacent(1,true)?.catch(fail);});audio.addEventListener('error',()=>{if(audio.getAttribute('src'))message('Die Audiodatei konnte nicht geladen werden. Bitte Mediathek aktualisieren und den Song erneut wählen.');});
$('#discord-login').onclick=async()=>{try{sessionStorage.setItem('neon-trinity-mobile-return',String(Date.now()));const result=await client.auth.signInWithOAuth({provider:'discord',options:{redirectTo:CLOUD.publicBase+'/profile.html',skipBrowserRedirect:true,scopes:'identify'}});if(result.error)throw result.error;location.assign(result.data.url);}catch(e){sessionStorage.removeItem('neon-trinity-mobile-return');fail(e);}};
$('#discord-logout').onclick=async()=>{try{localStorage.removeItem('neon-trinity-offline-owner');offlineIdentity=false;await applyUser(null);const result=await client.auth.signOut({scope:'local'});if(result.error)throw result.error;message('Du bist abgemeldet. Persönliche Playlists und Spotify wurden auf diesem Handy geschlossen.');}catch(e){fail(e);}};
async function applyUser(next,{initial=false}={}){
  const version=++authVersion;user=next;actor=null;offlineIdentity=false;mobilePlus?.setOwner(null).catch(fail);stopBand();if(!initial)spotify.setOwner(null);library.setOwner(null);group=null;source='band';renderBand();renderSpotify();drawPlayer();
  $('#discord-login').hidden=!!user;$('#discord-logout').hidden=!user;$('#account-name').textContent=user?'Discord verbunden':'Neon Trinity hören';$('#account-hint').textContent=user?'Bandzugang wird geprüft …':'Öffentliche Alben ohne Anmeldung.';
  if(user){const identity=await client.rpc('nt_identity');if(version!==authVersion)return;if(identity.error)throw identity.error;if(identity.data?.allowed){actor=identity.data;localStorage.setItem('neon-trinity-offline-owner',JSON.stringify({id:actor.id,alias:actor.alias}));}else localStorage.removeItem('neon-trinity-offline-owner');$('#account-name').textContent=actor?'Hey '+actor.alias+'.':'Discord verbunden';$('#account-hint').textContent=actor?'Deine Bandmediathek & dein Spotify.':'Öffentliche Alben und Bandprofile.';}
  if(version!==authVersion)return;library.setOwner(actor);spotify.setOwner(actor);loadPreferences();await mobilePlus?.setOwner(actor);renderSpotify();await refreshBand();offerResume();
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('#install-app').textContent='App installieren ↗';});
$('#install-app').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;}else{$('#install-help').open=true;$('#install-help').scrollIntoView({behavior:'smooth',block:'start'});}};
window.addEventListener('appinstalled',()=>{$('#install-app').textContent='Installiert ✓';message('Neon Trinity wurde zum Startbildschirm hinzugefügt.');});
window.addEventListener('offline',()=>message('Du bist offline. Deine gespeicherten Band-Songs findest du unter Offline.'));
window.addEventListener('online',()=>{message('Wieder online.');if(offlineIdentity)client.auth.getUser().then(r=>{if(r.error)throw r.error;return applyUser(r.data.user);}).catch(fail);});
setInterval(()=>{if(source==='spotify')drawPlayer();},1000).unref?.();
async function pollSpotify(){if(polling||!actor||!spotify.connected||document.hidden)return;polling=true;try{await spotify.refreshPlayback();}catch(e){if([401,403,429].includes(e.status))spotify.message=e.message;renderSpotify();}finally{polling=false;}}
setInterval(pollSpotify,10000).unref?.();document.addEventListener('visibilitychange',()=>{if(!document.hidden){pollSpotify();if(!navigator.onLine)message('Du bist offline.');}});
async function start(){
  if(navigator.onLine===false){let saved,session;try{saved=JSON.parse(localStorage.getItem('neon-trinity-offline-owner'));session=JSON.parse(localStorage.getItem('neon-trinity-community-auth'));}catch{}if(saved?.id&&session?.user?.id===saved.id){actor=saved;user=session.user;offlineIdentity=true;loadPreferences();library.setOwner(actor);await mobilePlus.setOwner(actor);$('#account-name').textContent='Offline als '+actor.alias;$('#account-hint').textContent='Nur deine gespeicherten Songs auf diesem Gerät.';$('#discord-login').hidden=true;$('#discord-logout').hidden=false;selectTab('offline');drawPlayer();message('Offline-Modus: Deine Band-Downloads sind bereit.');}else message('Melde dich einmal online an und speichere Band-Songs für unterwegs.');return;}
  const config=await client.from('nt_config').select('spotify_client_id').eq('id',1).single();if(!config.error)clientId=config.data?.spotify_client_id||'';
  const result=await client.auth.getSession();if(result.error)throw result.error;let next=null;if(result.data.session){const verified=await client.auth.getUser();if(verified.error)throw verified.error;next=verified.data.user;}
  await applyUser(next,{initial:true});
  const callback=new URL(location.href).searchParams;if(callback.has('code')||callback.has('error')){try{await spotify.finishLogin(location.href);selectTab('spotify');message('Spotify verbunden. Die Handy-Wiedergabe wird vorbereitet.');}catch(e){selectTab('spotify');fail(e);}finally{history.replaceState({},'',new URL(location.href).pathname);}}
  if(spotify.connected){await spotify.load().catch(fail);spotify.prepareSDK().catch(fail);}
  client.auth.onAuthStateChange((_event,session)=>{const next=session?.user||null;if(next?.id===user?.id)return;queueMicrotask(()=>applyUser(next).catch(fail));});
}
mobilePlus=new MobilePlus({client,getOwner:()=>actor,isVerified:()=>!!actor&&!offlineIdentity&&navigator.onLine!==false,playOffline:(id,ids)=>playBand(id,ids,true),onMessage:message,selectTab});mobilePlus.media=key=>library.media(key);mobilePlus.tracks=()=>library.tracks;if(mobilePlus.music)mobilePlus.music.onChange=()=>{mobilePlus.render();renderBand();};mobilePlus.render();
start().catch(error=>navigator.onLine===false?message('Du bist offline. Zum Hören und Anmelden brauchst du eine Internetverbindung.'):fail(error));
if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('mobile-sw.js',{scope:'./'}).catch(()=>{});

function preferenceKey(){return 'neon-mobile-qol/'+(actor?.id||'guest');}
function savePreferences(){try{const old=JSON.parse(localStorage.getItem(preferenceKey())||'{}');localStorage.setItem(preferenceKey(),JSON.stringify({...old,repeat,shuffle,...(source!=='spotify'&&currentId?{session:{id:currentId,queue,position:audio.currentTime||0,offline:source==='offline'}}:{})}));}catch{}}
function loadPreferences(){let data;try{data=JSON.parse(localStorage.getItem(preferenceKey())||'{}');}catch{data={};}repeat=['off','context','track'].includes(data.repeat)?data.repeat:'off';shuffle=data.shuffle===true;navigation.reset();}
function offerResume(){let data;try{data=JSON.parse(localStorage.getItem(preferenceKey())||'{}');}catch{return;}const s=data.session;if(!s||!library.tracks.some(t=>t.id===s.id))return;let box=$('#mobile-resume');if(!box){box=document.createElement('div');box.id='mobile-resume';$('#band-tracks').before(box);}box.innerHTML='<button class="small-button" id="mobile-continue">Letzten Song bei '+time(s.position)+' fortsetzen</button>';$('#mobile-continue').onclick=async()=>{try{await playBand(s.id,s.queue,s.offline);const seek=()=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(s.position,audio.duration);};if(audio.readyState>=1)seek();else audio.addEventListener('loadedmetadata',seek,{once:true});box.remove();}catch(e){fail(e);}};}
let preferenceTick=0;audio.addEventListener('timeupdate',()=>{if(Date.now()-preferenceTick>5000){preferenceTick=Date.now();savePreferences();}});window.addEventListener('pagehide',savePreferences);
for(const [id,delta] of [['player-backward',-10],['player-forward',10]]){const b=$('#'+id);if(b)b.onclick=()=>{if(source==='spotify'){spotify.activate();spotify.command('seek',{position:Math.max(0,Math.min(spotify.playback?.duration||0,spotify.position()+delta))}).catch(fail);}else if(Number.isFinite(audio.duration))audio.currentTime=Math.max(0,Math.min(audio.duration,audio.currentTime+delta));};}
