const { app, BrowserWindow, ipcMain, protocol, net, shell, safeStorage, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { validRequest, githubRequest } = require('./service.cjs');
const {DiscordPresence}=require('./discord.cjs');
const {DesktopCloud}=require('./team.cjs');
const {StudioUpdater}=require('./updates.cjs');
const {autoUpdater}=require('electron-updater');
protocol.registerSchemesAsPrivileged([{scheme:'ntapp',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
app.setName('Neon Trinity Studio');
const primaryInstance=app.requestSingleInstanceLock();
if(!primaryInstance)app.quit();
let window,studioUpdater;
let token='';
let miniWindow,quitting=false,playerState={paused:true};
const team=new DesktopCloud({app,safeStorage,shell});
const presence=new DiscordPresence(message=>{if(window&&!window.isDestroyed())window.webContents.send('discord-status',message);});
const tokenPath=()=>path.join(app.getPath('userData'),'github-token.enc');
function secureStorageAvailable(){return safeStorage.isEncryptionAvailable() && (process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text');}
async function readToken(){try{if(!secureStorageAvailable())return '';return safeStorage.decryptString(await fs.readFile(tokenPath()));}catch{return '';}}
function trusted(event){const u=event.senderFrame&&new URL(event.senderFrame.url);if(!u||u.protocol!=='ntapp:'||u.hostname!=='studio')throw new Error('Unzulässiger Zugriff.');}
if(primaryInstance)app.whenReady().then(async()=>{
  token=await readToken();
  await team.load();
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
  handle('cloud:get-item',key=>team.getItem(key));
  handle('cloud:set-item',(key,value)=>team.setItem(key,value));
  handle('cloud:remove-item',key=>team.removeItem(key));
  handle('cloud:start-login',()=>team.startLogin());
  handle('cloud:open-login',url=>team.openLogin(url));
  handle('cloud:poll-login',()=>team.pollLogin());
  handle('cloud:cancel-login',()=>team.cancelLogin());
  handle('discord:configure',async id=>{presence.configure(id);team.config.discordClientId=id;await team.save();return true;});
  handle('player:update',state=>{playerState={title:String(state.title||'').slice(0,160),artist:String(state.artist||'Neon Trinity').slice(0,120),position:Math.max(0,Number(state.position)||0),duration:Math.max(0,Number(state.duration)||0),paused:!!state.paused,roomUrl:typeof state.roomUrl==='string'?state.roomUrl.slice(0,1000):''};if(miniWindow&&!miniWindow.isDestroyed())miniWindow.webContents.send('player-state',playerState);presence.update(playerState);return true;});
  handle('player:command',command=>{if(!['toggle','next','previous','seek'].includes(command?.command))throw new Error('Unbekannter Player-Befehl.');window.webContents.send('player-command',command);return true;});
  handle('player:mini',()=>{openMini();return true;});
  handle('player:close-mini',()=>{miniWindow?.close();return true;});
  handle('player:show-studio',()=>{window.show();window.focus();return true;});
  studioUpdater=new StudioUpdater({updater:autoUpdater,version:app.getVersion(),supported:app.isPackaged&&process.platform==='win32'&&!process.env.PORTABLE_EXECUTABLE_FILE,onStatus:state=>{if(window&&!window.isDestroyed())window.webContents.send('studio-update-status',state);},beforeInstall:()=>{quitting=true;},afterInstallError:()=>{quitting=false;}});
  handle('studio:update-status',()=>studioUpdater.status());
  handle('studio:update-check',()=>studioUpdater.check());
  handle('studio:update-download',()=>studioUpdater.download());
  handle('studio:update-install',()=>studioUpdater.install());
  createWindow();
  studioUpdater.start();
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Studio',submenu:[{role:'reload',label:'Neu laden'},{role:'togglefullscreen',label:'Vollbild'},{type:'separator'},{role:'quit',label:'Beenden'}]},{label:'Bearbeiten',submenu:[{role:'undo',label:'Rückgängig'},{role:'redo',label:'Wiederholen'},{type:'separator'},{role:'cut',label:'Ausschneiden'},{role:'copy',label:'Kopieren'},{role:'paste',label:'Einfügen'},{role:'selectAll',label:'Alles auswählen'}]},{label:'Ansicht',submenu:[{role:'resetZoom',label:'Originalgröße'},{role:'zoomIn',label:'Vergrößern'},{role:'zoomOut',label:'Verkleinern'}]}]));
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
function createWindow(){
  window=new BrowserWindow({width:1440,height:960,minWidth:720,minHeight:600,title:'Neon Trinity Studio',backgroundColor:'#111116',icon:path.join(__dirname,'../app/assets/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(({url})=>{if(url==='ntapp://studio/team-help.html'){const help=new BrowserWindow({width:940,height:850,title:'Neon Trinity · Team einrichten',backgroundColor:'#100919',webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});help.webContents.setWindowOpenHandler(({url})=>{openLink(url);return {action:'deny'};});help.webContents.on('will-navigate',(event,target)=>{event.preventDefault();openLink(target);});help.loadURL(url);}else openLink(url);return {action:'deny'};});
  window.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('ntapp://studio/')){e.preventDefault();openLink(url);}});
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  window.webContents.session.on('will-download',(_event,item)=>{if(!item.getURL().startsWith('blob:ntapp://studio/'))item.cancel();});
  window.on('close',event=>{if(!quitting&&miniWindow&&!miniWindow.isDestroyed()){event.preventDefault();window.hide();}});
  window.loadURL('ntapp://studio/index.html');
}
function openLink(input){try{const u=new URL(input);if(u.protocol==='https:'&&!u.username&&!u.password)shell.openExternal(u.href);}catch{}}
app.on('second-instance',()=>{if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});

function openMini(){if(miniWindow&&!miniWindow.isDestroyed()){miniWindow.show();miniWindow.focus();return;}miniWindow=new BrowserWindow({width:390,height:205,minWidth:360,minHeight:200,resizable:false,frame:false,alwaysOnTop:true,skipTaskbar:true,title:'Neon Trinity Miniplayer',backgroundColor:'#100919',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});miniWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));miniWindow.webContents.on('will-navigate',event=>event.preventDefault());miniWindow.webContents.on('did-finish-load',()=>miniWindow.webContents.send('player-state',playerState));miniWindow.on('closed',()=>{miniWindow=null;if(!quitting&&window&&!window.isDestroyed()&&!window.isVisible())window.show();});miniWindow.loadURL('ntapp://studio/mini.html');}
app.on('before-quit',()=>{quitting=true;studioUpdater?.stop();presence.close();team.cancelLogin().catch(()=>{});});
