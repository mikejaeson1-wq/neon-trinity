export function listeningPosition(room,roundTrip=0){
  const elapsed=room.playing?Math.max(0,(Number(room.serverTime)-Number(room.updatedAt))/1000)+Math.max(0,roundTrip)/2000:0;
  return Math.max(0,Math.min(room.track?.duration||Infinity,(Number(room.position)||0)+elapsed));
}
export function driftCorrection(current,target,playing=true){
  const delta=target-current;
  if(!playing||Math.abs(delta)>.7)return {seek:target,rate:1};
  return {seek:null,rate:Math.abs(delta)<.08?1:1+Math.max(-.03,Math.min(.03,delta*.06))};
}
export class SynchronizedPlayback{
  constructor(audio,{now=()=>performance.now(),onBlocked=()=>{},onState=()=>{}}={}){
    Object.assign(this,{audio,now,onBlocked,onState});this.enabled=false;this.room=null;this.timer=null;this.playingPromise=null;this.needsReload=false;this.blocked=false;this.forceSeek=false;this.generation=0;
    this.metadata=()=>{this.forceSeek=true;this.tick();};this.mediaError=()=>{if(this.room)this.needsReload=true;};audio.addEventListener('loadedmetadata',this.metadata);audio.addEventListener('error',this.mediaError);
  }
  async accept(room,roundTrip=0){
    const changed=this.room?.track?.id!==room.track.id||this.needsReload;this.room=room;this.anchor=this.now();this.position=listeningPosition(room,roundTrip);this.received=this.anchor;
    if(changed){this.generation++;this.playingPromise=null;this.audio.pause();this.audio.src=room.mediaUrl;this.needsReload=false;this.forceSeek=true;this.blocked=false;}
    if(!this.timer){this.timer=setInterval(()=>this.tick(),500);this.timer.unref?.();}await this.tick();
  }
  target(){return Math.min(this.room?.track.duration||Infinity,(this.position||0)+(this.room?.playing?Math.max(0,this.now()-this.anchor)/1000:0));}
  async start(){this.enabled=true;this.blocked=false;await this.tick();}
  stop(){this.enabled=false;this.audio.pause();this.audio.playbackRate=1;this.onState('stopped');}
  async tick(){
    if(!this.room)return;
    const stale=this.now()-this.received>25000,shouldPlay=this.enabled&&this.room.playing&&!stale;
    const target=this.target(),correction=driftCorrection(Number(this.audio.currentTime)||0,target,shouldPlay);
    if(this.forceSeek||correction.seek!==null){try{this.audio.currentTime=target;this.forceSeek=false;}catch{this.forceSeek=true;}}
    this.audio.playbackRate=correction.rate;
    if(!shouldPlay){if(!this.audio.paused)this.audio.pause();this.onState(stale?'offline':!this.enabled?'stopped':'paused');return;}
    if(this.audio.paused&&!this.playingPromise&&!this.blocked){const generation=this.generation;const task=Promise.resolve().then(()=>this.audio.play());this.playingPromise=task;try{await task;}catch(e){if(this.generation===generation&&e?.name!=='AbortError'){this.blocked=true;this.onBlocked(e);}}finally{if(this.playingPromise===task)this.playingPromise=null;}if(this.generation!==generation||!this.enabled||!this.room?.playing){if(this.generation===generation)this.audio.pause();return;}}
    this.onState(this.blocked?'blocked':'playing');
  }
  reset(){clearInterval(this.timer);this.timer=null;this.generation++;this.room=null;this.enabled=false;this.blocked=false;this.playingPromise=null;this.needsReload=false;this.audio.pause();this.audio.playbackRate=1;}
  destroy(){this.reset();this.audio.removeEventListener('loadedmetadata',this.metadata);this.audio.removeEventListener('error',this.mediaError);}
}
