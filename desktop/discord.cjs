const net=require('node:net');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const LOGO_URL='https://mikejaeson1-wq.github.io/neon-trinity/assets/icon.png';
function frame(opcode,data){const body=Buffer.from(JSON.stringify(data),'utf8'),header=Buffer.alloc(8);header.writeUInt32LE(opcode,0);header.writeUInt32LE(body.length,4);return Buffer.concat([header,body]);}
function activityFor(state){
  if(state?.private)return null;
  const activity={type:2,details:state?.title?String(state.title).slice(0,128):'Im Neon Trinity Studio',state:state?.title?(state.paused?'Pausiert · ':'')+String(state.artist||'Neon Trinity').slice(0,110):'Dex · Nix · Jax',assets:{large_image:LOGO_URL,large_text:'Neon Trinity · Dex, Nix & Jax'}};
  if(state?.title&&!state.paused){activity.timestamps={start:Math.floor(Date.now()/1000-(Number(state.position)||0))};if(state.duration>0)activity.timestamps.end=activity.timestamps.start+Math.floor(state.duration);}
  if(state?.roomUrl){try{const u=new URL(state.roomUrl);if(u.protocol==='https:')activity.buttons=[{label:'Mithören',url:u.href.slice(0,512)}];}catch{}}
  return activity;
}
class DiscordPresence{
  constructor(onStatus=()=>{},options={}){
    this.onStatus=onStatus;this.options={connect:net.createConnection,platform:process.platform,runtime:process.env.XDG_RUNTIME_DIR||process.env.TMPDIR||'/tmp',pipeTimeout:250,handshakeTimeout:5000,retryDelay:15000,...options};
    this.clientId='';this.expectedUserId='';this.discordUserId='';this.socket=null;this.ready=false;this.state={};this.lastSent=0;this.retry=null;this.pending=null;this.handshake=null;this.connecting=false;this.generation=0;this.lastError='';this.lastAcceptedAt=null;this.activityNonce='';this.message='Discord noch nicht verbunden.';this.pipeIndex=null;
  }
  status(message){this.message=message;this.onStatus(message);}
  diagnostics(){return {message:this.message,connected:!!this.socket,ready:this.ready,clientId:this.clientId,discordUserId:this.discordUserId,expectedUserId:this.expectedUserId,accountMatches:!this.expectedUserId||!this.discordUserId||this.expectedUserId===this.discordUserId,lastAcceptedAt:this.lastAcceptedAt,lastError:this.lastError,pipeIndex:this.pipeIndex,hidden:!!this.state?.private};}
  configure(id,expectedUserId='',force=false){
    if(typeof id!=='string'||id&&!/^\d{16,22}$/.test(id))throw new Error('Ungültige Discord Application ID.');
    if(expectedUserId&&!/^\d{16,22}$/.test(expectedUserId))throw new Error('Ungültige Discord-Konto-ID.');
    if(!force&&id===this.clientId){this.expectedUserId=expectedUserId;return this.diagnostics();}
    this.close();this.clientId=id;this.expectedUserId=expectedUserId;this.lastError='';this.lastAcceptedAt=null;
    if(id){this.status('Discord Desktop wird gesucht …');this.connect();}else this.status('Discord-Aktivität deaktiviert.');return this.diagnostics();
  }
  reconnect(id=this.clientId,expectedUserId=this.expectedUserId){return this.configure(id,expectedUserId,true);}
  async connect(){
    if(!this.clientId||this.connecting||this.socket)return;
    this.connecting=true;const generation=this.generation,id=this.clientId;
    for(let index=0;index<10;index++){
      const socketPath=this.options.platform==='win32'?`\\\\?\\pipe\\discord-ipc-${index}`:path.join(this.options.runtime,`discord-ipc-${index}`);
      const socket=await new Promise(resolve=>{
        let done=false,candidate;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
        const timer=setTimeout(()=>{candidate?.destroy();finish(null);},this.options.pipeTimeout);timer.unref?.();
        try{candidate=this.options.connect(socketPath);candidate.once('connect',()=>finish(candidate));candidate.once('error',()=>{candidate.destroy();finish(null);});candidate.once('close',()=>finish(null));}catch{finish(null);}
      });
      if(generation!==this.generation||id!==this.clientId){socket?.destroy();return;}
      if(!socket)continue;
      this.socket=socket;this.pipeIndex=index;this.connecting=false;let buffer=Buffer.alloc(0);
      const current=()=>generation===this.generation&&this.socket===socket;
      socket.on('data',chunk=>{
        if(!current())return;buffer=Buffer.concat([buffer,chunk]);
        while(buffer.length>=8){
          const op=buffer.readUInt32LE(0),length=buffer.readUInt32LE(4);
          if(length>1024*1024){this.fail('Discord hat eine ungültige Antwort gesendet.',socket);return;}if(buffer.length<8+length)return;
          let data;try{data=JSON.parse(buffer.subarray(8,8+length).toString());}catch{this.fail('Discord-Antwort konnte nicht gelesen werden.',socket);return;}buffer=buffer.subarray(8+length);
          if(op===3){socket.write(frame(4,data));continue;}
          if(op===2){this.fail(String(data.message||'Discord hat die Verbindung beendet.'),socket);return;}
          if(data.evt==='READY'){
            clearTimeout(this.handshake);this.handshake=null;this.ready=true;this.discordUserId=String(data.data?.user?.id||'');this.lastError='';this.lastSent=0;this.status(this.connectionMessage());this.update(this.state);
          }else if(data.evt==='ERROR'){
            this.lastError=String(data.data?.message||'Aktivität wurde abgelehnt.').slice(0,220);this.status('Discord: '+this.lastError);
            if(!this.ready){socket.destroy();return;}
          }else if(data.cmd==='SET_ACTIVITY'&&data.nonce===this.activityNonce){
            this.lastAcceptedAt=new Date().toISOString();this.lastError='';this.status(this.connectionMessage(true));
          }
        }
      });
      socket.on('error',error=>{if(current())this.lastError=String(error.message||'Verbindung unterbrochen.').slice(0,220);});
      socket.on('close',()=>{if(!current())return;clearTimeout(this.handshake);this.handshake=null;this.socket=null;this.ready=false;this.discordUserId='';this.status(this.lastError?'Discord: '+this.lastError+' Neuverbindung folgt.':'Discord getrennt · Neuverbindung folgt.');this.scheduleRetry();});
      this.handshake=setTimeout(()=>{if(current()&&!this.ready)this.fail('Discord antwortet nicht auf die Anmeldung. Bitte Discord Desktop neu starten.',socket);},this.options.handshakeTimeout);this.handshake.unref?.();
      socket.write(frame(0,{v:1,client_id:id}));return;
    }
    if(generation!==this.generation)return;this.connecting=false;this.status('Discord Desktop nicht gefunden. Discord öffnen; das Studio versucht es erneut.');this.scheduleRetry();
  }
  connectionMessage(accepted=false){
    if(this.expectedUserId&&this.discordUserId&&this.expectedUserId!==this.discordUserId)return 'Discord verbunden, aber mit einem anderen Konto als im Studio. Bitte in Discord zum selben Konto wechseln.';
    if(this.state?.private)return 'Discord verbunden · private lokale Songs und Spotify werden vom Studio ausgeblendet.';
    return accepted?'Discord hat die Aktivität angenommen. Sichtbarkeit wird in Discord unter Aktivitätsfreigabe gesteuert.':'Discord verbunden · Aktivität wird übertragen …';
  }
  fail(message,socket){this.lastError=message;this.status('Discord: '+message);socket.destroy();}
  scheduleRetry(){clearTimeout(this.retry);if(this.clientId){this.retry=setTimeout(()=>{this.retry=null;this.connect();},this.options.retryDelay);this.retry.unref?.();}}
  update(state){
    if(!!state?.private!==!!this.state?.private)this.lastSent=0;this.state=state||{};if(!this.ready||!this.socket)return;
    const wait=15000-(Date.now()-this.lastSent);if(wait>0){if(!this.pending){this.pending=setTimeout(()=>{this.pending=null;this.update(this.state);},wait);this.pending.unref?.();}return;}
    clearTimeout(this.pending);this.pending=null;this.lastSent=Date.now();this.activityNonce=randomUUID();
    try{this.socket.write(frame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:activityFor(this.state)},nonce:this.activityNonce}));}catch(error){this.fail(error.message,this.socket);}
  }
  close(){
    this.generation++;clearTimeout(this.retry);clearTimeout(this.pending);clearTimeout(this.handshake);this.pending=null;this.retry=null;this.handshake=null;this.connecting=false;this.clientId='';this.ready=false;this.discordUserId='';this.pipeIndex=null;
    const socket=this.socket;this.socket=null;if(socket){try{socket.write(frame(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:null},nonce:randomUUID()}));}catch{}socket.destroy();}
  }
}
module.exports={DiscordPresence,activityFor,frame,LOGO_URL};
