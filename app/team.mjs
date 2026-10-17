import {emptyCatalog,snapshot,diffCatalog,overlayOperations,applyToState,sameRecord} from './shared.mjs';
import {SupabaseBackend} from './cloud.mjs';
import {CLOUD} from './cloud-config.mjs';
export class TeamClient {
 constructor({getState,setState,getBlob,putBlob,onStatus=()=>{},onConflict=()=>{},backend}){Object.assign(this,{getState,setState,getBlob,putBlob,onStatus,onConflict});this.backend=backend||new SupabaseBackend();this.base=CLOUD.studioUrl;this.user=null;this.pendingIdentity=null;this.baseline=null;this.busy=false;this.conflict=null;this.timer=null;this.channel=null;this.privateVersion=0;this.privateBusy=false;this.info=this.backend.info;}
 get active(){return !!this.user;}
 async api(path,method='GET',data,blob){
  if(path==='/api/status')return this.backend.status();
  if(path==='/api/catalog')return method==='GET'?{catalog:(await this.backend.catalog()).data}:this.backend.save(data.operations);
  if(path==='/api/media'&&method==='POST')return this.backend.upload(blob.id,blob.data);
  if(path.startsWith('/api/media/'))return this.backend.download(decodeURIComponent(path.slice(11)),this.baseline||emptyCatalog());
  if(path==='/api/publish')return this.backend.publish(data.albumIds,data.theme);
  if(path==='/api/pages')return {status:'Supabase verbunden',url:this.info.publicBase+'/album.html'};
  if(path.startsWith('/api/listen'))return this.backend.publicRequest(path.slice(4),method,data?{...data,publicBase:this.info.publicBase}:undefined);
  throw new Error('Unbekannte Supabase-Anfrage.');
 }
 async detect(){
  if(typeof location==='undefined'||!location.href)return false;
  try{
   this.info=await this.backend.status();
   const discordEnabled=await this.backend.discordAvailable().catch(()=>null);
   const url=typeof location!=='undefined'&&location.href?new URL(location.href):null;
   const code=url?.searchParams.get('code'),error=url?.searchParams.get('error_description');
   if(code){const result=await this.backend.client.auth.exchangeCodeForSession(code);if(result.error)throw result.error;history.replaceState({},'',url.pathname+'#team');}
   if(error){history.replaceState({},'',url.pathname+'#team');throw new Error(error);}
   const {data,error:sessionError}=await this.backend.client.auth.getSession();if(sessionError)throw sessionError;
   if(data.session)await this.resume();else this.onStatus(discordEnabled===false?'Discord ist in Supabase noch nicht aktiviert. Bitte den Discord-Anbieter einmal einrichten.':'Mit Supabase verbunden · bitte mit Discord anmelden.',discordEnabled===false?'setup':'local');
   return true;
  }catch(error){this.onStatus(error.message||'Supabase ist gerade nicht erreichbar. Lokale Daten bleiben verfügbar.','offline');return false;}
 }
 async configure(){this.info=await this.backend.status();return this.info;}
 async login(){
  if(!await this.backend.discordAvailable())throw new Error('Discord ist in Supabase noch nicht aktiviert. Öffne die Einrichtungshilfe und hinterlege unter Authentication → Sign In / Providers → Discord eure Client ID und Client Secret.');
  const desktop=window.neonDesktop?.cloudStartLogin;
  const callback=desktop?await window.neonDesktop.cloudStartLogin():new URL('index.html',location.href).href.split('#')[0].split('?')[0];
  try{
   const {data,error}=await this.backend.client.auth.signInWithOAuth({provider:'discord',options:{redirectTo:callback,skipBrowserRedirect:true}});
   if(error)throw error;
   if(desktop){await window.neonDesktop.cloudOpenLogin(data.url);return {code:'Discord → Neon Trinity'};}
   location.assign(data.url);return null;
  }catch(error){if(desktop)await window.neonDesktop.cloudCancelLogin?.().catch(()=>{});throw error;}
 }
 async pollLogin(){const result=await window.neonDesktop.cloudPollLogin();if(result.status!=='ready')return result;const exchange=await this.backend.client.auth.exchangeCodeForSession(result.code);if(exchange.error)throw exchange.error;await this.resume();return {status:'ready',user:this.user,pending:this.pendingIdentity};}
 async resume(){
  clearInterval(this.timer);if(this.channel)await this.backend.client.removeChannel(this.channel);
  const actor=await this.backend.identity();this.pendingIdentity=actor;
  if(!actor?.allowed){this.user=null;this.onStatus(`Discord erkannt. Dein Konto ${actor?.discordId||''} muss noch als Dex, Nix oder Jax freigeschaltet werden.`,'pending');return;}
  this.user=actor;this.pendingIdentity=null;
  const state=this.getState();state.settings.backend='supabase';state.settings.publicBase=this.info.publicBase;
  const previousProject=state._sharedProject===CLOUD.project;
  const local=snapshot(state),old=previousProject?(state._sharedBaseline||emptyCatalog()):emptyCatalog();
  if(!previousProject){local.assets=[];local.publications=[];state.published={};}
  const remote=(await this.api('/api/catalog')).catalog;
  const pending=diffCatalog(old,local).filter(op=>{const existing=remote[op.kind].find(x=>x.id===op.id);return !(op.value&&existing&&sameRecord(existing,op.value));});
  this.baseline={...old,assets:remote.assets};
  if(pending.length){await this.ensureAssets(local);try{const operations=[...pending.filter(o=>o.kind!=='assets'),...diffCatalog(this.baseline,local).filter(o=>o.kind==='assets')];const saved=await this.api('/api/catalog','PATCH',{operations});this.accept(saved.catalog);}catch(error){if(error.status===409){this.conflict={local,operations:pending,remote:error.data?.catalog||remote};this.onConflict(this.conflict);}else throw error;}}
  else this.accept(remote);
  await this.pullPrivate();
  this.timer=setInterval(()=>this.pull().catch(e=>this.onStatus(e.message,'offline')),8000);this.timer.unref?.();
  this.channel=this.backend.client.channel('nt-catalog-'+crypto.randomUUID()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'nt_catalog'},()=>this.pull().catch(e=>this.onStatus(e.message,'offline'))).subscribe(status=>{if(status==='CHANNEL_ERROR')this.onStatus('Echtzeitverbindung unterbrochen · automatischer Abgleich bleibt aktiv.','offline');});
  this.onStatus(`Als ${actor.alias} verbunden · Gemeinsame Inhalte werden automatisch abgeglichen.`,'connected');
 }
 accept(catalog,preserve){this.baseline=structuredClone(catalog);const current=this.getState();applyToState(current,preserve?overlayOperations(catalog,preserve):catalog);current._sharedProject=CLOUD.project;current._sharedBaseline=structuredClone(catalog);this.setState(current);}
 async ensureAssets(desired){const assets=new Map([...(this.baseline?.assets||[]),...(desired.assets||[])].filter(a=>a.provider==='supabase').map(a=>[a.id,a]));const keys=new Set([...desired.tracks.flatMap(t=>[t.blobId,t.coverBlobId]),...desired.albums.map(a=>a.coverBlobId)].filter(Boolean));for(const key of keys){if(assets.has(key))continue;const blob=await this.getBlob(key);if(!blob)throw new Error('Eine lokale Mediendatei fehlt. Bitte das vollständige Backup wiederherstellen.');this.onStatus('MP3s und Cover werden in Supabase gespeichert …','syncing');assets.set(key,await this.backend.upload(key,blob));}desired.assets=[...assets.values()];}
 async push(state){if(!this.active)return;if(this.conflict)throw new Error('Bitte zuerst den angezeigten Team-Konflikt auflösen.');this.busy=true;try{const desired=snapshot(state);await this.ensureAssets(desired);const operations=diffCatalog(this.baseline||emptyCatalog(),desired);if(!operations.length)return;this.onStatus('Änderungen werden in Supabase gespeichert …','syncing');try{const result=await this.api('/api/catalog','PATCH',{operations});const later=diffCatalog(snapshot(state),snapshot(this.getState())).filter(op=>op.kind!=='assets');this.accept(result.catalog,later);this.onStatus(`Als ${this.user.alias} verbunden · Änderungen gespeichert`,'connected');}catch(error){if(error.status===409){this.conflict={local:desired,operations,remote:error.data?.catalog};this.onConflict(this.conflict);}throw error;}}finally{this.busy=false;}}
 async pull(){if(!this.active||this.busy||this.conflict||document.querySelector('dialog[open]'))return;this.info=await this.backend.status();this.getState().settings.publicBase=this.info.publicBase;if(diffCatalog(this.baseline,snapshot(this.getState())).length){await this.push(structuredClone(this.getState()));return;}const result=await this.api('/api/catalog');if(JSON.stringify(result.catalog)!==JSON.stringify(this.baseline))this.accept(result.catalog);await this.pullPrivate();}
 async pullPrivate(){if(!this.active||this.privateBusy||!this.backend.privatePlaylists)return;const generation=this.privateVersion,owner=this.user.id,playlists=await this.backend.privatePlaylists();if(this.user?.id!==owner||generation!==this.privateVersion)return;const state=this.getState();if(JSON.stringify(state.privatePlaylists||[])!==JSON.stringify(playlists)){state.privatePlaylists=playlists;this.setState(state);}}
 async savePrivate(record){if(!this.active)throw new Error('Bitte zuerst mit Discord anmelden.');const current=this.getState(),localIds=new Set((current.localTracks||[]).map(t=>t.id));if(record.trackIds.some(id=>localIds.has(id)))throw new Error('Private lokale Songs können nur in lokalen Playlists gespeichert werden.');const owner=this.user.id;this.privateVersion++;this.privateBusy=true;let saved;try{saved=await this.backend.savePrivatePlaylist(record);}finally{this.privateBusy=false;}if(this.user?.id!==owner)throw new Error('Das Discord-Konto wurde während des Speicherns gewechselt.');const state=this.getState();state.privatePlaylists=(state.privatePlaylists||[]).filter(p=>p.ownerId===owner&&p.id!==saved.id);state.privatePlaylists.push(saved);this.setState(state);return saved;}
 async deletePrivate(record){if(!this.active||record.ownerId!==this.user.id)throw new Error('Diese Playlist gehört zu einem anderen Discord-Konto.');this.privateVersion++;this.privateBusy=true;try{await this.backend.deletePrivatePlaylist(record);}finally{this.privateBusy=false;}const state=this.getState();state.privatePlaylists=(state.privatePlaylists||[]).filter(p=>p.id!==record.id);this.setState(state);}
 async resolve(keepLocal){const conflict=this.conflict;if(!conflict)return;this.conflict=null;const fresh=(await this.api('/api/catalog')).catalog;if(keepLocal){this.baseline=fresh;const state=this.getState();applyToState(state,overlayOperations(fresh,conflict.operations));await this.push(state);}else this.accept(fresh);this.onStatus('Team-Konflikt aufgelöst.','connected');}
 async fetchBlob(id){const local=await this.getBlob(id);if(local)return local;if(!this.active)return null;const blob=await this.backend.download(id,this.baseline||emptyCatalog());await this.putBlob(id,blob);return blob;}
 async logout(){clearInterval(this.timer);if(this.channel)await this.backend.client.removeChannel(this.channel);this.channel=null;const {error}=await this.backend.client.auth.signOut({scope:'local'});if(error)throw error;await window.neonDesktop?.cloudCancelLogin?.();this.user=null;this.pendingIdentity=null;this.baseline=null;const state=this.getState();state.privatePlaylists=[];this.setState(state);this.onStatus('Von Discord abgemeldet · lokale Daten bleiben erhalten.','local');}
}
