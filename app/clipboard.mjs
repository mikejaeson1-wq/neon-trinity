export function selectCopyInput(input){
 if(!input)return;
 input.focus?.({preventScroll:true});input.select?.();input.setSelectionRange?.(0,input.value.length);
}

// Native writes do not depend on Chromium clipboard permissions or a gesture
// remaining active after a long MP3 export. Browser users keep a local fallback.
export async function copyText(text,{bridge=globalThis.window?.neonDesktop,clipboard=globalThis.navigator?.clipboard,document=globalThis.document,input=null}={}){
 if(typeof text!=='string'||!text||text.length>65536||text.includes('\0'))throw new Error('Ungültiger Text zum Kopieren.');
 if(typeof bridge?.writeClipboardText==='function')try{await bridge.writeClipboardText(text);return true;}catch{}
 if(typeof clipboard?.writeText==='function')try{await clipboard.writeText(text);return true;}catch{}
 let field=input?.value===text?input:null,temporary=false;
 try{
  if(typeof document?.execCommand!=='function')throw new Error('Kein Kopierweg verfügbar.');
  if(!field){field=document.createElement('textarea');field.value=text;field.readOnly=true;field.setAttribute('aria-label','Text zum Kopieren');field.style.position='fixed';field.style.opacity='0';(document.querySelector('dialog[open]')||document.body).append(field);temporary=true;}
  selectCopyInput(field);
  if(document.execCommand('copy')!==true)throw new Error('Kopieren wurde nicht bestätigt.');
  return true;
 }catch{selectCopyInput(input);throw new Error('Die Zwischenablage ist gerade nicht erreichbar.');}
 finally{if(temporary)field?.remove();}
}
