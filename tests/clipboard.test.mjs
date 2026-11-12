import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {parseHTML} from 'linkedom';
import {copyText,selectCopyInput} from '../app/clipboard.mjs';
import {showMusicboxResult} from '../app/musicbox-result.mjs';
const {writeClipboardText}=createRequire(import.meta.url)('../desktop/clipboard.cjs');
const url='https://xyhkpwhfgjamssojjzbu.supabase.co/storage/v1/object/public/nt-musicbox/audio/11111111-1111-4111-8111-111111111111.mp3';

test('Desktop-Kopieren wartet auf den echten Schreibabschluss und akzeptiert nur begrenzten Klartext',async()=>{
 let finish,written,done=false;const pending=writeClipboardText({writeText:text=>{written=text;return new Promise(resolve=>finish=resolve);}},url).then(()=>done=true);
 assert.equal(written,url);assert.equal(done,false);finish();await pending;assert.equal(done,true);
 for(const value of [null,{},'', 'x'.repeat(65537),'bad\0text'])await assert.rejects(writeClipboardText({writeText:()=>assert.fail('must not write')},value),/Ungültiger/);
 await assert.rejects(writeClipboardText({writeText:async()=>{throw Error('unavailable');}},url),/unavailable/);
});
test('Die Desktop-Brücke funktioniert auch bei gesperrter Browser-Zwischenablage',async()=>{
 let native;await copyText(url,{bridge:{writeClipboardText:async value=>native=value},clipboard:{writeText:()=>assert.fail('browser must not be used')},document:{}});assert.equal(native,url);
 const clipboard={async writeText(value){assert.equal(this,clipboard);assert.equal(value,url);}};
 assert.equal(await copyText(url,{bridge:{writeClipboardText:async()=>{throw Error('native unavailable');}},clipboard,document:{}}),true);
});
test('Der Browser-Ersatzweg kopiert innerhalb des geöffneten Dialogs und meldet Fehlschläge ehrlich',async()=>{
 const {document}=parseHTML('<html><body><dialog open></dialog></body></html>');let calls=0;
 document.execCommand=command=>{calls++;assert.equal(command,'copy');assert.equal(document.querySelector('dialog textarea').value,url);return true;};
 await copyText(url,{bridge:{},clipboard:{writeText:async()=>{throw Error('denied');}},document});assert.equal(calls,1);assert.equal(document.querySelector('textarea'),null);
 document.execCommand=()=>false;await assert.rejects(copyText(url,{bridge:{},clipboard:null,document}),/Zwischenablage/);assert.equal(document.querySelector('textarea'),null);
 const sequence=[];selectCopyInput({value:url,focus:()=>sequence.push('focus'),select:()=>sequence.push('select'),setSelectionRange:(start,end)=>{sequence.push('range');assert.equal(start,0);assert.equal(end,url.length);}});assert.deepEqual(sequence,['focus','select','range']);
});
test('Musikbox-Dialog kopiert per Schaltfläche und Strg+C über dieselbe native Brücke',async()=>{
 const {document}=parseHTML('<html><body><dialog open><div id="modal-content"></div></dialog></body></html>');const writes=[],messages=[];let closed=false;
 const bridge={writeClipboardText:async text=>writes.push(text)},ui=await showMusicboxResult({document,result:{url,title:'<img src=x>',trackCount:1},bridge,copy:(text,options)=>copyText(text,{...options,clipboard:null}),toast:message=>messages.push(message),closeModal:()=>closed=true});
 assert.equal(writes[0],url);assert.equal(document.querySelector('.subtitle img'),null);assert.equal(ui.input.hasAttribute('readonly'),true);await ui.button.onclick();assert.equal(writes.length,2);
 ui.input.selectionStart=0;ui.input.selectionEnd=url.length;let prevented=false;await ui.input.onkeydown({key:'c',ctrlKey:true,preventDefault:()=>prevented=true});assert.equal(prevented,true);assert.equal(writes.at(-1),url);assert.equal(writes.length,3);assert.match(ui.status.textContent,/kopiert/);document.querySelector('#musicbox-done').onclick();assert.equal(closed,true);
});
test('Bei blockierten Kopierwegen bleibt der vollständige Musikbox-Link auswählbar',async()=>{
 const {document}=parseHTML('<html><body><dialog open><div id="modal-content"></div></dialog></body></html>');const messages=[];
 const ui=await showMusicboxResult({document,result:{url,title:'Song',trackCount:1},bridge:{},copy:async()=>{throw Error('blocked');},toast:message=>messages.push(message),closeModal:()=>{}});
 assert.equal(ui.input.value,url);assert.match(ui.status.textContent,/Strg\+C/);assert.equal(ui.button.disabled,false);assert.equal(messages.length,0);
 let prevented=false;ui.input.onkeydown({key:'c',ctrlKey:true,preventDefault:()=>prevented=true});assert.equal(prevented,false,'Browser keeps its normal Ctrl+C behavior without a native bridge');
});
