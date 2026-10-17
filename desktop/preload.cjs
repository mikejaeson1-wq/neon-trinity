const {contextBridge,ipcRenderer}=require('electron');
async function call(name,...args){const r=await ipcRenderer.invoke(name,...args);if(!r.ok){const e=new Error(r.message);e.status=r.status;e.data=r.data;throw e;}return r.value;}
contextBridge.exposeInMainWorld('neonDesktop',{
  pendingListenRoom:()=>call('listen:pending'),backgroundListening:()=>call('listen:background'),onListenRoom:callback=>{const listener=(_,room)=>callback(room);ipcRenderer.on('listen-room',listener);return ()=>ipcRenderer.removeListener('listen-room',listener);},
  updateStatus:()=>call('studio:update-status'),checkForUpdates:()=>call('studio:update-check'),downloadUpdate:()=>call('studio:update-download'),installUpdate:()=>call('studio:update-install'),onUpdateStatus:callback=>{const listener=(_,state)=>callback(state);ipcRenderer.on('studio-update-status',listener);return ()=>ipcRenderer.removeListener('studio-update-status',listener);},
  cloudGetItem:key=>call('cloud:get-item',key),cloudSetItem:(key,value)=>call('cloud:set-item',key,value),cloudRemoveItem:key=>call('cloud:remove-item',key),cloudStartLogin:()=>call('cloud:start-login'),cloudOpenLogin:url=>call('cloud:open-login',url),cloudPollLogin:()=>call('cloud:poll-login'),cloudCancelLogin:()=>call('cloud:cancel-login'),
  configureDiscord:id=>call('discord:configure',id),updatePlayer:state=>call('player:update',state),openMini:()=>call('player:mini'),closeMini:()=>call('player:close-mini'),showStudio:()=>call('player:show-studio'),playerCommand:command=>call('player:command',command),
  onPlayerCommand:callback=>{ipcRenderer.on('player-command',(_,state)=>callback(state));},onPlayerState:callback=>{ipcRenderer.on('player-state',(_,state)=>callback(state));},onDiscordStatus:callback=>{ipcRenderer.on('discord-status',(_,message)=>callback(message));},
  hasToken:()=>ipcRenderer.invoke('github:has-token'),
  setToken:token=>ipcRenderer.invoke('github:set-token',token),
  clearToken:()=>ipcRenderer.invoke('github:clear-token'),
  request:async input=>{const result=await ipcRenderer.invoke('github:request',input);if(!result.ok){const error=new Error(result.message);error.status=result.status;throw error;}return result.data;}
});
