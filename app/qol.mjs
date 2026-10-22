// Shared player rules for the Studio, miniplayer and mobile app.
export const REPEAT_MODES=['off','context','track'];
export const repeatMode=value=>REPEAT_MODES.includes(value)?value:value===true?'context':'off';
export const nextRepeat=value=>REPEAT_MODES[(REPEAT_MODES.indexOf(repeatMode(value))+1)%3];
export const repeatLabel=value=>({off:'Wiederholung aus',context:'Ganze Playlist wiederholen',track:'Einzelnen Song wiederholen'})[repeatMode(value)];
const clamp=(n,a,b,f=0)=>Number.isFinite(Number(n))?Math.max(a,Math.min(b,Number(n))):f;
export function qolSettings(settings){
 if(!settings.qol||typeof settings.qol!=='object'||Array.isArray(settings.qol))settings.qol={};const q=settings.qol;
 q.repeat=repeatMode(q.repeat);q.shuffle=q.shuffle===true;q.volume=clamp(q.volume,0,1,.8);
 q.unmuted=q.unmuted&&typeof q.unmuted==='object'?q.unmuted:{};
 q.views=q.views&&typeof q.views==='object'?q.views:{};
 q.pins=Array.isArray(q.pins)?q.pins.filter(p=>p&&typeof p.route==='string'&&/^(search|overview|library|local|suno|spotify|player|studio|albums|album|playlists|events|team|mobile|visualizer|profiles|live|settings|listen)(\/[-a-zA-Z0-9]+)?$/.test(p.route)).slice(0,30):[];
 q.shortcuts={...DEFAULT_SHORTCUTS,...q.shortcuts};return q;
}
export class QueueNavigator{
 constructor(random=Math.random){this.random=random;this.reset();}
 reset(){this.history=[];this.cursor=-1;this.visited=new Set();this.bag=[];this.signature='';}
 commit(id){
  if(!id)return;
  if(this.history[this.cursor]===id){this.visited.add(id);return;}
  if(this.history[this.cursor-1]===id)this.cursor--;
  else if(this.history[this.cursor+1]===id)this.cursor++;
  else{this.history.splice(this.cursor+1);this.history.push(id);this.cursor=this.history.length-1;if(this.history.length>1000){this.history.shift();this.cursor--;}}
  this.visited.add(id);this.bag=this.bag.filter(key=>key!==id);
 }
 next(ids,current,{direction=1,auto=false,shuffle=false,repeat='off',available=()=>true}={}){
  const queue=[...new Set(ids)].filter(available);if(!queue.length)return null;
  repeat=repeatMode(repeat);if(auto&&repeat==='track'&&queue.includes(current))return current;
  const signature=JSON.stringify([queue,shuffle]);if(signature!==this.signature){this.signature=signature;this.bag=[];this.visited=new Set([...this.visited].filter(id=>queue.includes(id)));}
  if(current)this.visited.add(current);
  if(shuffle){
   if(!auto){const prior=this.history[this.cursor+direction];if(prior&&queue.includes(prior))return prior;if(direction<0)return current||queue[0];}
   this.bag=this.bag.filter(id=>queue.includes(id)&&id!==current&&!this.visited.has(id));
   if(!this.bag.length){
    let fresh=queue.filter(id=>!this.visited.has(id)&&id!==current);
    if(!fresh.length){if(auto&&repeat==='off')return null;this.visited=new Set(current?[current]:[]);fresh=queue.filter(id=>id!==current);}
    for(let i=fresh.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[fresh[i],fresh[j]]=[fresh[j],fresh[i]];}
    this.bag=fresh;
   }
   return this.bag[0]||((repeat==='context'||!auto)?queue[0]:null);
  }
  let index=queue.indexOf(current)+direction;if(index>=queue.length){if(auto&&repeat==='off')return null;index=0;}if(index<0)index=queue.length-1;return queue[index]||null;
 }
}
export const DEFAULT_SHORTCUTS={toggle:'Space',next:'Alt+ArrowRight',previous:'Alt+ArrowLeft',forward:'ArrowRight',backward:'ArrowLeft',volumeUp:'ArrowUp',volumeDown:'ArrowDown',mute:'KeyM',mini:'Alt+KeyM',repeat:'KeyR',shuffle:'KeyS',search:'Slash'};
export const SHORTCUT_NAMES={toggle:'Abspielen / Pause',next:'Nächster Song',previous:'Vorheriger Song',forward:'10 Sekunden vor',backward:'10 Sekunden zurück',volumeUp:'Lauter',volumeDown:'Leiser',mute:'Stumm',mini:'Miniplayer',repeat:'Repeat',shuffle:'Shuffle',search:'Suche'};
export function eventShortcut(e){return [e.ctrlKey?'Ctrl':'',e.altKey?'Alt':'',e.shiftKey?'Shift':'',e.metaKey?'Meta':'',e.code].filter(Boolean).join('+');}
export function shortcutConflicts(bindings){const seen=new Map(),errors=[];for(const [key,value] of Object.entries(bindings)){if(!Object.hasOwn(DEFAULT_SHORTCUTS,key))continue;if(!value)continue;if(!/^(?:(?:Ctrl|Alt|Shift|Meta)\+)*(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Space|Slash|Arrow(?:Left|Right|Up|Down)|Home|End|PageUp|PageDown)$/.test(value)){errors.push('Ungültiges Kürzel für '+SHORTCUT_NAMES[key]);continue;}if(seen.has(value))errors.push(SHORTCUT_NAMES[key]+' und '+SHORTCUT_NAMES[seen.get(value)]+' verwenden '+value);seen.set(value,key);if(['Ctrl+KeyR','Ctrl+KeyW','Alt+F4','Meta+KeyQ'].includes(value))errors.push(value+' ist für das Fenster reserviert.');}return errors;}
export function editMetadata(tracks,patch){const allowed={title:160,artist:120,voices:120,genre:120},clean={};for(const [key,max] of Object.entries(allowed))if(Object.hasOwn(patch,key)){const text=String(patch[key]).trim();if(text.length>max||(['title','artist'].includes(key)&&!text))throw new Error('Bitte gültige Songdaten eingeben.');clean[key]=text;}for(const t of tracks)Object.assign(t,clean);return tracks;}
export function duplicateGroups(tracks){
 const groups=new Map();for(const t of tracks){const key=t.digest?'sha:'+t.digest:'name:'+String(t.title).trim().toLocaleLowerCase('de')+'|'+String(t.artist).trim().toLocaleLowerCase('de')+'|'+Math.round(t.duration||0);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);}
 return [...groups.values()].filter(g=>g.length>1);
}
export function filterSongs(tracks,{search='',sort='added',direction='desc'}={}){const term=search.toLocaleLowerCase('de');return tracks.filter(t=>[t.title,t.artist,t.voices,t.genre].join(' ').toLocaleLowerCase('de').includes(term)).sort((a,b)=>{const value=sort==='duration'?(a.duration||0)-(b.duration||0):sort==='added'?String(a.addedAt||'').localeCompare(String(b.addedAt||'')):String(a[sort]||'').localeCompare(String(b[sort]||''),'de',{numeric:true});return value*(direction==='asc'?1:-1);});}
export function searchCatalog({tracks=[],albums=[],playlists=[],spotify=[]},term,source='all'){
 const query=String(term).trim().toLocaleLowerCase('de');if(!query)return [];
 const rows=[...tracks.map(t=>({...t,kind:'track',source:t.visibility==='local'?'local':'band'})),...albums.map(t=>({...t,kind:'album',source:'band'})),...playlists.map(t=>({...t,kind:'playlist',source:t.visibility==='local'?'local':'band'})),...spotify.map(t=>({...t,title:t.name||t.title,kind:t.kind||'spotify',source:'spotify'}))];
 return rows.filter(t=>(source==='all'||source===t.source)&&[t.title,t.artist,t.description].join(' ').toLocaleLowerCase('de').includes(query)).slice(0,250);
}
export class SleepTimer{
 constructor(){this.cancel();}
 start(minutes,{song=false,fade=false,current=null,now=Date.now()}={}){this.deadline=song?0:now+clamp(minutes,1,180,30)*60000;this.song=song;this.fade=fade;this.current=current;this.active=true;this.originalVolume=null;this.originalSource=null;}
 cancel(){this.active=false;this.deadline=0;this.song=false;this.originalVolume=null;this.originalSource=null;}
 remaining(now=Date.now()){return this.active&&!this.song?Math.max(0,Math.ceil((this.deadline-now)/1000)):0;}
 tick({now=Date.now(),source,current,volume,ended=false}={}){
  if(!this.active)return null;
  if(this.song){if(ended||current!==this.current){this.active=false;return {pause:true};}return null;}
  if(now>=this.deadline){this.active=false;return {pause:true,restore:this.originalSource===(source==='spotify'?'spotify':'studio')?this.originalVolume:null};}
  if(this.fade&&source!=='spotify'&&this.deadline-now<=10000){this.originalVolume??=volume;this.originalSource??='studio';return {volume:this.originalVolume*Math.max(0,(this.deadline-now)/10000)};}return null;
 }
}
