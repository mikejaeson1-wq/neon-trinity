import {CLOUD} from './cloud-config.mjs';
export class ListeningAPI{
 constructor({client=null,fetcher=globalThis.fetch,storage=globalThis.sessionStorage}={}){Object.assign(this,{client,fetcher,storage});this.owner=null;this.tickets=new Map();}
 async session(){const result=await this.client?.auth.getSession();if(result?.error)throw result.error;const session=result?.data?.session||null,owner=session?.user?.id||null;if(this.owner!==owner){this.owner=owner;this.tickets.clear();}return session;}
 async raw(path,method,data,session,extra={}){
  const id=path.match(/^\/listen\/([a-f0-9]{64})/)?.[1],ticket=id&&this.tickets.get(id),headers={apikey:CLOUD.key,'Content-Type':'application/json',...extra};if(session)headers.Authorization='Bearer '+session.access_token;if(ticket?.expiresAt>Date.now())headers['x-listen-ticket']=ticket.accessToken;
  const response=await this.fetcher(CLOUD.url+'/functions/v1/neon-public'+path,{method,headers,cache:'no-store',...(data!==undefined?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(30000)}),value=await response.json().catch(()=>({error:'Der Musikdienst ist nicht erreichbar.'}));if(!response.ok)throw Object.assign(new Error(value.error||'Die Hörsession ist nicht erreichbar.'),{status:response.status,accessMode:value.accessMode,errorCode:value.errorCode});return value;
 }
 async request(path,method='GET',data,extra={}){
  const session=await this.session(),id=path.match(/^\/listen\/([a-f0-9]{64})/)?.[1],ticket=id&&this.tickets.get(id);
  if(ticket&&ticket.expiresAt-Date.now()<120000&&ticket.expiresAt>Date.now()&&!path.endsWith('/access')){const refreshed=await this.raw('/listen/'+id+'/access','POST',{renew:true},session);this.tickets.set(id,refreshed);}
  const value=await this.raw(path,method,data,session,extra);if(path.endsWith('/access')&&value.accessToken)this.tickets.set(id,value);return value;
 }
 access(id,code=''){return this.request('/listen/'+id+'/access','POST',{code});}
 clear(){this.tickets.clear();}
}
export class RoomPresence{
 constructor({api,getRoom,getName=()=> 'Gast',onChange=()=>{},onError=()=>{}}){Object.assign(this,{api,getRoom,getName,onChange,onError});this.id=null;this.secret='';this.room=null;this.enabled=false;this.timer=null;this.generation=0;this.busy=false;this.tracks=[];}
 async start(){const room=this.getRoom();if(!room)return;this.enabled=true;if(this.room!==room){this.generation++;this.id=null;this.secret='';this.room=room;}clearInterval(this.timer);await this.tick();this.timer=setInterval(()=>this.tick().catch(this.onError),10000);this.timer.unref?.();}
 async tick(){if(this.busy||!this.enabled||this.room!==this.getRoom())return;this.busy=true;const gen=this.generation;try{const r=await this.api.request('/listen/'+this.room+'/guest','POST',{id:this.id,name:this.getName()||'Gast',listening:this.enabled},this.secret?{'x-listen-guest':this.secret}:{});if(gen!==this.generation)return;this.id=r.id;if(r.guestToken)this.secret=r.guestToken;this.onChange();}catch(e){if(e.errorCode==='guest-expired'){this.id=null;this.secret='';}throw e;}finally{this.busy=false;}}
 async catalog(){const room=this.getRoom(),r=await this.api.request('/listen/'+room+'/catalog');if(room===this.getRoom())this.tracks=r.tracks||[];return this.tracks;}
 async request(trackId){if(!this.id)await this.start();await this.api.request('/listen/'+this.room+'/request','POST',{guestId:this.id,trackId},{'x-listen-guest':this.secret});}
 stop(){clearInterval(this.timer);this.timer=null;this.enabled=false;const room=this.room,id=this.id,secret=this.secret;this.generation++;if(room&&id)this.api.request('/listen/'+room+'/guest','POST',{id,name:this.getName()||'Gast',listening:false},{'x-listen-guest':secret}).catch(()=>{});this.id=null;this.secret='';this.room=null;this.tracks=[];}
}
