import {createClient} from './vendor/supabase.mjs';
import {CLOUD} from './cloud-config.mjs';
import {Profiles,PROFILE_ALIASES,profileLink,applyProfileColors} from './profiles.mjs';
import {profileCard} from './profiles-view.mjs';
import {escapeHTML as h} from './core.mjs';
const $=s=>document.querySelector(s);
const client=createClient(CLOUD.url,CLOUD.key,{auth:{flowType:'pkce',detectSessionInUrl:false,persistSession:true,autoRefreshToken:true,storageKey:'neon-trinity-community-auth'}});
const profiles=new Profiles({client,onChange:render});
let user=null,loginBusy=false;
const selected=()=>PROFILE_ALIASES.find(a=>a.toLowerCase()===new URL(location.href).searchParams.get('artist')?.toLowerCase());
function message(text){$('#community-status').textContent=text||'';}
function render(){
 const artist=selected(),rows=artist?profiles.rows.filter(p=>p.alias===artist):profiles.rows;
 $('#artist-profiles').classList.toggle('single-profile',!!artist);
 $('#artist-profiles').innerHTML=rows.map(p=>profileCard(p,profiles,{publicPage:true})).join('');applyProfileColors(document,rows);
 $('#artist-navigation').innerHTML='<a href="profile.html" '+(!artist?'aria-current="page"':'')+'>Die Band</a>'+PROFILE_ALIASES.map(a=>'<a href="'+profileLink(a)+'" '+(artist===a?'aria-current="page"':'')+'>'+a+'</a>').join('');
 const name=rows.length===1?rows[0].display_name:'Lerne die Stimmen kennen.';$('#profile-heading').textContent=name;document.title=(artist?name:'Profile')+' · Neon Trinity';
 $('#discord-login').hidden=!!user;$('#discord-logout').hidden=!user;$('#account-status').textContent=user?'Mit Discord verbunden':'';$('#reaction-settings').hidden=!user;
 if(profiles.message)message(profiles.message);
}
async function login(){
 if(loginBusy)return;loginBusy=true;$('#discord-login').disabled=true;try{const artist=selected();if(artist)sessionStorage.setItem('neon-trinity-profile-return',artist);
 const redirect=new URL('profile.html',location.href).href.split('?')[0].split('#')[0];const {data,error}=await client.auth.signInWithOAuth({provider:'discord',options:{redirectTo:redirect,skipBrowserRedirect:true,scopes:'identify'}});if(error)throw error;location.assign(data.url);
 }catch(e){message(e.message);loginBusy=false;$('#discord-login').disabled=false;}
}
$('#discord-login').onclick=login;
$('#discord-logout').onclick=async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error){message(error.message);return;}user=null;profiles.setOwner(null);await profiles.load();message('Du bist abgemeldet. Deine Likes und Abos bleiben gespeichert.');render();};
$('#clear-reactions').onclick=async()=>{if(!user)return;try{$('#clear-reactions').disabled=true;const {error}=await client.from('nt_profile_reactions').delete().eq('user_id',user.id);if(error)throw error;await profiles.load();message('Deine Likes und Abos wurden entfernt.');}catch(e){message(e.message);}finally{$('#clear-reactions').disabled=false;}};
document.addEventListener('click',async event=>{const button=event.target.closest('[data-profile-action]');if(!button)return;try{const {profileAction:action,alias}=button.dataset;if(action==='share'){await navigator.clipboard.writeText(profileLink(alias));message('Profillink kopiert.');return;}if(!user){await login();return;}await profiles.react(alias,action);message(action==='follow'?(profiles.has(alias,action)?'Du folgst jetzt '+alias+'.':'Du folgst '+alias+' nicht mehr.'):(profiles.has(alias,action)?'Dein Like ist gespeichert.':'Dein Like wurde entfernt.'));}catch(e){message(e.message);}});
async function start(){
 const url=new URL(location.href),code=url.searchParams.get('code'),error=url.searchParams.get('error_description');let authError='';
 if(code){try{const result=await client.auth.exchangeCodeForSession(code);if(result.error)throw result.error;}catch(e){authError='Die Discord-Anmeldung konnte nicht abgeschlossen werden. Bitte erneut versuchen.';}
 const artist=sessionStorage.getItem('neon-trinity-profile-return');sessionStorage.removeItem('neon-trinity-profile-return');history.replaceState({},'',url.pathname+(PROFILE_ALIASES.includes(artist)?'?artist='+artist.toLowerCase():''));}
 else if(error){history.replaceState({},'',url.pathname);authError='Die Discord-Anmeldung wurde abgebrochen oder abgelehnt.';}
 const roomReturn=sessionStorage.getItem('neon-trinity-room-return');if((code||error)&&/^[a-f0-9]{64}$/.test(roomReturn||'')){sessionStorage.removeItem('neon-trinity-room-return');location.replace(new URL('album.html?room='+roomReturn,location.href).href);return;}
 const mobileReturn=Number(sessionStorage.getItem('neon-trinity-mobile-return'));if((code||error)&&mobileReturn&&Date.now()-mobileReturn<15*60*1000){sessionStorage.removeItem('neon-trinity-mobile-return');location.replace(new URL('mobile.html',location.href).href);return;}
 try{const result=await client.auth.getSession();if(result.error)throw result.error;if(result.data.session){const verified=await client.auth.getUser();if(!verified.error)user=verified.data.user;}profiles.setOwner(user);await profiles.load();message(authError);render();}catch(e){message(e.message);render();}
 try{const {data,error}=await client.from('nt_releases').select('id,data').order('updated_at',{ascending:false});if(error)throw error;$('#release-list').innerHTML=(data||[]).map(r=>'<a class="release-card" href="album.html?id='+encodeURIComponent(r.id)+'"><img src="assets/neon-trinity.png" alt=""><div><h3>'+h(r.data?.album?.title||'Neon Trinity')+'</h3><p>'+Number(r.data?.tracks?.length||0)+' Songs · Neon Trinity</p><span>Album anhören ↗</span></div></a>').join('');$('#public-releases').hidden=!data?.length;}catch{$('#public-releases').hidden=true;}
}
start().then(()=>client.auth.onAuthStateChange((_event,session)=>{const next=session?.user||null;if((next?.id||null)!==(user?.id||null)){user=next;profiles.setOwner(user);render();queueMicrotask(()=>profiles.load().catch(e=>message(e.message)));}})).catch(e=>message(e.message));
