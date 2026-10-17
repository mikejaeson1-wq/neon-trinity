const RELEASES_URL='https://github.com/mikejaeson1-wq/neon-trinity/releases/latest';

function releaseDetails(info={}){
  const notes=Array.isArray(info.releaseNotes)?info.releaseNotes.map(x=>x.note||'').join('\n'):info.releaseNotes||'';
  return {version:String(info.version||'').slice(0,80),notes:String(notes).replace(/<[^>]*>/g,'').slice(0,12000)};
}

class StudioUpdater{
  constructor({updater,version,supported=true,onStatus=()=>{},beforeInstall=()=>{},afterInstallError=()=>{},schedule=fn=>setTimeout(fn,150)}){
    Object.assign(this,{updater,onStatus,beforeInstall,afterInstallError,schedule,supported});
    this.state={phase:supported?'idle':'unsupported',currentVersion:version,version:'',notes:'',percent:0,message:supported?'Das Studio prüft beim Start und danach regelmäßig auf Updates.':'Updates im Studio sind in der installierten Windows-Version verfügbar.',releasesUrl:RELEASES_URL};
    this.listeners=[];
    if(!supported)return;
    updater.autoDownload=false;
    updater.autoInstallOnAppQuit=false;
    updater.allowDowngrade=false;
    updater.allowPrerelease=false;
    updater.disableWebInstaller=true;
    this.listen('checking-for-update',()=>this.set({phase:'checking',message:'Neue Studio-Version wird gesucht …'}));
    this.listen('update-available',info=>this.set({...releaseDetails(info),phase:'available',percent:0,message:'Eine neue Studio-Version ist verfügbar.'}));
    this.listen('update-not-available',()=>this.set({phase:'current',version:'',notes:'',percent:0,message:'Dein Studio ist auf dem neuesten Stand.'}));
    this.listen('download-progress',progress=>this.set({phase:'downloading',percent:Math.min(100,Math.max(0,Number(progress.percent)||0)),message:'Update wird im Studio heruntergeladen …'}));
    this.listen('update-downloaded',info=>this.set({...releaseDetails(info),phase:'ready',percent:100,message:'Das Update ist heruntergeladen und geprüft. Du kannst es jetzt installieren.'}));
    this.listen('error',error=>this.failed(error));
  }
  listen(name,fn){this.updater.on(name,fn);this.listeners.push([name,fn]);}
  set(change){this.state={...this.state,...change};this.onStatus(this.status());return this.status();}
  status(){return {...this.state};}
  failed(error){
    if(this.state.phase==='installing')this.afterInstallError();
    const message=/404|ERR_UPDATER_NO_PUBLISHED_VERSIONS|ERR_UPDATER_CHANNEL_FILE_NOT_FOUND/.test(String(error?.code)+' '+String(error?.message))?'Es ist noch keine Windows-Version im Update-Kanal veröffentlicht. Bitte später erneut prüfen.':'Das Update konnte nicht abgeschlossen werden. Prüfe die Internetverbindung und versuche es erneut.';
    this.set({phase:'error',percent:0,message});
  }
  async check(){
    if(!this.supported||['downloading','ready','installing'].includes(this.state.phase))return this.status();
    if(this.checkTask)return this.checkTask;
    this.set({phase:'checking',message:'Neue Studio-Version wird gesucht …'});
    this.checkTask=Promise.resolve().then(()=>this.updater.checkForUpdates()).catch(error=>this.failed(error)).finally(()=>{this.checkTask=null;}).then(()=>this.status());
    return this.checkTask;
  }
  async download(){
    if(!this.supported)throw new Error('Bitte die Windows-Setup-Version installieren.');
    if(this.downloadTask)return this.downloadTask;
    if(this.state.phase==='ready')return this.status();
    if(this.state.phase!=='available')throw new Error('Bitte zuerst nach einer neuen Studio-Version suchen.');
    this.set({phase:'downloading',percent:0,message:'Update wird im Studio heruntergeladen …'});
    this.downloadTask=Promise.resolve().then(()=>this.updater.downloadUpdate()).catch(error=>this.failed(error)).finally(()=>{this.downloadTask=null;}).then(()=>this.status());
    return this.downloadTask;
  }
  install(){
    if(!this.supported||this.state.phase!=='ready')throw new Error('Das Update muss zuerst vollständig heruntergeladen und geprüft werden.');
    this.set({phase:'installing',message:'Das Studio wird geschlossen und aktualisiert …'});
    this.schedule(()=>{try{this.beforeInstall();this.updater.quitAndInstall(false,true);}catch(error){this.afterInstallError();this.failed(error);}});
    return this.status();
  }
  start(){
    if(!this.supported||this.startTimer)return;
    this.startTimer=setTimeout(()=>this.check(),15000);this.startTimer.unref?.();
    this.checkTimer=setInterval(()=>this.check(),4*60*60*1000);this.checkTimer.unref?.();
  }
  stop(){clearTimeout(this.startTimer);clearInterval(this.checkTimer);for(const [name,fn] of this.listeners)this.updater.removeListener(name,fn);this.listeners=[];}
}
module.exports={StudioUpdater,releaseDetails,RELEASES_URL};
