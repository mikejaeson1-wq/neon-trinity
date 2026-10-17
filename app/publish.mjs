import { safeBaseUrl } from './core.mjs';
let sessionToken = '';
export function setSessionToken(token) { sessionToken = token.trim(); }
export async function request(endpoint, method = 'GET', body) {
  if (window.neonDesktop) return window.neonDesktop.request({ endpoint, method, body });
  if (!sessionToken) throw new Error('Bitte zuerst in den Einstellungen GitHub verbinden. Der Token bleibt im Browser nur für diese Sitzung.');
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method, headers: { Accept:'application/vnd.github+json', Authorization:`Bearer ${sessionToken}`, 'X-GitHub-Api-Version':'2022-11-28', ...(body ? {'Content-Type':'application/json'} : {}) },
    ...(body ? { body:JSON.stringify(body) } : {})
  });
  const data = response.status === 204 ? {} : await response.json();
  if (!response.ok) { const e = new Error(`GitHub (${response.status}): ${data.message || 'Anfrage fehlgeschlagen'}`); e.status = response.status; throw e; }
  return data;
}
export async function connect(token) {
  if(window.neonDesktop) await window.neonDesktop.setToken(token.trim()); else setSessionToken(token);
  try { return await request('/user'); } catch (e) { if(window.neonDesktop) await window.neonDesktop.clearToken(); else setSessionToken(''); throw e; }
}
export async function disconnect() { sessionToken=''; if(window.neonDesktop) await window.neonDesktop.clearToken(); }
export async function ensureRepository(owner, repo, create) {
  if(!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo)) throw new Error('Ungültiger GitHub-Benutzer oder Repository-Name.');
  if (create) {
    const user=await request('/user');
    if(user.login.toLowerCase()!==owner.toLowerCase()) throw new Error('Neue Repositories können nur im verbundenen persönlichen GitHub-Konto erstellt werden.');
    return request('/user/repos','POST',{name:repo,private:false,auto_init:true,description:'Neon Trinity · Musik, Alben und Live-Setlists für Dex, Nix und Jax',has_wiki:false,has_projects:false});
  }
  const found=await request(`/repos/${owner}/${repo}`);
  if(found.private) throw new Error('Für kostenloses GitHub Pages bitte ein öffentliches Repository verwenden.');
  if(!found.permissions?.push) throw new Error('Dieses Konto darf nicht in das Repository schreiben.');
  return found;
}
export async function base64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary='';
  for (let i=0;i<bytes.length;i+=32768) binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return btoa(binary);
}
export async function gitHash(blob) {
  const data=new Uint8Array(await blob.arrayBuffer()), header=new TextEncoder().encode(`blob ${data.length}\0`), bytes=new Uint8Array(header.length+data.length);
  bytes.set(header);bytes.set(data,header.length);
  const digest=await crypto.subtle.digest('SHA-1',bytes);
  return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
export async function publishFiles(settings, files, onProgress=()=>{}) {
  const configured=safeBaseUrl(settings.baseUrl);
  const root=`/repos/${settings.owner}/${settings.repo}`;
  const repo=await request(root);if(repo.private) throw new Error('Das Repository muss für kostenloses Pages öffentlich sein.');
  const branch=repo.default_branch;
  let ref;
  try{ref=await request(`${root}/git/ref/heads/${encodeURIComponent(branch)}`);}
  catch(error){
    if(error.status!==404&&error.status!==409)throw error;
    onProgress('Leeres Repository wird für die Website vorbereitet …');
    // No sha is sent: GitHub refuses to overwrite an existing README or commit.
    await request(`${root}/contents/README.md`,'PUT',{message:'Initialize Neon Trinity website',content:await base64(new Blob(['# Neon Trinity\n\nPublic album player for Dex, Nix and Jax. Music is stored in Supabase.\n']))});
    ref=await request(`${root}/git/ref/heads/${encodeURIComponent(branch)}`);
  }
  const parent=await request(`${root}/git/commits/${ref.object.sha}`);
  const existing=await request(`${root}/git/trees/${parent.tree.sha}?recursive=1`);
  if(existing.truncated) throw new Error('Dieses Repository ist für die integrierte Veröffentlichung zu groß.');
  const lookup=new Map(existing.tree.filter(x=>x.type==='blob').map(x=>[x.path,x.sha]));
  const marker=await request(`${root}/contents/docs/neon-trinity.json`).catch(e=>{if(e.status===404)return null;throw e;});
  let ownMarker=false;
  if(marker?.content)try{ownMarker=JSON.parse(atob(marker.content.replace(/\s/g,''))).generator==='neon-trinity-studio';}catch{}
  if(!ownMarker && existing.tree.some(x=>x.path==='docs' || x.path.startsWith('docs/'))) throw new Error('Der Ordner docs enthält bereits eine andere Website. Bitte ein eigenes Neon-Trinity-Repository verwenden.');
  let pages=await request(`${root}/pages`).catch(e=>{if(e.status===404)return null;throw e;});
  if(pages && (pages.source?.branch!==branch || pages.source?.path!=='/docs') && !ownMarker)throw new Error('Dieses Repository veröffentlicht bereits eine andere Website. Bitte ein eigenes Neon-Trinity-Repository verwenden.');
  const total=files.reduce((n,f)=>n+f.blob.size,0);
  if(total > 700*1024*1024) throw new Error('Die Veröffentlichung überschreitet das Studio-Limit von 700 MiB. Bitte weniger Alben gleichzeitig veröffentlichen.');
  const tree=[];let complete=0;
  for(const file of files) {
    onProgress(`${++complete} / ${files.length} · ${file.path}`);
    const path=`docs/${file.path}`, hash=await gitHash(file.blob);
    if(lookup.get(path)===hash) {tree.push({path,mode:'100644',type:'blob',sha:hash});continue;}
    const result=await request(`${root}/git/blobs`,'POST',{content:await base64(file.blob),encoding:'base64'});
    tree.push({path,mode:'100644',type:'blob',sha:result.sha});
  }
  // Previous public files are removed from the live tree when they are no longer published.
  // Git history intentionally remains available on GitHub.
  const paths=new Set(tree.map(x=>x.path));
  for(const item of existing.tree)if(item.type==='blob'&&item.path.startsWith('docs/')&&item.path!=='docs/CNAME'&&!paths.has(item.path))tree.push({path:item.path,mode:'100644',type:'blob',sha:null});
  if(tree.some(t=>t.sha===null||lookup.get(t.path)!==t.sha)) {
    const built=await request(`${root}/git/trees`,'POST',{base_tree:parent.tree.sha,tree});
    const commit=await request(`${root}/git/commits`,'POST',{message:'Publish Neon Trinity albums',tree:built.sha,parents:[ref.object.sha]});
    // A concurrent remote update fails rather than overwriting somebody else's commit.
    await request(`${root}/git/refs/heads/${encodeURIComponent(branch)}`,'PATCH',{sha:commit.sha,force:false});
  }
  onProgress('Website bei GitHub Pages anmelden …');
  if(!pages)pages=await request(`${root}/pages`,'POST',{build_type:'legacy',source:{branch,path:'/docs'}});
  if(pages.source?.branch!==branch || pages.source?.path!=='/docs') {
    if(!ownMarker)throw new Error('Das Repository hat bereits eine andere Pages-Konfiguration. Bitte deren Einstellungen prüfen.');
    pages=await request(`${root}/pages`,'PUT',{build_type:'legacy',source:{branch,path:'/docs'}});
  }
  return { url:configured || pages.html_url || `https://${settings.owner}.github.io/${settings.repo}/`,status:pages.status || 'building' };
}
export async function pagesStatus(settings) {
  const root=`/repos/${settings.owner}/${settings.repo}`;
  // Verify repository access first, so a missing Pages site is not confused
  // with a wrong repository name or an inaccessible repository.
  await ensureRepository(settings.owner,settings.repo,false);
  let pages;
  try{pages=await request(`${root}/pages`);}
  catch(error){if(error.status!==404)throw error;return {status:'not-configured',url:safeBaseUrl(settings.baseUrl)||`https://${settings.owner}.github.io/${settings.repo}/`,message:'Das Repository ist erreichbar. GitHub Pages ist noch nicht eingerichtet. Klicke auf „Albumwebsite einrichten / aktualisieren“. Falls das weiterhin scheitert, prüfe die Pages-Schreibrechte deines GitHub-Tokens.'};}
  const build=await request(`${root}/pages/builds/latest`).catch(e=>{if(e.status===404)return {status:'queued'};throw e;});
  return {url:pages.html_url,status:build.status||pages.status,error:build.error?.message};
}
export async function seedSourceRepository(settings, onProgress=()=>{}) {
  const response=await fetch(new URL('./source-bundle.json',import.meta.url));
  if(!response.ok)throw new Error('Das Quellcodepaket konnte nicht geladen werden.');
  const bundle=await response.json();
  if(bundle.generator!=='neon-trinity-source'||!Array.isArray(bundle.files))throw new Error('Ungültiges Quellcodepaket.');
  const root=`/repos/${settings.owner}/${settings.repo}`,repo=await request(root),branch=repo.default_branch;
  const ref=await request(`${root}/git/ref/heads/${encodeURIComponent(branch)}`),parent=await request(`${root}/git/commits/${ref.object.sha}`);
  const current=await request(`${root}/git/trees/${parent.tree.sha}?recursive=1`);
  // This function is used immediately after creating a new repository. Existing code is never replaced.
  if(current.truncated||current.tree.some(x=>x.type==='blob'&&x.path!=='README.md'))throw new Error('Das Repository enthält schon Dateien. Der automatische Quellcode-Upload wurde zum Schutz vorhandener Inhalte ausgelassen.');
  const tree=[];let count=0;
  for(const file of bundle.files){
    if(!/^[A-Za-z0-9_./-]+$/.test(file.path)||file.path.includes('..')||file.path.startsWith('/')||file.path.startsWith('.openai/'))throw new Error('Ungültiger Pfad im Quellcodepaket.');
    onProgress(`App-Quellcode ${++count} / ${bundle.files.length} …`);
    const blob=await request(`${root}/git/blobs`,'POST',{content:file.content,encoding:'base64'});
    tree.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha});
  }
  const built=await request(`${root}/git/trees`,'POST',{base_tree:parent.tree.sha,tree});
  const commit=await request(`${root}/git/commits`,'POST',{message:'Add Neon Trinity Studio source',tree:built.sha,parents:[ref.object.sha]});
  await request(`${root}/git/refs/heads/${encodeURIComponent(branch)}`,'PATCH',{sha:commit.sha,force:false});
}
