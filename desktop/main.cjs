const { app, BrowserWindow, ipcMain, protocol, net, shell, safeStorage, Menu, screen, dialog, globalShortcut } = require('electron');
const {configureStudioProfile}=require('./profile.cjs');
configureStudioProfile(app);
const path = require('node:path');
const {DesktopQoL,snapBounds}=require('./qol.cjs');
const {visibleBounds,MiniWindowState}=require('./window-state.cjs');
const miniPreferences=new MiniWindowState(app);
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { validRequest, githubRequest } = require('./service.cjs');
const {DiscordPresence}=require('./discord.cjs');
const {DesktopCloud}=require('./team.cjs');
const {roomFromArguments,listeningRoomFromURL}=require('./deep-link.cjs');
const {DesktopSpotify,imageURL}=require('./spotify.cjs');
const {SunoDownloads}=require('./suno-downloads.cjs');
const {StudioBackups}=require('./backups.cjs');
let playerSettings,skinEngine;
const {StudioRecovery,authenticode}=require('./recovery.cjs');
const recovery=new StudioRecovery({app,beforeInstall:()=>{if(backups.busy)throw new Error('Bitte die Sicherung abschließen.');quitting=true;}});
const {StudioUpdater}=require('./updates.cjs');
const {autoUpdater}=require('electron-updater');
protocol.registerSchemesAsPrivileged([{scheme:'ntapp',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
const primaryInstance=app.requestSingleInstanceLock();
if(!primaryInstance)app.quit();
let window,studioUpdater,pendingRoom=roomFromArguments(process.argv);
let token='';
let miniMeasuredHeight=0,miniSettingsOpen=false,miniWindow,quitting=false,playerState={paused:true};
const team=new DesktopCloud({app,safeStorage,shell});
const spotify=new DesktopSpotify({app,safeStorage,shell});
const suno=new SunoDownloads({app,dialog,isOwner:owner=>{try{return spotifyOwner(owner)===owner;}catch{return false;}}});
const backups=new StudioBackups({app,isOwner:owner=>{try{return spotifyOwner(owner)===owner;}catch{return false;}}});
const presence=new DiscordPresence(message=>{if(window&&!window.isDestroyed())window.webContents.send('discord-status',message);});
const desktopQoL=new DesktopQoL({app,shortcuts:globalShortcut,authenticate:spotifyOwner,send:message=>window?.webContents.send('player-command',message),getPlayer:()=>playerState});
const tokenPath=()=>path.join(app.getPath('userData'),'github-token.enc');
function secureStorageAvailable(){return safeStorage.isEncryptionAvailable() && (process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text');}
async function readToken(){try{if(!secureStorageAvailable())return '';return safeStorage.decryptString(await fs.readFile(tokenPath()));}catch{return '';}}
function trusted(event){const u=event.senderFrame&&new URL(event.senderFrame.url);if(!u||u.protocol!=='ntapp:'||u.hostname!=='studio')throw new Error('Unzulässiger Zugriff.');}
if(primaryInstance)app.whenReady().then(async()=>{
  if(app.isPackaged)app.setAsDefaultProtocolClient('neontrinity');
  token=await readToken();await miniPreferences.load();
  playerSettings=await import('../app/player-settings.mjs');skinEngine=await import('../app/skin-engine.mjs');await team.load();await spotify.load();await suno.load();
  if(team.config.discordClientId)presence.configure(team.config.discordClientId);
  const appRoot=path.resolve(__dirname,'../app');
  protocol.handle('ntapp',request=>{
    const url=new URL(request.url);if(url.hostname!=='studio')return new Response('Not found',{status:404});
    let name;try{name=decodeURIComponent(url.pathname);}catch{return new Response('Bad request',{status:400});}
    const target=path.resolve(appRoot,`.${name==='/'?'/index.html':name}`);
    if(target!==appRoot&&!target.startsWith(appRoot+path.sep))return new Response('Forbidden',{status:403});
    return net.fetch(pathToFileURL(target).toString());
  });
  ipcMain.handle('github:has-token',event=>{trusted(event);return Boolean(token);});
  ipcMain.handle('github:set-token',async(event,value)=>{
    trusted(event);if(typeof value!=='string'||value.length<10||value.length>500||/[\r\n]/.test(value))throw new Error('Ungültiger Token.');
    if(!secureStorageAvailable())throw new Error('Der sichere Kennwortspeicher ist nicht verfügbar. Es wurde kein Token gespeichert.');
    await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(tokenPath(),safeStorage.encryptString(value),{mode:0o600});token=value;return true;
  });
  ipcMain.handle('github:clear-token',async event=>{trusted(event);token='';await fs.rm(tokenPath(),{force:true});return true;});
  ipcMain.handle('github:request',async(event,input)=>{
    trusted(event);
    try{if(!token)throw new Error('Bitte zuerst GitHub verbinden.');validRequest(input);const data=await githubRequest(token,input);return {ok:true,data};}
    catch(error){return {ok:false,message:error.message,status:error.status||0};}
  });
  const handle=(name,fn)=>ipcMain.handle(name,async(event,...args)=>{trusted(event);try{return {ok:true,value:await fn(...args)};}catch(error){return {ok:false,message:error.message,status:error.status||0,data:error.data};}});
  handle('backup:begin',(manifest,owner)=>backups.begin(manifest,owner));
  handle('backup:write',(job,key,offset,bytes,owner)=>backups.write(job,key,offset,bytes,owner));
  handle('backup:finish',(job,retention,owner)=>backups.finish(job,retention,owner));
  handle('backup:abort',(job,owner)=>backups.abort(job,owner));
  handle('backup:list',owner=>backups.list(owner));
  handle('backup:manifest',(id,owner)=>backups.manifest(id,owner));
  handle('backup:read',(id,key,owner)=>backups.read(id,key,owner));
  handle('backup:remove',(id,owner)=>backups.remove(id,owner));
  handle('backup:folder',async owner=>shell.openPath(await backups.base(owner)));
  handle('spotify:status',owner=>spotify.status(spotifyOwner(owner)));
  handle('suno:status',owner=>suno.status(spotifyOwner(owner)));
  handle('suno:choose',owner=>suno.choose(spotifyOwner(owner)));
  handle('suno:forget',owner=>suno.forget(spotifyOwner(owner)));
  handle('suno:configure',(auto,owner)=>suno.configure(spotifyOwner(owner),auto));
  handle('suno:scan',owner=>suno.scan(spotifyOwner(owner)));
  handle('suno:read',(id,owner)=>suno.read(spotifyOwner(owner),id));
  handle('spotify:configure',(id,owner)=>spotify.configure(spotifyOwner(owner),id));
  handle('spotify:login',(id,owner)=>spotify.startLogin(spotifyOwner(owner),id));
  handle('spotify:poll-login',owner=>spotify.pollLogin(spotifyOwner(owner)));
  handle('spotify:cancel-login',()=>spotify.cancelLogin());
  handle('spotify:disconnect',owner=>spotify.disconnect(spotifyOwner(owner)));
  handle('spotify:playlists',(offset,owner)=>spotify.playlists(spotifyOwner(owner),offset));
  handle('spotify:items',(id,offset,owner)=>spotify.items(spotifyOwner(owner),id,offset));
  handle('spotify:devices',owner=>spotify.devices(spotifyOwner(owner)));
  handle('spotify:playback',owner=>spotify.playback(spotifyOwner(owner)));
  handle('spotify:command',(input,owner)=>spotify.command(spotifyOwner(owner),input));
  handle('cloud:get-item',key=>team.getItem(key));
  handle('cloud:set-item',(key,value)=>team.setItem(key,value));
  handle('cloud:remove-item',async key=>{await spotify.cancelLogin();return team.removeItem(key);});
  handle('cloud:start-login',()=>team.startLogin());
  handle('cloud:open-login',url=>team.openLogin(url));
  handle('cloud:poll-login',()=>team.pollLogin());
  handle('cloud:cancel-login',()=>team.cancelLogin());
  handle('discord:configure',async(id,expectedUserId='')=>{presence.configure(id,expectedUserId);team.config.discordClientId=id;await team.save();return presence.diagnostics();});
  handle('discord:reconnect',async(id,expectedUserId='')=>{presence.reconnect(id,expectedUserId);team.config.discordClientId=id;await team.save();return presence.diagnostics();});
  handle('discord:status',()=>presence.diagnostics());
  handle('player:update',state=>{
    const bounded=(n,max=86400)=>Math.max(0,Math.min(max,Number(n)||0));
    const source=['studio','local','spotify','listen'].includes(state.source)?state.source:'studio';
    playerState={title:String(state.title||'').slice(0,180),artist:String(state.artist||'Neon Trinity').slice(0,160),position:bounded(state.position),duration:bounded(state.duration),paused:!!state.paused,source,hidePresence:!!state.hidePresence,customSkin:state.customSkin?skinEngine.skinInput(state.customSkin):null,mascot:{enabled:state.mascot?.enabled!==false,intensity:Math.min(2,Math.max(0,Number.isFinite(Number(state.mascot?.intensity))?Number(state.mascot.intensity):1))},private:!!state.private||source==='spotify'||source==='local',roomUrl:source==='studio'||source==='listen'||source==='local'?String(state.roomUrl||'').slice(0,1000):'',volume:state.volume==null?null:bounded(state.volume,1),image:imageURL(state.image)||(/^blob:ntapp:\/\/studio\/[a-f0-9-]{36}$/i.test(state.image||'')?state.image:''),device:String(state.device||'').slice(0,160),shuffle:!!state.shuffle,repeat:['off','context','track'].includes(state.repeat)?state.repeat:'off',appearance:playerSettings.normalizePlayer(state.appearance),equalizer:playerSettings.normalizeEqualizer(state.equalizer),spectrum:source==='spotify'?[]:(Array.isArray(state.spectrum)?state.spectrum:[]).slice(0,24).map(n=>bounded(n,100))};
    playerState.queueTitle=String(state.queueTitle||'Playlist').slice(0,180);playerState.queueMessage=String(state.queueMessage||'').slice(0,250);playerState.queueMore=!!state.queueMore;playerState.queueLoading=!!state.queueLoading;playerState.queue=(Array.isArray(state.queue)?state.queue:[]).slice(0,1000).filter(t=>t&&typeof t.id==='string').map(t=>({id:t.id.slice(0,100),title:String(t.title||'').slice(0,180),artist:String(t.artist||'').slice(0,160),duration:bounded(t.duration),active:!!t.active,playable:t.playable!==false}));
    for(const key of ['canToggle','canNext','canPrevious','canSeek','canVolume','canShuffle','canRepeat'])playerState[key]=state[key]!==false;
    if(miniWindow&&!miniWindow.isDestroyed()){miniWindow.webContents.send('player-state',playerState);resizeMini();}
    presence.update(playerState);return true;
  });
  handle('player:command',command=>{
    if(!['toggle','next','previous','seek','volume','shuffle','repeat','appearance','equalizer','open-spotify','queue-play','queue-more','queue-move','queue-next','queue-save','backward','forward','mute'].includes(command?.command))throw new Error('Unbekannter Player-Befehl.');
    const message={command:command.command};
    if(['seek','volume'].includes(command.command)){if(!Number.isFinite(command.value))throw new Error('Ungültiger Player-Wert.');message.value=Math.max(0,Math.min(1,command.value));}
    if(command.command==='appearance'){const value=command.value||{};message.value={};for(const key of ['skin','layout','equalizerOpen','playlistOpen'])if(Object.hasOwn(value,key))message.value[key]=playerSettings.normalizePlayer({...playerState.appearance,[key]:value[key]})[key];}
    if(command.command==='queue-move'){if(!Number.isInteger(command.value?.from)||!Number.isInteger(command.value?.to)||command.value.from<0||command.value.to<0||command.value.from>2000||command.value.to>2000)throw new Error('Ungültige Reihenfolge.');message.value={from:command.value.from,to:command.value.to};}
    if(command.command==='queue-play'||command.command==='queue-next'){if(!command.value||typeof command.value.id!=='string'||!['spotify','studio','local'].includes(command.value.source))throw new Error('Ungültiger Playlist-Titel.');message.value={id:command.value.id.slice(0,100),source:command.value.source};}
    if(command.command==='equalizer')message.value=playerSettings.normalizeEqualizer(command.value);
    window.webContents.send('player-command',message);return true;
  });
  handle('player:mini-size',input=>{miniSettingsOpen=input?.settings===true;if(Number.isFinite(input?.height))miniMeasuredHeight=Math.max(170,Math.min(1000,Math.ceil(input.height)));resizeMini();return true;});
  handle('listen:pending',()=>{const room=pendingRoom;pendingRoom=null;return room;});
  handle('listen:background',()=>{window.minimize();return true;});
  handle('player:mini',()=>{openMini();return true;});
  handle('player:close-mini',()=>{miniWindow?.close();return true;});
  handle('player:mini-pin',value=>{if(typeof value!=='boolean')throw new Error('Ungültige Fenstereinstellung.');if(miniWindow&&!miniWindow.isDestroyed()){miniWindow.setAlwaysOnTop(value);miniPreferences.save(miniWindow.getBounds(),value).catch(()=>{});}else miniPreferences.value.alwaysOnTop=value;return value;});
  handle('player:mini-preferences',()=>({alwaysOnTop:miniPreferences.value.alwaysOnTop!==false}));
  handle('player:mini-bounds',input=>{if(!miniWindow||miniWindow.isDestroyed())throw new Error('Öffne zuerst den Miniplayer.');if(input!=null){if(!Number.isFinite(input.width)||!Number.isFinite(input.height))throw new Error('Bitte eine gültige Fenstergröße eingeben.');const bounds=visibleBounds({...miniWindow.getBounds(),width:input.width,height:input.height,...(Number.isFinite(input.x)?{x:input.x}:{}),...(Number.isFinite(input.y)?{y:input.y}:{})},screen.getAllDisplays());miniWindow.setBounds(bounds);miniPreferences.save(miniWindow.getBounds(),miniWindow.isAlwaysOnTop()).catch(()=>{});}return miniWindow.getBounds();});
  handle('player:show-studio',()=>{window.show();window.focus();return true;});
  studioUpdater=new StudioUpdater({updater:autoUpdater,version:app.getVersion(),supported:app.isPackaged&&process.platform==='win32'&&!process.env.PORTABLE_EXECUTABLE_FILE,onStatus:state=>{if(window&&!window.isDestroyed())window.webContents.send('studio-update-status',state);},beforeInstall:()=>{quitting=true;},afterInstallError:()=>{quitting=false;}});
  handle('studio:release-security',()=>authenticode(process.execPath));
  handle('studio:recovery-list',()=>recovery.list());
  handle('studio:recovery-download',version=>recovery.download(version));
  handle('studio:recovery-install',()=>recovery.install());
  handle('studio:update-status',()=>studioUpdater.status());
  handle('studio:update-check',()=>studioUpdater.check());
  handle('studio:update-download',()=>studioUpdater.download());
  handle('studio:update-install',()=>{if(backups.busy)throw new Error('Bitte die laufende Sicherung abschließen.');return studioUpdater.install();});
  let lastSpectrum=0;ipcMain.handle('player:spectrum',async(event,values)=>{trusted(event);if(event.sender!==window.webContents)return {ok:false,message:'Nur der Hauptplayer darf Audiodaten übertragen.'};if(Date.now()-lastSpectrum<70)return {ok:true,value:false};lastSpectrum=Date.now();const spectrum=(Array.isArray(values)?values:[]).slice(0,24).map(n=>Math.min(100,Math.max(0,Number(n)||0)));if(miniWindow&&!miniWindow.isDestroyed())miniWindow.webContents.send('player-spectrum',spectrum);return {ok:true,value:true};});
  handle('qol:configure',(input,owner)=>desktopQoL.configure(input||{},owner));
  handle('backup:external-choose',async owner=>{backups.assert(owner);const result=await dialog.showOpenDialog(window,{title:'Zusätzlichen Sicherungsordner auswählen',properties:['openDirectory','createDirectory']});if(!result.canceled&&result.filePaths[0])await backups.setExternal(owner,result.filePaths[0]);return backups.externalStatus(owner);});
  handle('backup:external-status',owner=>backups.externalStatus(owner));
  handle('backup:external-forget',owner=>backups.setExternal(owner,null));
  createWindow();
  studioUpdater.start();
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Studio',submenu:[{role:'reload',label:'Neu laden'},{role:'togglefullscreen',label:'Vollbild'},{type:'separator'},{role:'quit',label:'Beenden'}]},{label:'Bearbeiten',submenu:[{role:'undo',label:'Rückgängig'},{role:'redo',label:'Wiederholen'},{type:'separator'},{role:'cut',label:'Ausschneiden'},{role:'copy',label:'Kopieren'},{role:'paste',label:'Einfügen'},{role:'selectAll',label:'Alles auswählen'}]},{label:'Ansicht',submenu:[{role:'resetZoom',label:'Originalgröße'},{role:'zoomIn',label:'Vergrößern'},{role:'zoomOut',label:'Verkleinern'}]}]));
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
function createWindow(){
  window=new BrowserWindow({width:1440,height:960,minWidth:720,minHeight:600,title:'Neon Trinity Studio',backgroundColor:'#111116',icon:path.join(__dirname,'../app/assets/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false,autoplayPolicy:'no-user-gesture-required'}});
  window.webContents.setWindowOpenHandler(({url})=>{if(url==='ntapp://studio/team-help.html'||url==='ntapp://studio/privacy.html'){const help=new BrowserWindow({width:940,height:850,title:'Neon Trinity · Team einrichten',backgroundColor:'#100919',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});help.webContents.setWindowOpenHandler(({url})=>{openLink(url);return {action:'deny'};});help.webContents.on('will-navigate',(event,target)=>{event.preventDefault();openLink(target);});help.loadURL(url);}else openLink(url);return {action:'deny'};});
  window.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('ntapp://studio/')){e.preventDefault();openLink(url);}});
  window.webContents.session.setPermissionRequestHandler((contents,permission,callback)=>callback(permission==='speaker-selection'&&contents.getURL().startsWith('ntapp://studio/')));
  window.webContents.session.on('will-download',(_event,item)=>{if(!item.getURL().startsWith('blob:ntapp://studio/'))item.cancel();});
  window.on('close',event=>{if(!quitting&&miniWindow&&!miniWindow.isDestroyed()){event.preventDefault();window.hide();}});
  window.loadURL('ntapp://studio/index.html');
  if(pendingRoom)window.minimize();
}
function openLink(input){try{const u=new URL(input);if(u.protocol==='https:'&&!u.username&&!u.password)shell.openExternal(u.href);}catch{}}
function receiveListeningRoom(room){pendingRoom=room;if(window&&!window.isDestroyed()){if(!window.webContents.isLoadingMainFrame()){window.webContents.send('listen-room',room);pendingRoom=null;}window.minimize();}}
app.on('second-instance',(_event,argv)=>{const room=roomFromArguments(argv);if(room){receiveListeningRoom(room);return;}if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}});
app.on('open-url',(event,url)=>{const room=listeningRoomFromURL(url);if(room){event.preventDefault();receiveListeningRoom(room);}});
app.on('before-quit',()=>{quitting=true;backups.close().catch(()=>{});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});

function openMini(){
 if(miniWindow&&!miniWindow.isDestroyed()){miniWindow.show();miniWindow.focus();return;}
 miniSettingsOpen=false;miniMeasuredHeight=0;
 miniWindow=new BrowserWindow({...visibleBounds(miniPreferences.value,screen.getAllDisplays()),minWidth:360,minHeight:180,resizable:true,frame:false,alwaysOnTop:miniPreferences.value.alwaysOnTop!==false,skipTaskbar:false,title:'Neon Trinity Miniplayer',backgroundColor:'#100919',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 miniWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));miniWindow.webContents.on('will-navigate',event=>event.preventDefault());
 miniWindow.webContents.on('did-finish-load',()=>miniWindow.webContents.send('player-state',playerState));
 let timer;const remember=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(miniWindow&&!miniWindow.isDestroyed())miniPreferences.save(miniWindow.getBounds(),miniWindow.isAlwaysOnTop()).catch(()=>{});},250);};
 miniWindow.on('resize',remember);let snapTimer;miniWindow.on('move',()=>{remember();clearTimeout(snapTimer);if(desktopQoL.snap)snapTimer=setTimeout(()=>{if(!miniWindow||miniWindow.isDestroyed())return;const b=miniWindow.getBounds(),area=screen.getDisplayMatching(b).workArea,next=snapBounds(b,area);if(next.x!==b.x||next.y!==b.y)miniWindow.setBounds(next);},180);});
 miniWindow.on('close',()=>{clearTimeout(timer);miniPreferences.save(miniWindow.getBounds(),miniWindow.isAlwaysOnTop()).catch(()=>{});});
 miniWindow.on('closed',()=>{miniWindow=null;if(!quitting&&window&&!window.isDestroyed()&&!window.isVisible())window.show();});
 miniWindow.loadURL('ntapp://studio/mini.html');
}
app.on('before-quit',()=>{desktopQoL.unregister();quitting=true;studioUpdater?.stop();presence.close();spotify.cancelLogin().catch(()=>{});team.cancelLogin().catch(()=>{});});

function spotifyOwner(expected){
  try{const session=JSON.parse(team.getItem('neon-trinity-supabase-auth')||'null'),claims=JSON.parse(Buffer.from(session.access_token.split('.')[1],'base64url').toString());if(claims.iss!=='https://xyhkpwhfgjamssojjzbu.supabase.co/auth/v1'||!/^([a-f0-9]{8}-)([a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(claims.sub)||session.user?.id&&session.user.id!==claims.sub||expected!==claims.sub)throw new Error();return claims.sub;}catch{throw new Error('Bitte zuerst mit Discord im Studio anmelden.');}
}

// Content updates must never overwrite a size chosen by the user.
function resizeMini(){return;}
