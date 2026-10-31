import {CLOUD} from './cloud-config.mjs';
import {escapeHTML as h,time,THEMES} from './core.mjs';
import {lyricCues,activeLyric} from './workbench.mjs';

const main=document.querySelector('#public-main'),audio=document.querySelector('#public-audio'),id=new URL(location.href).searchParams.get('id');
let release,loaded=0,refreshing=false;
const status=message=>{const el=document.querySelector('#public-status');if(el)el.textContent=message;};
function mediaUrl(blobId){const asset=release.assets.find(a=>a.id===blobId);return asset?release.urls[asset.path]||'':'';}
async function load(){
 const response=await fetch(CLOUD.url+'/functions/v1/neon-public/song/'+encodeURIComponent(id),{headers:{apikey:CLOUD.key},cache:'no-store'});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Dieser Song ist gerade nicht erreichbar.');
 release=data;loaded=Date.now();return data;
}
function fail(error){
 audio.pause();audio.removeAttribute('src');
 main.innerHTML=`<h1>Song nicht verfügbar.</h1><p class="status" role="alert">${h(error.message)}</p><a href="album.html">Zu den veröffentlichten Alben ↗</a>`;
}
async function play(){try{if(Date.now()-loaded>240000){await load();audio.src=mediaUrl(release.track.blobId);}await audio.play();}catch(error){fail(error);}}
async function share(){
 const url=new URL('song.html',location.href);url.searchParams.set('id',id);
 try{await navigator.clipboard.writeText(url.href);status('Hörlink kopiert. Du kannst ihn in Discord einfügen.');}
 catch{if(navigator.share){try{await navigator.share({title:release.track.title+' · Neon Trinity',url:url.href});return;}catch(error){if(error.name==='AbortError')return;}}const input=document.querySelector('#song-share-url');input.hidden=false;input.value=url.href;input.select();status('Den markierten Link kopieren und in Discord einfügen.');}
}
function render(){
 const {track,work}=release;document.documentElement.dataset.theme=THEMES[release.theme]?release.theme:'trinity';document.title=track.title+' · Neon Trinity';
 main.innerHTML=`<section class="album-hero"><img class="cover" src="${h(mediaUrl(track.coverBlobId)||'assets/neon-trinity.png')}" alt="Cover: ${h(track.title)}"><div><div class="eyebrow">NEON TRINITY · SONG</div><h1>${h(track.title)}</h1><div class="meta">${h(track.artist)} · ${time(track.duration)}</div>${track.voices?'<p>'+h(track.voices)+'</p>':''}<p>Direkt hier hören. Ohne Studio und ohne Anmeldung.</p><div class="actions"><button class="primary" id="play-song">▶ Song abspielen</button><button id="share-song">↗ Hörlink kopieren</button></div><label><input id="song-share-url" readonly hidden aria-label="Öffentlicher Hörlink"></label></div></section><p id="public-status" class="status" role="status"></p>${work?.lyrics||work?.credits?'<section id="public-lyrics"><h2>Songtext & Credits</h2><div id="public-lyric-lines"></div><p id="public-credits"></p></section>':''}`;
 const lines=document.querySelector('#public-lyric-lines');if(lines){const cues=lyricCues(work?.lyrics);lines.innerHTML=cues.length?cues.map((cue,i)=>'<p data-public-lyric="'+i+'">'+h(cue.text)+'</p>').join(''):'<p>'+h(work?.lyrics||'').replace(/\n/g,'<br>')+'</p>';document.querySelector('#public-credits').textContent=work?.credits||'';}
 document.querySelector('#playing-title').textContent=track.title;document.querySelector('#playing-artist').textContent=track.artist;audio.src=mediaUrl(track.blobId);
 document.querySelector('#play-song').onclick=play;document.querySelector('#share-song').onclick=share;
}
audio.addEventListener('play',async()=>{
 if(refreshing||Date.now()-loaded<=240000)return;refreshing=true;const position=audio.currentTime||0;audio.pause();
 try{await load();audio.src=mediaUrl(release.track.blobId);audio.currentTime=position;await audio.play();}catch(error){fail(error);}finally{refreshing=false;}
});
audio.addEventListener('error',()=>status('Die Audiodatei ist gerade nicht erreichbar. Bitte die Seite neu laden.'));
audio.addEventListener('timeupdate',()=>{const active=activeLyric(lyricCues(release?.work?.lyrics),audio.currentTime);for(const line of document.querySelectorAll('[data-public-lyric]'))line.classList.toggle('active',Number(line.dataset.publicLyric)===active);});
try{if(!/^[a-zA-Z0-9-]{1,80}$/.test(id||''))throw new Error('Dieser Hörlink enthält keine gültige Song-ID.');await load();render();}catch(error){fail(error);}
