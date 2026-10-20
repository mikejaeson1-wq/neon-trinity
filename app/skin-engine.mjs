const color=(v,d)=>/^#[a-f0-9]{6}$/i.test(v||'')?v.toLowerCase():d;
const bound=(v,a,b,d)=>Number.isFinite(Number(v))?Math.max(a,Math.min(b,Number(v))):d;
const image=v=>typeof v==='string'&&v.length<=240000&&/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v)?v:'';
export function skinInput(input={}){
 return {id:/^[a-zA-Z0-9-]{1,80}$/.test(input.id||'')?input.id:crypto.randomUUID(),name:String(input.name||'Mein Skin').slice(0,50),deck:color(input.deck,'#252832'),edge:color(input.edge,'#69717e'),text:color(input.text,'#eef2f5'),lcd:color(input.lcd,'#111d18'),ink:color(input.ink,'#b8ef9b'),button:color(input.button,'#3b414c'),accent:color(input.accent,'#b4f97a'),radius:bound(input.radius,0,32,8),font:['system','mono','serif'].includes(input.font)?input.font:'mono',image:image(input.image)};
}
const variables=['--deck','--deck-edge','--deck-text','--lcd','--lcd-ink','--deck-button','--deck-accent','--custom-radius','--custom-font','--custom-image'];
export function applySkin(root,value,enabled=true){
 if(!root?.style)return;if(!enabled){for(const key of variables)root.style.removeProperty(key);return;}const s=skinInput(value);
 for(const [key,val] of Object.entries({'--deck':s.deck,'--deck-edge':s.edge,'--deck-text':s.text,'--lcd':s.lcd,'--lcd-ink':s.ink,'--deck-button':s.button,'--deck-accent':s.accent,'--custom-radius':s.radius+'px','--custom-font':s.font==='system'?'Segoe UI, sans-serif':s.font==='serif'?'Georgia, serif':'Consolas, monospace','--custom-image':s.image?'url("'+s.image+'")':'none'}))root.style.setProperty(key,val);
}
export function sceneInput(input={}){
 return {id:/^[a-zA-Z0-9-]{1,80}$/.test(input.id||'')?input.id:crypto.randomUUID(),name:String(input.name||'Meine Szene').slice(0,50),color1:color(input.color1,'#2eff80'),color2:color(input.color2,'#bd33ff'),background:color(input.background,'#0c0913'),image:image(input.image),layers:(Array.isArray(input.layers)?input.layers:[{mode:'bars',opacity:1,scale:1}]).slice(0,4).map(l=>({mode:['bars','wave','orbit','particles'].includes(l?.mode)?l.mode:'bars',opacity:bound(l?.opacity,.1,1,.7),scale:bound(l?.scale,.3,2,1)}))};
}
export function importDesign(text,format){
 if(typeof text!=='string'||text.length>400000)throw new Error('Die Designdatei ist zu groß.');let data;try{data=JSON.parse(text);}catch{throw new Error('Bitte eine gültige Designdatei auswählen.');}
 if(data.format!==format||data.version!==1)throw new Error('Diese Datei ist kein passendes Neon-Trinity-Design.');return format==='neon-trinity-skin'?skinInput(data.skin):sceneInput(data.scene);
}
export async function designImage(file,{bitmap=globalThis.createImageBitmap,document=globalThis.document}={}){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Bitte ein JPG-, PNG- oder WebP-Bild bis 8 MiB auswählen.');const img=await bitmap(file);try{if(!img.width||!img.height||img.width*img.height>40000000)throw new Error('Das Bild ist zu groß.');const canvas=document.createElement('canvas'),scale=Math.min(1,640/img.width,360/img.height);canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const result=canvas.toDataURL('image/webp',.8);if(!image(result))throw new Error('Das Bild konnte nicht ausreichend verkleinert werden.');return result;}finally{img.close?.();}
}
export function pulseMascot(root,spectrum,{enabled=true,intensity=1}={}){
 if(!root?.style)return;const energy=enabled&&Array.isArray(spectrum)&&spectrum.length?spectrum.slice(0,8).reduce((n,x)=>n+Math.max(0,Math.min(100,Number(x)||0)),0)/Math.min(8,spectrum.length)/100:0;root.style.setProperty('--music-pulse',String(Math.max(0,Math.min(1,energy*bound(intensity,0,2,1)))));
}
