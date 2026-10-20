const commands=new Set(['toggle','pause','resume','previous','next','seek','volume','queue-play','queue-move','listen-stop']);
const check=r=>{if(r.error)throw new Error(r.error.message||'Die Fernbedienung konnte nicht verbunden werden.');return r.data;};
export function remoteInput(command,payload={}){
 if(!commands.has(command))throw new Error('Unzulässiger Fernbedienungsbefehl.');const value={};
 if(command==='seek'||command==='volume'){const n=Number(payload.value);if(!Number.isFinite(n)||n<0||n>1)throw new Error('Ungültiger Playerwert.');value.value=n;}
 if(command==='queue-play'){if(typeof payload.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(payload.id))throw new Error('Ungültiger Song.');value.id=payload.id;}
 if(command==='queue-move'){const from=Number(payload.from),to=Number(payload.to);if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>2000||to>2000)throw new Error('Ungültige Reihenfolge.');Object.assign(value,{from,to});}
 return {command,payload:value};
}
export class StudioRemote{
 constructor({client,getOwner,getSnapshot,onCommand,onChange=()=>{}}){Object.assign(this,{client,getOwner,getSnapshot,onCommand,onChange});this.owner=null;this.device=null;this.timer=null;this.busy=false;this.generation=0;this.message='Fernbedienung ausgeschaltet.';}
 async configure(owner,options){
  const id=owner?.id||null;if(this.owner===id&&this.device===options?.deviceId&&!!this.timer===!!options?.enabled)return;
  const old=this.device,oldOwner=this.owner;this.generation++;clearInterval(this.timer);this.timer=null;this.owner=id;this.device=null;this.busy=false;
  if(old&&oldOwner===id)await this.client.from('nt_remote_devices').delete().eq('id',old).eq('owner_id',oldOwner).then(()=>{},()=>{});
  if(!id||!options?.enabled){this.message='Fernbedienung ausgeschaltet.';return;}
  options.deviceId=options.deviceId||crypto.randomUUID();this.device=options.deviceId;this.label=String(options.label||'Mein Studio').slice(0,60);const gen=this.generation;await this.tick(gen);if(gen!==this.generation)return;this.timer=setInterval(()=>this.tick(gen).catch(e=>{this.message=e.message;this.onChange();}),2000);this.timer.unref?.();
 }
 valid(gen){return gen===this.generation&&this.owner===this.getOwner()?.id&&!!this.device;}
 async tick(gen=this.generation){
  if(!this.valid(gen)||this.busy)return;this.busy=true;
  try{const now=Date.now(),snapshot=this.getSnapshot(),state={title:String(snapshot.title||'').slice(0,180),artist:String(snapshot.artist||'').slice(0,160),source:snapshot.source,position:Number(snapshot.position)||0,duration:Number(snapshot.duration)||0,paused:!!snapshot.paused,volume:Number(snapshot.volume)||0,following:!!snapshot.following,queue:(snapshot.queue||[]).slice(0,500).map(t=>({id:t.id,title:String(t.title||'').slice(0,180),artist:String(t.artist||'').slice(0,160),active:!!t.active,playable:t.playable!==false}))};
   check(await this.client.from('nt_remote_devices').upsert({id:this.device,owner_id:this.owner,label:this.label,state,updated_at:new Date(now).toISOString(),expires_at:new Date(now+45000).toISOString()}));if(!this.valid(gen))return;
   const pending=check(await this.client.from('nt_remote_commands').select('*').eq('device_id',this.device).eq('owner_id',this.owner).is('acknowledged_at',null).gt('expires_at',new Date().toISOString()).order('created_at').limit(10));
   for(const row of pending){if(!this.valid(gen))return;const input=remoteInput(row.command,row.payload);const claimed=check(await this.client.from('nt_remote_commands').update({acknowledged_at:new Date().toISOString()}).eq('id',row.id).eq('owner_id',this.owner).is('acknowledged_at',null).select('id').maybeSingle());if(!claimed||!this.valid(gen))continue;await this.onCommand(input);}
   if(!this.valid(gen))return;check(await this.client.from('nt_remote_commands').delete().eq('device_id',this.device).lt('expires_at',new Date(now-60000).toISOString()));this.message='Handy-Fernbedienung verbunden.';this.onChange();
  }finally{if(gen===this.generation)this.busy=false;}
 }
 async close(){const owner=this.owner;this.generation++;clearInterval(this.timer);this.timer=null;if(this.device&&owner===this.getOwner()?.id)await this.client.from('nt_remote_devices').delete().eq('id',this.device).eq('owner_id',owner).then(()=>{},()=>{});this.device=null;}
}
export class MobileRemote{
 constructor({client,getOwner}){Object.assign(this,{client,getOwner});this.devices=[];}
 async load(){const owner=this.getOwner()?.id;if(!owner){this.devices=[];return [];}const rows=check(await this.client.from('nt_remote_devices').select('id,label,state,updated_at').eq('owner_id',owner).gt('expires_at',new Date().toISOString()).order('updated_at',{ascending:false}));if(this.getOwner()?.id!==owner)return [];this.devices=rows;return rows;}
 async send(device,command,payload){const owner=this.getOwner()?.id;if(!owner||!this.devices.some(d=>d.id===device))throw new Error('Bitte zuerst dein eigenes Studio auswählen.');const input=remoteInput(command,payload);check(await this.client.from('nt_remote_commands').insert({device_id:device,...input}));if(this.getOwner()?.id!==owner)throw new Error('Das Konto wurde gewechselt.');}
}
