import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url),{DesktopCloud}=require('../desktop/team.cjs');
test('Desktop-OAuth prüft lokale Rückkehr, PKCE und den Supabase-Ursprung',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'nt-auth-')),opened=[];
 const safeStorage={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'gnome_libsecret',encryptString:s=>Buffer.from(Buffer.from(s).toString('base64')),decryptString:b=>Buffer.from(b.toString(),'base64').toString()};
 const cloud=new DesktopCloud({app:{getPath:()=>dir},safeStorage,shell:{openExternal:async url=>opened.push(url)},port:53000+Math.floor(Math.random()*10000)});
 try{const callback=await cloud.startLogin();const oauth=new URL('https://xyhkpwhfgjamssojjzbu.supabase.co/auth/v1/authorize');oauth.searchParams.set('provider','discord');oauth.searchParams.set('redirect_to',callback);oauth.searchParams.set('code_challenge','test-pkce');await cloud.openLogin(oauth.href);assert.equal(opened.length,1);
 await assert.rejects(cloud.openLogin(oauth.href.replace('xyhkpwhfgjamssojjzbu.supabase.co','attacker.example')),/Ungültige/);
 const invalid=new URL(callback);invalid.searchParams.set('nt_state','wrong');invalid.searchParams.set('code','stolen');assert.equal((await fetch(invalid)).status,404);assert.equal(cloud.pollLogin().status,'pending');
 const valid=new URL(callback);valid.searchParams.set('code','valid-pkce-code');assert.equal((await fetch(valid)).status,200);assert.deepEqual(cloud.pollLogin(),{status:'ready',code:'valid-pkce-code'});assert.throws(()=>cloud.pollLogin(),/neu starten/);
 await cloud.setItem('neon-trinity-supabase-auth','secret-refresh-token');assert.equal(cloud.getItem('neon-trinity-supabase-auth'),'secret-refresh-token');assert.ok(!(await readFile(cloud.file,'utf8')).includes('secret-refresh-token'));assert.throws(()=>cloud.getItem('../outside'),/Ungültiger/);await cloud.removeItem('neon-trinity-supabase-auth');assert.equal(cloud.getItem('neon-trinity-supabase-auth'),null);
 }finally{await cloud.cancelLogin();await rm(dir,{recursive:true,force:true});}
});
