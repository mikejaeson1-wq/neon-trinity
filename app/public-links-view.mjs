import {escapeHTML as h,songLink} from './core.mjs';

export class PublicSongLinks {
 constructor({team,getState,sync,modal,closeModal,toast,fail,document=globalThis.document,clipboard=globalThis.navigator?.clipboard}){Object.assign(this,{team,getState,sync,modal,closeModal,toast,fail,document,clipboard});this.busy=false;}
 check(owner){if(!owner||this.team.user?.id!==owner)throw new Error('Das Konto wurde gewechselt. Bitte die Freigabe erneut öffnen.');}
 async copy(url,title){try{await this.clipboard.writeText(url);this.toast('Öffentlicher Hörlink kopiert. Du kannst ihn in Discord einfügen.');}catch{this.showLink(url,title);}}
 showLink(url,title){
  this.modal(`<h2>Hörlink für Discord.</h2><p class="subtitle">${h(title)} · Ohne Studio und Anmeldung im Browser hören.</p><label class="field"><span>Öffentlicher Hörlink</span><input id="public-hear-url" readonly value="${h(url)}"></label><div class="form-actions"><a class="button ghost" href="${h(url)}" target="_blank" rel="noopener">HTML-Seite öffnen ↗</a><button class="button primary" id="public-hear-copy">Link kopieren</button></div><p id="public-hear-status" role="status"></p>`);
  const input=this.document.querySelector('#public-hear-url');input.onclick=()=>input.select();
  this.document.querySelector('#public-hear-copy').onclick=async()=>{try{await this.clipboard.writeText(url);this.document.querySelector('#public-hear-status').textContent='Link kopiert. Jetzt in Discord einfügen.';}catch{input.select();this.document.querySelector('#public-hear-status').textContent='Bitte den markierten Link mit Strg+C kopieren.';}};
 }
 async open(id,{manage=false}={}){
  if(this.busy)throw new Error('Bitte die laufende Veröffentlichung abwarten.');
  const owner=this.team.user?.id;this.check(owner);
  const track=this.getState().tracks.find(t=>t.id===id);
  if(!track)throw new Error('Öffentliche Hörlinks sind für Band-Songs verfügbar. Eigene lokale MP3s zuerst ausdrücklich in die Bandmediathek kopieren.');
  const published=await this.team.backend.publicSong(id);this.check(owner);
  const url=songLink(id,this.getState().settings);
  if(published&&!manage)return this.copy(url,track.title);
  this.modal(`<h2>${published?'Öffentlichen Song verwalten.':'Song öffentlich teilen?'}</h2><p class="subtitle">${h(track.title)} · Eigene HTML-Seite mit Cover und Player.</p><div class="note">Jeder mit dem Link kann diesen Song ohne Studio und ohne Anmeldung hören. Andere Songs werden nicht mit veröffentlicht.</div><label class="checkbox-line"><input id="public-song-consent" type="checkbox"><span>Diesen Song einschließlich Cover, Songtext und Credits öffentlich freigeben. Audiodaten können von Zuhörern gespeichert werden.</span></label><div class="form-actions">${published?'<button class="button ghost" id="public-song-withdraw">Öffentliche Freigabe zurückziehen</button>':''}<button class="button primary" id="public-song-publish" disabled>${published?'Freigabe aktualisieren & Link kopieren':'Veröffentlichen & Link kopieren'}</button></div><p id="public-song-progress" role="status"></p>`);
  const button=this.document.querySelector('#public-song-publish'),consent=this.document.querySelector('#public-song-consent'),withdraw=this.document.querySelector('#public-song-withdraw');
  consent.onchange=()=>button.disabled=!consent.checked;
  const run=async remove=>{
   if(this.busy||!remove&&!consent.checked)return;this.busy=true;button.disabled=true;if(withdraw)withdraw.disabled=true;
   try{
    this.check(owner);
    if(remove){await this.team.backend.withdrawPublicSong(id);this.check(owner);this.closeModal();this.toast('Öffentliche Songfreigabe entfernt. Bereits geladene Audiodaten können noch vorhanden sein.');}
    else {this.document.querySelector('#public-song-progress').textContent='Song wird veröffentlicht …';await this.sync();this.check(owner);await this.team.backend.publishSong(id,this.getState().theme,owner);this.check(owner);await this.copy(url,track.title);if(this.document.querySelector('#public-song-progress'))this.showLink(url,track.title);}
   }catch(error){const status=this.document.querySelector('#public-song-progress');if(status)status.textContent=error.message;this.fail(error);}
   finally{this.busy=false;if(button.isConnected)button.disabled=!consent.checked;if(withdraw?.isConnected)withdraw.disabled=false;}
  };
  button.onclick=()=>run(false);if(withdraw)withdraw.onclick=()=>run(true);
 }
}
