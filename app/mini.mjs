import {playerOptions,equalizerView,sourceLabel} from './player-view.mjs';
import {EQ_PRESETS,normalizePlayer,normalizeEqualizer} from './player-settings.mjs';
const api=window.neonDesktop,$=s=>document.querySelector(s),time=n=>Math.floor((n||0)/60)+':'+String(Math.floor((n||0)%60)).padStart(2,'0');
let state={},settingsOpen=false,eqKey='',optionsKey='';
const send=input=>api.playerCommand(input).catch(e=>{$('#mini-status').textContent=e.message;});
$('#restore').onclick=()=>api.showStudio();$('#close').onclick=()=>api.closeMini();
$('#spotify-link').onclick=e=>{e.preventDefault();send({command:'open-spotify'});};
$('#settings-toggle').onclick=()=>{settingsOpen=!settingsOpen;$('#mini-settings').hidden=!settingsOpen;$('#settings-toggle').setAttribute('aria-expanded',String(settingsOpen));api.resizeMini?.({settings:settingsOpen,equalizer:!$('#mini-equalizer').hidden});};
$('#eq-toggle').onclick=()=>send({command:'appearance',value:{equalizerOpen:!state.appearance?.equalizerOpen}});
for(const b of document.querySelectorAll('[data-command]'))b.onclick=()=>send({command:b.dataset.command});
$('#seek').onchange=e=>send({command:'seek',value:Number(e.target.value)/100});$('#volume').onchange=e=>send({command:'volume',value:Number(e.target.value)});
function bindEqualizer(){for(const input of document.querySelectorAll('[data-eq],[data-eq-band]')){
 const change=()=>{if(state.source==='spotify')return;const eq=normalizeEqualizer(state.equalizer);if(input.hasAttribute('data-eq-band')){eq.gains[Number(input.dataset.eqBand)]=Number(input.value);eq.preset='custom';}else if(input.dataset.eq==='preset'){if(!EQ_PRESETS[input.value])return;eq.gains=[...EQ_PRESETS[input.value].gains];eq.preset=input.value;eq.enabled=true;}else eq[input.dataset.eq]=input.type==='checkbox'?input.checked:Number(input.value);state.equalizer=eq;const output=input.parentElement?.querySelector('output');if(output)output.textContent=Number(input.value).toFixed(0);};
 input.oninput=change;input.onchange=()=>{change();send({command:'equalizer',value:state.equalizer});};
}}
api.onPlayerState(next=>{
 state=next;const p=normalizePlayer(state.appearance);document.body.dataset.skin=p.skin;document.body.dataset.layout=p.layout;document.body.dataset.source=state.source||'studio';
 $('#title').textContent=state.title||'Neon Trinity Studio';$('#artist').textContent=state.artist||'Dex · Nix · Jax';$('#source').textContent=sourceLabel(state.source).toUpperCase();$('#device').textContent=state.source==='spotify'?state.device||'':'';
 $('#art').src=state.image||'assets/neon-trinity.png';$('#toggle').textContent=state.paused?'▶':'Ⅱ';$('#toggle').setAttribute('aria-label',state.paused?'Abspielen':'Pause');$('#elapsed').textContent=time(state.position);$('#clock').textContent=(state.paused?'Ⅱ ':'▶ ')+time(state.position);$('#duration').textContent=time(state.duration);
 if(document.activeElement!==$('#seek'))$('#seek').value=state.duration?state.position/state.duration*100:0;if(document.activeElement!==$('#volume')&&state.volume!=null)$('#volume').value=state.volume;$('#volume-value').textContent=state.volume==null?'—':Math.round(state.volume*100)+'%';
 for(const [key,allowed] of [['toggle',state.canToggle],['seek',state.canSeek],['previous',state.canPrevious],['next',state.canNext],['shuffle',state.canShuffle],['repeat',state.canRepeat],['volume',state.canVolume]])$('#'+key).disabled=allowed===false;
 $('#shuffle').setAttribute('aria-pressed',String(!!state.shuffle));$('#repeat').setAttribute('aria-pressed',String(state.repeat&&state.repeat!=='off'));$('#repeat').textContent=state.repeat==='track'?'REP1':'REP';$('#spotify-link').hidden=state.source!=='spotify';$('#format').innerHTML=state.source==='spotify'?'SPOTIFY<br>CONNECT':'MP3<br>STEREO';
 const options=JSON.stringify([p.skin,p.layout]);if(options!==optionsKey){optionsKey=options;$('#mini-settings').innerHTML=playerOptions(p);for(const select of document.querySelectorAll('[data-player-setting]'))select.onchange=()=>send({command:'appearance',value:{[select.dataset.playerSetting]:select.value}});}
 const key=JSON.stringify([state.source,state.equalizer]);if(key!==eqKey&&!document.activeElement?.closest?.('#mini-equalizer')){eqKey=key;$('#mini-equalizer').innerHTML=equalizerView(state.equalizer,state.source);bindEqualizer();}
 const changed=$('#mini-equalizer').hidden===p.equalizerOpen;$('#mini-equalizer').hidden=!p.equalizerOpen;$('#eq-toggle').setAttribute('aria-expanded',String(p.equalizerOpen));if(changed)api.resizeMini?.({settings:settingsOpen,equalizer:p.equalizerOpen});
 const canvas=$('#spectrum'),c=canvas.getContext?.('2d');if(c){const css=getComputedStyle(document.body);c.clearRect(0,0,150,34);c.fillStyle=css.getPropertyValue('--lcd-ink');(state.spectrum||[]).slice(0,24).forEach((v,i)=>c.fillRect(i*6,34-v*.32,4,Math.max(1,v*.32)));}
});
