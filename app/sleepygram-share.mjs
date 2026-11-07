const RELAY='https://neon-trinity-music.mikebamlee.chatgpt.site/api/sleepygram/';
const APP='https://sleepygram.mikebamlee.chatgpt.site';
const sessionAccount=token=>{try{const payload=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const claims=JSON.parse(atob(payload));return typeof claims.sub==='string'?claims.sub:'';}catch{return '';}};
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class SleepygramAPI{
 constructor({getToken,getIdentity,fetcher=globalThis.fetch,source='studio'}){Object.assign(this,{getToken,getIdentity,fetcher,source});}
 async identity(){const person=await this.getIdentity();if(!person?.id)throw new Error('Bitte zuerst mit deinem Discord-Konto anmelden.');return person;}
 async request(path,{body,owner,method='POST'}={}){
  const person=await this.identity();if(owner&&person.id!==owner)throw new Error('Das Discord-Konto wurde gewechselt. Bitte das Teilen erneut öffnen.');
  const token=await this.getToken();if(!token)throw new Error('Bitte erneut mit Discord anmelden.');if(sessionAccount(token)!==person.id)throw new Error('Deine Discord-Sitzung und dein Studio-Konto stimmen nicht überein. Bitte erneut anmelden.');
  if((await this.identity()).id!==person.id)throw new Error('Das Konto wurde gewechselt.');
  const headers={Authorization:'Bearer '+token};if(body!==undefined&&!(body instanceof FormData))headers['Content-Type']='application/json';
  const response=await this.fetcher(RELAY+path,{method,headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(path==='upload'?120000:25000)});
  let data;try{data=await response.json();}catch{throw new Error('Sleepygram ist gerade nicht erreichbar.');}if(!response.ok)throw new Error(data.error||'Das Teilen hat nicht geklappt.');if((await this.identity()).id!==person.id)throw new Error('Das Konto wurde gewechselt. Die Datei wurde nicht unter dem neuen Konto veröffentlicht.');return data;
 }
 session(owner){return this.request('studio-session',{method:'GET',owner});}
 profile(values,owner){return this.request('profile',{owner,body:values});}
 async upload(file,owner){const audio=file.type.startsWith('audio/'),image=file.type.startsWith('image/');if(!audio&&!image)throw new Error('Bitte ein Bild oder einen Song auswählen.');if(file.size===0||file.size>(audio?48:20)*1024*1024)throw new Error(audio?'Der Song darf maximal 48 MB groß sein.':'Das Bild darf maximal 20 MB groß sein.');const body=new FormData();body.set('file',file);return this.request('upload',{owner,body});}
 draft(values,owner){return this.request('draft',{owner,body:{...values,source:this.source}});}
 publish(values,owner){return this.request('post',{owner,body:{...values,kind:'post'}});}
}
export function createSleepygramShare(options){
 const api=new SleepygramAPI(options);let current=null;
 async function open({title='',choices=[],caption=title}={}){
  current?.close();const person=await api.identity(),owner=person.id;
  const doc=options.document??globalThis.document;if(!doc)throw new Error('Die Teilen-Ansicht ist nicht verfügbar.');
  if(!doc.querySelector('link[data-sleepygram-share]')){const css=doc.createElement('link');css.rel='stylesheet';css.href=new URL('./sleepygram-share.css',import.meta.url).href;css.dataset.sleepygramShare='';doc.head.append(css);}
  const dialog=doc.createElement('dialog');dialog.className='sg-share-dialog';dialog.setAttribute('aria-label','Auf Sleepygram teilen');
  dialog.innerHTML=`<form class="sg-share-form"><header><div><small>NOSLEEP RECORDS</small><h2>Ab in deine Nacht.</h2></div><button type="button" data-close aria-label="Schließen">×</button></header><p class="sg-intro">Teile ein Bild oder einen Song direkt über dein Sleepygram-Profil. Deine Datei im ${options.source==='website'?'Künstlerbereich':'Studio'} bleibt erhalten.</p><div class="sg-account">Dein Sleepygram-Profil wird geladen …</div><div class="sg-new-profile" hidden><p>Lege zuerst dein Sleepygram-Profil an.</p><label>Anzeigename<input name="profileName" maxlength="50" value="${h(person.alias||person.name||'')}"></label><label>Sleepygram-Handle<input name="handle" minlength="3" maxlength="30" pattern="[a-z0-9][a-z0-9._]{2,29}" value="${h(String(person.alias||person.name||'').toLowerCase().replace(/[^a-z0-9._]/g,'').slice(0,18)+'.afterhours')}"></label></div><label>Datei<select name="choice">${choices.map((c,i)=>`<option value="${i}">${h(c.label)}</option>`).join('')}<option value="file"${choices.length?'':' selected'}>Andere Datei auswählen</option></select></label><label class="sg-file"${choices.length?' hidden':''}>Bild oder Song auswählen<input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/flac"></label><div class="sg-preview" hidden></div><label>Dein Beitrag<textarea name="caption" rows="4" maxlength="2200" placeholder="Was möchtest du erzählen?">${h(caption)}</textarea></label><p class="sg-error" role="alert" hidden></p><p class="sg-result" role="status" hidden></p><footer><button type="button" data-draft>In Sleepygram bearbeiten</button><button class="sg-primary" type="submit">Auf Sleepygram posten</button></footer></form>`;
  doc.body.append(dialog);const form=dialog.querySelector('form'),account=form.querySelector('.sg-account'),newProfile=form.querySelector('.sg-new-profile'),error=form.querySelector('.sg-error'),result=form.querySelector('.sg-result');
  let session=null,busy=false,previewURL='',fileCache=null,fileChoice='',closed=false;
  const stop=()=>{if(busy)return;closed=true;if(previewURL)URL.revokeObjectURL(previewURL);dialog.close();dialog.remove();if(current?.dialog===dialog)current=null;};current={dialog,close:stop};
  form.querySelector('[data-close]').onclick=stop;dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();else stop();});dialog.addEventListener('click',e=>{if(e.target===dialog)stop();});
  const showError=e=>{error.hidden=false;error.textContent=e.message||String(e);};
  async function selectedFile(){
   const selected=form.elements.choice.value;if(selected==='file'){const file=form.elements.file.files[0];if(!file)throw new Error('Bitte eine Datei auswählen.');return file;}
   if(fileCache&&fileChoice===selected)return fileCache;
   const choice=choices[Number(selected)];if(!choice)throw new Error('Diese Datei ist nicht mehr verfügbar.');const blob=await choice.getBlob();if(!blob)throw new Error('Die Originaldatei fehlt. Bitte erneut auswählen.');if((await api.identity()).id!==owner)throw new Error('Das Konto wurde gewechselt.');fileCache=new File([blob],choice.name||'Sleepygram-Datei',{type:blob.type});fileChoice=selected;return fileCache;
  }
  async function preview(){const value=form.elements.choice.value;form.querySelector('.sg-file').hidden=value!=='file';error.hidden=true;const node=form.querySelector('.sg-preview');node.replaceChildren();node.hidden=true;if(previewURL){URL.revokeObjectURL(previewURL);previewURL='';}try{const file=await selectedFile();if(closed)return;previewURL=URL.createObjectURL(file);if(file.type.startsWith('image/')){const img=doc.createElement('img');img.alt='Vorschau deiner Datei';img.src=previewURL;node.append(img);}else{const audio=doc.createElement('audio');audio.controls=true;audio.preload='metadata';audio.src=previewURL;node.append(audio);}const label=doc.createElement('small');label.textContent=file.name+' · '+(file.size/1024/1024).toFixed(1)+' MB';node.append(label);node.hidden=false;}catch(e){if(value!=='file'||form.elements.file.files.length)showError(e);}}
  form.elements.choice.onchange=()=>void preview();form.elements.file.onchange=()=>void preview();
  async function submit(draftOnly){if(busy)return;if(!session)return showError(new Error('Bitte die Profilprüfung abwarten.'));busy=true;error.hidden=true;result.hidden=true;const controls=[...form.querySelectorAll('button,input,select,textarea')];controls.forEach(e=>e.disabled=true);
   try{if((await api.identity()).id!==owner)throw new Error('Bitte das Teilen unter deinem aktuellen Konto erneut öffnen.');
    if(!session.me){const name=form.elements.profileName.value.trim(),handle=form.elements.handle.value.trim().toLowerCase().replace(/^@/,'');if(!name||!/^[a-z0-9][a-z0-9._]{2,29}$/.test(handle))throw new Error('Bitte Anzeigenamen und einen gültigen Handle mit 3–30 Zeichen eingeben.');await api.profile({name,handle,ingame:person.alias||name,bio:'',accent:'violet',design:'midnight'},owner);session=await api.session(owner);account.textContent='Du postest als '+session.me.name+' · @'+session.me.handle;newProfile.hidden=true;}
    const file=await selectedFile(),media=await api.upload(file,owner),values={caption:form.elements.caption.value.trim(),media:media.url,category:file.type.startsWith('audio/')?'Musik':'Artwork'};
    const saved=await api.draft(values,owner);let url;
    if(draftOnly){if(typeof saved.url!=='string'||!saved.url.startsWith(APP+'/share?draft='))throw new Error('Der Entwurfslink ist ungültig.');url=saved.url;result.textContent='Dein Entwurf ist bereit. ';}
    else{const posted=await api.publish({...values,draftId:saved.id},owner);if(!/^[a-f0-9-]{36}$/.test(posted.id))throw new Error('Der Beitrag wurde gespeichert, sein Link konnte aber nicht geprüft werden.');url=APP+'/#post='+posted.id;result.textContent='Dein Beitrag ist auf Sleepygram veröffentlicht. ';}
    const link=doc.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=draftOnly?'Entwurf öffnen ↗':'Beitrag öffnen ↗';result.append(link);result.hidden=false;form.querySelector('footer').hidden=true;options.notify?.(draftOnly?'Sleepygram-Entwurf erstellt.':'Auf Sleepygram geteilt.');
   }catch(e){showError(e);}finally{busy=false;controls.forEach(e=>e.disabled=false);}
  }
  form.addEventListener('submit',event=>{event.preventDefault();void submit(false);});form.querySelector('[data-draft]').onclick=()=>void submit(true);
  dialog.showModal();
  try{session=await api.session(owner);if(closed)return;account.textContent=session.me?'Du postest als '+session.me.name+' · @'+session.me.handle:'Mit deinem Discord-Konto verbunden';newProfile.hidden=!!session.me;await preview();}catch(e){showError(e);}
  return current;
 }
 return {open,api};
}
