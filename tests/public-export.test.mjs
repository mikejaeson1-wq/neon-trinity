import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectCloudSite} from '../app/public-cloud.mjs';
test('Öffentlicher Website-Export enthält Profile, Supabase-Client und jede relative Modul-Abhängigkeit',async()=>{
 const oldFetch=globalThis.fetch;globalThis.fetch=async url=>{try{return new Response(await readFile(fileURLToPath(url)));}catch{return new Response('',{status:404});}};
 try{const files=await collectCloudSite(),names=new Set(files.map(f=>f.path));for(const required of ['profile.html','profile-public.mjs','profiles.mjs','profiles-view.mjs','vendor/supabase.mjs','player-settings.mjs'])assert.ok(names.has(required),required);
 for(const f of files.filter(f=>f.path.endsWith('.mjs'))){const text=await f.blob.text();for(const match of text.matchAll(/from\s*['"](\.[^'"]+)['"]/g)){const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(f.path),match[1]));assert.ok(names.has(dependency),f.path+' imports missing '+dependency);}}
 assert.ok(!names.has('app.mjs'));assert.ok(!names.has('spotify.mjs'));
 }finally{globalThis.fetch=oldFetch;}
});
