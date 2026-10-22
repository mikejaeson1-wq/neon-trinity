import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {readFileSync} from 'node:fs';
import {configureStudioProfile,STUDIO_NAME} from '../desktop/profile.cjs';
import {MiniWindowState} from '../desktop/window-state.cjs';
test('Profil wird vor dem ersten Datenzugriff auf den bisherigen Ordner festgelegt; beide Ablagen bleiben erhalten',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'neon-profile-'));
 try{const original=path.join(base,STUDIO_NAME),alternate=path.join(base,'neon-trinity-studio');await mkdir(original);await mkdir(alternate);await writeFile(path.join(original,'old-library'),'original mp3s');await writeFile(path.join(alternate,'new-library'),'new mp3s');let name='neon-trinity-studio',cache;const paths=new Map(),calls=[];
 const app={setName:value=>{calls.push('name');name=value;},getPath:key=>{calls.push('get:'+key);if(paths.has(key))return paths.get(key);if(key==='appData')return base;return cache??=path.join(base,name);},setPath:(key,value)=>{calls.push('set:'+key);paths.set(key,value);}};
 const window=new MiniWindowState(app);assert.deepEqual(calls,[],'Ein Miniplayer-Konstruktor darf keinen Profilpfad vorab auflösen.');assert.equal(configureStudioProfile(app),original);assert.equal(calls[0],'name');assert.equal(app.getPath('userData'),original);assert.equal(app.getPath('sessionData'),original);await window.load();await window.save({width:700,height:500},true);
 assert.equal(await readFile(path.join(original,'old-library'),'utf8'),'original mp3s');assert.equal(await readFile(path.join(alternate,'new-library'),'utf8'),'new mp3s');assert.equal(JSON.parse(await readFile(path.join(original,'mini-window.json'),'utf8')).width,700);
 }finally{await rm(base,{recursive:true,force:true});}
});
test('Der tatsächliche Einstiegspunkt konfiguriert das Profil vor Miniplayer, Cloud-Sitzung und App-Lock',()=>{
 const source=readFileSync(new URL('../desktop/main.cjs',import.meta.url),'utf8'),init=source.indexOf('configureStudioProfile(app);');assert.ok(init>0);for(const text of ['new MiniWindowState(app)','app.requestSingleInstanceLock()','new DesktopCloud('])assert.ok(init<source.indexOf(text),'Früher Profilzugriff: '+text);
});
