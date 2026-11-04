import {escapeHTML as h} from './core.mjs';

export const BAND_VOICES=['Dex','Nix','Jax'];
const legacyPlaceholder=value=>/^privat\s*·\s*lokal$/i.test(String(value||'').trim());
export function voiceLabel(value){return legacyPlaceholder(value)||!String(value||'').trim()?'Stimmen wählen':String(value).trim();}
export function voiceParts(value){
 const text=String(value||'').trim();
 if(!text||legacyPlaceholder(text)||/^instrumental$/i.test(text))return {members:[],guests:[],instrumental:/^instrumental$/i.test(text)};
 const tokens=text.split(/[·,;/&+]|\s+(?:und|and)\s+/i).map(v=>v.trim()).filter(Boolean);
 return {members:BAND_VOICES.filter(name=>tokens.some(v=>v.toLowerCase()===name.toLowerCase())),guests:tokens.filter(v=>!BAND_VOICES.some(name=>v.toLowerCase()===name.toLowerCase())),instrumental:false};
}
export function voiceEditor(value){
 const parts=voiceParts(value);
 return `<fieldset class="voice-editor"><legend>Hörbare Stimmen</legend><p class="voice-hint">Wer ist in diesem Song zu hören? Mehrere Stimmen sind möglich.</p><div class="voice-picks">${BAND_VOICES.map(name=>`<label class="voice-pick voice-${name.toLowerCase()}"><input type="checkbox" data-song-voice="${name}" ${parts.members.includes(name)?'checked':''}><span>${name}</span></label>`).join('')}</div><label class="field"><span>Stimmen / weitere Gaststimmen</span><input name="voices" value="${h(value||'')}" maxlength="120" placeholder="Zum Beispiel: Dex · Nix" aria-describedby="voice-preview"></label><div class="voice-presets"><button class="button ghost compact" type="button" data-voice-preset="all">Alle drei</button><button class="button ghost compact" type="button" data-voice-preset="instrumental" aria-pressed="${parts.instrumental}">Instrumental</button><button class="text-link" type="button" data-voice-preset="clear">Angabe leeren</button></div><p class="voice-hint" id="voice-preview" aria-live="polite">${h(String(value||'').trim()||'Noch keine Stimmen angegeben.')}</p></fieldset>`;
}
export function bindVoiceEditor(form){
 const input=form.querySelector('[name="voices"]'),checks=[...form.querySelectorAll('[data-song-voice]')],preview=form.querySelector('#voice-preview');
 const sync=()=>{const parts=voiceParts(input.value);for(const check of checks)check.checked=parts.members.includes(check.dataset.songVoice);preview.textContent=input.value.trim()||'Noch keine Stimmen angegeben.';form.querySelector('[data-voice-preset="instrumental"]').setAttribute('aria-pressed',String(parts.instrumental));};
 for(const check of checks)check.onchange=()=>{const guests=voiceParts(input.value).guests;input.value=[...checks.filter(c=>c.checked).map(c=>c.dataset.songVoice),...guests].join(' · ');sync();};
 input.oninput=sync;
 for(const button of form.querySelectorAll('[data-voice-preset]'))button.onclick=()=>{input.value=button.dataset.voicePreset==='all'?[...BAND_VOICES,...voiceParts(input.value).guests].join(' · '):button.dataset.voicePreset==='instrumental'?'Instrumental':'';sync();};
 sync();
}
