const API='https://api.github.com';
function validRequest(input){
  if(!input||!['GET','POST','PATCH','PUT'].includes(input.method)||typeof input.endpoint!=='string')throw new Error('Ungültige GitHub-Anfrage.');
  const path=input.endpoint;
  const pattern=/^\/repos\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+(?:\/git\/(?:ref\/heads\/[A-Za-z0-9%_.-]+|refs\/heads\/[A-Za-z0-9%_.-]+|commits(?:\/[a-f0-9]{40})?|trees(?:\/[a-f0-9]{40}(?:\?recursive=1)?)?|blobs)|\/contents\/docs\/neon-trinity\.json|\/pages(?:\/builds\/latest)?)?$/;
  const initializeReadme=input.method==='PUT'&&/^\/repos\/[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+\/contents\/README\.md$/.test(path)&&!input.body?.sha;
  if(!['/user','/user/repos'].includes(path)&&!pattern.test(path)&&!initializeReadme)throw new Error('Dieser GitHub-Endpunkt ist im Studio nicht freigegeben.');
  if(path.includes('..')||path.includes('%2e')||path.includes('%2E'))throw new Error('Ungültiger GitHub-Pfad.');
  if(JSON.stringify(input.body||{}).length>72*1024*1024)throw new Error('Diese Datei ist zu groß für die integrierte Veröffentlichung.');
  return true;
}
async function githubRequest(token,input,fetchImpl=fetch){
  validRequest(input);
  const response=await fetchImpl(API+input.endpoint,{method:input.method,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Neon-Trinity-Studio',...(input.body?{'Content-Type':'application/json'}:{})},...(input.body?{body:JSON.stringify(input.body)}:{})});
  const data=response.status===204?{}:await response.json();
  if(!response.ok){const error=new Error(`GitHub (${response.status}): ${data.message||'Anfrage fehlgeschlagen'}`);error.status=response.status;throw error;}
  return data;
}
module.exports={validRequest,githubRequest};
