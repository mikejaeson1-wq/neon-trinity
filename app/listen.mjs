export {listeningPosition} from './listen-sync.mjs';
import {listeningPosition} from './listen-sync.mjs';
export class ListeningSession{
  constructor({team,getPlayer,onRemote,onChange=()=>{},onError=()=>{}}){Object.assign(this,{team,getPlayer,onRemote,onChange,onError});this.hostRoom=null;this.followRoom=null;this.timer=null;this.busy=false;this.generation=0;this.chain=Promise.resolve();this.hosting=null;this.latency=0;}
  player(){const player=this.getPlayer();if(!player.trackId||player.private)throw new Error('Mithören ist nur für Songs aus der gemeinsamen Band-Mediathek verfügbar.');return {...player,position:Math.max(0,player.position+(player.playing?Math.min(.5,this.latency/2000):0))};}
  host(){
    if(this.hostRoom)return Promise.resolve(this.hostRoom);if(this.hosting)return this.hosting;
    if(!this.team.active)return Promise.reject(new Error('Melde dich zuerst mit Discord beim Team an.'));
    const task=(async()=>{const player=this.player(),leaving=this.leave(),generation=this.generation;await leaving;if(generation!==this.generation)return null;const start=Date.now(),room=await this.team.api('/api/listen','POST',player);if(generation!==this.generation){await this.team.api('/api/listen/'+room.id,'DELETE').catch(()=>{});return null;}this.latency=Date.now()-start;this.hostRoom=room;this.timer=setInterval(()=>this.updateHost().catch(this.onError),5000);this.timer.unref?.();this.onChange();return room;})();
    this.hosting=task;task.finally(()=>{if(this.hosting===task)this.hosting=null;}).catch(()=>{});return task;
  }
  async updateHost(){
    if(!this.hostRoom)return;const generation=this.generation;
    this.chain=this.chain.catch(()=>{}).then(async()=>{if(!this.hostRoom||generation!==this.generation)return;const player=this.player(),start=Date.now();await this.team.api('/api/listen/'+this.hostRoom.id,'PATCH',player);const elapsed=Date.now()-start;if(elapsed<4000)this.latency=this.latency*.7+elapsed*.3;});return this.chain;
  }
  join(id){
    if(!/^[a-f0-9]{64}$/.test(id))return Promise.reject(new Error('Ungültiger Hörsession-Link.'));
    if(this.joining?.id===id)return this.joining.task;
    if(this.followRoom?.id===id)return Promise.resolve();
    const leaving=this.leave(),generation=this.generation;
    const task=(async()=>{await leaving;if(generation!==this.generation)return;this.followRoom={id,host:'',track:null};await this.poll();if(generation!==this.generation||this.followRoom?.id!==id)return;this.timer=setInterval(()=>this.poll().catch(this.onError),2000);this.timer.unref?.();this.onChange();})();
    this.joining={id,task};task.finally(()=>{if(this.joining?.task===task)this.joining=null;}).catch(()=>{});return task;
  }
  async poll(){
    if(!this.followRoom||this.busy)return;this.busy=true;const generation=this.generation,id=this.followRoom.id;
    try{const start=Date.now(),room=await this.team.api('/api/listen/'+id);if(generation!==this.generation||this.followRoom?.id!==id)return;this.followRoom=room;await this.onRemote(room,listeningPosition(room,Date.now()-start),Date.now()-start);this.onChange();}
    catch(e){if(generation!==this.generation)return;if(e.status===410){clearInterval(this.timer);this.timer=null;this.followRoom=null;this.onChange();}throw e;}finally{this.busy=false;}
  }
  async leave(){const room=this.hostRoom;this.generation++;clearInterval(this.timer);this.timer=null;this.hostRoom=null;this.followRoom=null;this.onChange();if(room)await this.team.api('/api/listen/'+room.id,'DELETE').catch(()=>{});}
  get url(){return this.hostRoom?.url||'';}
}
