import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {Profiles,avatarURL,prepareAvatar,profileInput} from '../app/profiles.mjs';
import {profileCard,profilesView} from '../app/profiles-view.mjs';
import {CLOUD} from '../app/cloud-config.mjs';
import {parseHTML} from 'linkedom';
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
function fixture(){let updated=1;const rows=['Dex','Nix','Jax'].map(alias=>({alias,display_name:alias,bio:'',avatar_path:'',follower_count:0,like_count:0,updated_at:'v1'})),reactions=[],files=new Map(),calls=[];let hold;
 const client=createClient(CLOUD.url,CLOUD.key,{auth:{persistSession:false,autoRefreshToken:false,storageKey:crypto.randomUUID()},global:{fetch:async(input,init={})=>{const url=new URL(String(input)),method=init.method||'GET';calls.push({path:url.pathname,method,body:init.body});
 if(hold){const pending=hold;hold=null;await pending;}
 if(url.pathname.endsWith('/nt_profiles')){if(method==='GET')return response(rows);const alias=url.searchParams.get('alias')?.slice(3),row=rows.find(p=>p.alias===alias);if(url.searchParams.get('updated_at')!=='eq.'+row.updated_at)return response(null);Object.assign(row,JSON.parse(init.body),{updated_at:'v'+(++updated)});return response(row);}
 if(url.pathname.endsWith('/nt_profile_reactions')){if(method==='GET')return response(reactions.filter(r=>url.searchParams.get('user_id')==='eq.'+r.user_id));if(method==='POST'){const row=JSON.parse(init.body);reactions.push(row);const p=rows.find(p=>p.alias===row.alias);p[row.kind==='follow'?'follower_count':'like_count']++;return response(null);}if(method==='DELETE'){for(let i=reactions.length-1;i>=0;i--){const r=reactions[i];if(url.searchParams.get('user_id')==='eq.'+r.user_id&&url.searchParams.get('alias')==='eq.'+r.alias&&url.searchParams.get('kind')==='eq.'+r.kind){rows.find(p=>p.alias===r.alias)[r.kind==='follow'?'follower_count':'like_count']--;reactions.splice(i,1);}}return response(null);}}
 throw Error('Unexpected '+method+' '+url.pathname);
 }}});
 client.storage.from=()=>({upload:async(path,blob)=>{files.set(path,blob);return {data:{path}};},remove:async paths=>{paths.forEach(path=>files.delete(path));return {data:[]};}});
 return {client,rows,reactions,files,calls,holdNext(promise){hold=promise;}};
}
test('Öffentliche Profile laden ohne Konto, Reaktionen bleiben pro angemeldetem Konto getrennt',async()=>{
 const f=fixture(),p=new Profiles({client:f.client});await p.load();assert.equal(p.rows.length,3);assert.equal(f.calls.length,1);await assert.rejects(p.react('Dex','like'),/Discord/);
 p.setOwner({id:'dex',alias:'Dex'});await p.load();await p.react('Nix','follow');await p.react('Nix','like');assert.equal(p.rows.find(p=>p.alias==='Nix').follower_count,1);assert.ok(p.has('Nix','follow'));await p.react('Nix','like');assert.equal(p.rows.find(p=>p.alias==='Nix').like_count,0);
 p.setOwner({id:'visitor'});await p.load();assert.equal(p.alias,null);assert.ok(!p.has('Nix','follow'));await p.react('Nix','like');assert.equal(p.rows.find(p=>p.alias==='Nix').like_count,1);await assert.rejects(p.save({display_name:'Fake Dex'}),/Bandkonto/);
 p.setOwner(null);assert.deepEqual(p.reactions,[]);await p.load();assert.equal(p.rows.find(p=>p.alias==='Nix').follower_count,1);f.client.auth.stopAutoRefresh();
});
test('Profilbild wird separat gespeichert, alte Bilder entfernt und fremde Bildpfade abgewiesen',async()=>{
 const f=fixture(),p=new Profiles({client:f.client});p.setOwner({id:'dex',alias:'Dex'});await p.load();
 await p.save({display_name:'Dex Resonance',bio:'One pulse.'},new Blob(['encoded'],{type:'image/webp'}));assert.equal(f.files.size,1);assert.ok(f.rows[0].avatar_path.startsWith('Dex/'));assert.equal(f.rows[1].display_name,'Nix');assert.ok(!f.calls.some(c=>c.path.includes('nt_catalog')));
 await p.save({display_name:'Dex',bio:'',removeAvatar:true});assert.equal(f.files.size,0);assert.equal(f.rows[0].avatar_path,'');assert.throws(()=>profileInput({display_name:'Dex',avatar_path:'Nix/11111111-1111-4111-8111-111111111111.webp'},'Dex'),/prüfen/);
 assert.equal(avatarURL('https://evil.invalid/a.png'),'');assert.equal(avatarURL('../private.png'),'');f.client.auth.stopAutoRefresh();
});
test('Verspätete Profilantwort eines alten Kontos zeigt keine alten Reaktionen',async()=>{
 const f=fixture(),p=new Profiles({client:f.client});p.setOwner({id:'dex',alias:'Dex'});await p.load();await p.react('Dex','like');let release;f.holdNext(new Promise(resolve=>release=resolve));const pending=p.load();p.setOwner({id:'nix',alias:'Nix'});release();await pending;assert.deepEqual(p.reactions,[]);assert.equal(p.alias,'Nix');f.client.auth.stopAutoRefresh();
});
test('Profil-HTML escaped Namen und Beschreibungen und enthält nur öffentliche Felder',()=>{
 const p=new Profiles({client:{}});p.rows=[{alias:'Dex',display_name:'<script>name</script>',bio:'<img onerror="bad">\nText',avatar_path:'',follower_count:3,like_count:2,updated_at:'v1',spotifyToken:'secret'}];
 const html=profileCard(p.rows[0],p),{document}=parseHTML(html);assert.equal(document.querySelector('script'),null);assert.equal(document.querySelector('.artist-bio img'),null);assert.match(document.querySelector('h2').textContent,/<script>/);assert.ok(!html.includes('secret'));assert.equal(document.querySelectorAll('[data-profile-action]').length,3);assert.match(profilesView(p,{alias:'Dex'},CLOUD.publicBase),/Profil öffentlich speichern/);
});
test('Profilbilder werden mittig auf 512 Pixel zugeschnitten und nur als Rasterbild akzeptiert',async()=>{
 let crop,closed=false;const blob=new Blob(['safe webp'],{type:'image/webp'}),canvas={getContext:()=>({drawImage(...args){crop=args;}}),toBlob:resolve=>resolve(blob)},file=new Blob(['png'],{type:'image/png'});
 const result=await prepareAvatar(file,{createBitmap:async()=>({width:1000,height:600,close(){closed=true;}}),document:{createElement:()=>canvas}});
 assert.equal(result,blob);assert.deepEqual(crop.slice(1),[200,0,600,600,0,0,512,512]);assert.equal(canvas.width,512);assert.ok(closed);await assert.rejects(prepareAvatar(new Blob(['svg'],{type:'image/svg+xml'})),/PNG/);
});
test('Eigene Profilfarbe wird öffentlich gespeichert, validiert und auf jedes Banner angewandt',async()=>{
 const {profileColor,applyProfileColors}=await import('../app/profiles.mjs');const f=fixture(),p=new Profiles({client:f.client});p.setOwner({id:'dex',alias:'Dex'});await p.load();await p.save({display_name:'Dex',bio:'',accent_color:'#EF8429'});assert.equal(f.rows[0].accent_color,'#ef8429');assert.equal(f.rows[1].accent_color,undefined);assert.throws(()=>profileInput({display_name:'Dex',accent_color:'red; background:url(evil)'},'Dex'),/Profilfarbe/);assert.equal(profileColor('url(evil)','Nix'),'#c777ff');
 const {document}=parseHTML(f.rows.map(row=>profileCard(row,p)).join(''));applyProfileColors(document,f.rows);assert.equal(document.querySelector('[data-artist="dex"]').style.getPropertyValue('--profile-accent'),'#ef8429');assert.equal(document.querySelectorAll('.artist-wordmark').length,3);assert.equal(document.querySelector('.artist-wordmark').getAttribute('aria-label'),'Dex');
 p.setOwner(null);await p.load();assert.equal(p.rows[0].accent_color,'#ef8429');f.client.auth.stopAutoRefresh();
});
