import {escapeHTML as h} from './core.mjs';
import {copyText,selectCopyInput} from './clipboard.mjs';

export async function showMusicboxResult({document=globalThis.document,result,toast=()=>{},closeModal,copy=copyText,bridge=globalThis.window?.neonDesktop}){
 const content=document.querySelector('#modal-content');
 content.innerHTML=`<h2>Musikbox-Link bereit.</h2><p class="subtitle">${h(result.title)} · ${result.trackCount} ${result.trackCount===1?'Song':'Songs'}</p><p>Kopiere diese MP3-URL in das URL-Feld der Conan-Musikbox.</p><label class="field"><span>Direkter MP3-Link</span><input id="musicbox-url" type="text" readonly spellcheck="false" value="${h(result.url)}"></label><div class="form-actions"><button class="button primary" id="musicbox-copy" type="button">Link kopieren</button><button class="button ghost" id="musicbox-done" type="button">Fertig</button></div><p id="musicbox-copy-status" class="notice" role="status" aria-live="polite"></p><p class="notice">Der Link läuft nicht automatisch ab. Wird die Musik später geändert, erhält die neue Audiofassung einen eigenen Link. Alte Links bleiben bis zum Entfernen erreichbar.</p>`;
 const input=content.querySelector('#musicbox-url'),button=content.querySelector('#musicbox-copy'),status=content.querySelector('#musicbox-copy-status');
 const write=async(text=result.url)=>{button.disabled=true;try{await copy(text,{bridge,input,document});if(!status.isConnected)return;status.textContent='Musikbox-Link kopiert. Jetzt in Conan einfügen.';toast('Musikbox-Link kopiert.');}catch{if(!input.isConnected)return;selectCopyInput(input);status.textContent='Der Link ist markiert. Mit Strg+C oder Rechtsklick → Kopieren übernehmen.';}finally{if(button.isConnected)button.disabled=false;}};
 button.onclick=()=>write();input.onclick=()=>selectCopyInput(input);
 input.onkeydown=event=>{
  if(!(event.ctrlKey||event.metaKey)||event.altKey||event.shiftKey||String(event.key).toLowerCase()!=='c'||typeof bridge?.writeClipboardText!=='function')return;
  const start=input.selectionStart,end=input.selectionEnd;
  if(Number.isInteger(start)&&Number.isInteger(end)&&end>start){event.preventDefault();return write(input.value.slice(start,end));}
 };
 content.querySelector('#musicbox-done').onclick=closeModal;
 selectCopyInput(input);await write();
 return {input,button,status};
}
