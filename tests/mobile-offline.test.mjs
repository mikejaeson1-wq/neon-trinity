import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
test('Handy-Serviceworker behandelt ausschließlich App-Dateien und lässt OAuth, Supabase, Spotify und Audiodateien unverändert',async()=>{
 const listeners={},scope='https://mikejaeson1-wq.github.io/neon-trinity/';vm.runInNewContext(await readFile(new URL('../app/mobile-sw.js',import.meta.url),'utf8'),{URL,Set,Response,self:{registration:{scope},addEventListener:(name,fn)=>listeners[name]=fn},fetch:async()=>new Response('shell'),caches:{open:async()=>({put:async()=>{}})}});
 for(const url of [scope+'mobile.html?code=secret&state=state',scope+'profile.html?code=secret',scope+'track.mp3','https://xyhkpwhfgjamssojjzbu.supabase.co/storage/v1/object/sign/nt-media/track.mp3?token=secret','https://api.spotify.com/v1/me','https://accounts.spotify.com/api/token']){let handled=false;listeners.fetch({request:new Request(url),respondWith:()=>handled=true});assert.equal(handled,false,url);}
 let shell;const waits=[];listeners.fetch({request:new Request(scope+'mobile.html'),respondWith:promise=>shell=promise,waitUntil:promise=>waits.push(promise)});assert.equal(await (await shell).text(),'shell');await Promise.all(waits);
});
