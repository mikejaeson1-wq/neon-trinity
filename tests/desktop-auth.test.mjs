import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createCloudClient} from '../app/cloud.mjs';
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
test('Der echte Supabase-Client speichert dynamische PKCE-Schlüssel, tauscht den Code und meldet sich ab',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'nt-sdk-auth-')),originalWindow=globalThis.window,originalFetch=globalThis.fetch,seen=[];
 const safeStorage={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'gnome_libsecret',encryptString:s=>Buffer.from(Buffer.from(s).toString('base64')),decryptString:b=>Buffer.from(b.toString(),'base64').toString()};
 const cloud=new DesktopCloud({app:{getPath:()=>dir},safeStorage,shell:{}});let client,challenge,exchanged=false;
 const uid='00000000-0000-4000-8000-000000000001',payload={sub:uid,role:'authenticated',aud:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600};
 const jwt=[{alg:'HS256',typ:'JWT'},payload].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.signature';
 globalThis.window={neonDesktop:{cloudGetItem:async key=>cloud.getItem(key),cloudSetItem:async(key,value)=>{seen.push(key);await cloud.setItem(key,value);},cloudRemoveItem:key=>cloud.removeItem(key)}};
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.hostname,'xyhkpwhfgjamssojjzbu.supabase.co');
  if(url.pathname==='/auth/v1/token'){
   const body=JSON.parse(init.body);assert.equal(body.auth_code,'returned-code');assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),challenge);exchanged=true;
   return new Response(JSON.stringify({access_token:jwt,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user:{id:uid,aud:'authenticated',role:'authenticated',app_metadata:{provider:'discord'},user_metadata:{},created_at:new Date().toISOString()}}),{headers:{'Content-Type':'application/json'}});
  }
  if(url.pathname==='/auth/v1/logout')return new Response(null,{status:204});
  throw new Error('Unexpected authentication request: '+url.pathname);
 };
 try{
  client=createCloudClient();const oauth=await client.auth.signInWithOAuth({provider:'discord',options:{redirectTo:'http://127.0.0.1:48731/auth/callback?nt_state=nonce',skipBrowserRedirect:true}});assert.equal(oauth.error,null);
  challenge=new URL(oauth.data.url).searchParams.get('code_challenge');assert.ok(challenge);
  assert.ok(seen.some(key=>/^neon-trinity-supabase-auth-flow-[a-f0-9]{32}-code-verifier$/.test(key)));
  assert.ok(seen.includes('neon-trinity-supabase-auth-flows-code-verifier'));
  const result=await client.auth.exchangeCodeForSession('returned-code');assert.equal(result.error,null);assert.equal(result.data.user.id,uid);assert.ok(exchanged);
  assert.equal((await client.auth.getSession()).data.session.user.id,uid);
  assert.throws(()=>cloud.getItem('neon-trinity-supabase-auth-flow-../other-code-verifier'),/Ungültiger/);
  assert.throws(()=>cloud.getItem('another-app-auth'),/Ungültiger/);
  assert.equal((await client.auth.signOut({scope:'local'})).error,null);assert.equal(cloud.getItem('neon-trinity-supabase-auth'),null);
 }finally{await client?.auth.stopAutoRefresh();globalThis.window=originalWindow;globalThis.fetch=originalFetch;await rm(dir,{recursive:true,force:true});}
});
