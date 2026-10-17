import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const {window,document}=parseHTML(await readFile(new URL('../app/mini.html',import.meta.url),'utf8'));globalThis.window=window;globalThis.document=document;
const commands=[],sizes=[];let receive;window.neonDesktop={showStudio:async()=>{},closeMini:async()=>{},playerCommand:async input=>commands.push(input),resizeMini:async input=>sizes.push(input),onPlayerState:fn=>receive=fn};await import('../app/mini.mjs');
const base={source:'studio',title:'Band Song',artist:'Dex · Nix · Jax',duration:180,position:30,paused:false,volume:.7,appearance:{skin:'classic',layout:'classic',equalizerOpen:false},equalizer:{enabled:false},spectrum:[]};
test('Winamp-Miniplayer zeigt echte Player-Daten, steuert dieselbe Wiedergabe und speichert Skin und EQ',async()=>{
 receive(base);assert.equal(document.querySelector('#title').textContent,'Band Song');assert.equal(document.querySelector('#elapsed').textContent,'0:30');assert.equal(document.querySelector('#toggle').textContent,'Ⅱ');document.querySelector('#next').onclick();assert.equal(commands.at(-1).command,'next');
 document.querySelector('#settings-toggle').onclick();assert.equal(document.querySelector('#mini-settings').hidden,false);const skin=document.querySelector('[data-player-setting="skin"]');skin.querySelectorAll('option').forEach(o=>o.selected=false);skin.querySelector('[value="amber"]').selected=true;skin.onchange();assert.deepEqual(commands.at(-1),{command:'appearance',value:{skin:'amber'}});
 receive({...base,appearance:{skin:'amber',layout:'compact',equalizerOpen:true}});assert.equal(document.body.dataset.skin,'amber');assert.equal(document.body.dataset.layout,'compact');assert.equal(document.querySelector('#mini-equalizer').hidden,false);assert.equal(document.querySelectorAll('[data-eq-band]').length,10);
 const band=document.querySelector('[data-eq-band="2"]');band.value='4.5';band.oninput();band.onchange();assert.equal(commands.at(-1).command,'equalizer');assert.equal(commands.at(-1).value.gains[2],4.5);assert.equal(commands.at(-1).value.preset,'custom');assert.ok(sizes.some(s=>s.equalizer));
});
test('Spotify-Quelle zeigt Attribution und EQ-Grenze; private Titel werden nach dem Kontowechsel ersetzt',()=>{
 receive({...base,source:'spotify',title:'<script>Spotify Track</script>',artist:'Artist',canSeek:false,appearance:{skin:'ice',layout:'modern',equalizerOpen:true}});assert.equal(document.querySelector('script:not([src])'),null);assert.equal(document.querySelector('#spotify-link').hidden,false);assert.match(document.querySelector('#mini-equalizer').textContent,/Spotify Connect/);assert.ok(document.querySelector('fieldset').hasAttribute('disabled'));assert.equal(document.querySelector('#seek').disabled,true);
 receive({...base,title:'',artist:'Neon Trinity',paused:true});assert.ok(!document.querySelector('#title').textContent.includes('Spotify Track'));assert.equal(document.querySelector('#spotify-link').hidden,true);
});
