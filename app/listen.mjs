export {listeningPosition} from './listen-sync.mjs';
import {listeningPosition} from './listen-sync.mjs';
export class ListeningSession{
  constructor({team,getPlayer,onRemote,onChange=()=>{},onError=()=>{},media=null}){Object.assign(this,{team,getPlayer,onRemote,onChange,onError,media});this.hostRoom=null;this.followRoom=null;this.timer=null;this.busy=false;this.generation=0;this.chain=Promise.resolve();this.hosting=null;this.latency=0;}
  player(){const player=this.getPlayer();if(!player.trackId)throw new Error('Starte zuerst einen Song aus deiner Mediathek.');if(player.private&&!this.media)throw new Error('Für diesen lokalen Song ist die Mithörfreigabe nicht verfügbar.');return {...player,position:Math.max(0,player.position+(player.playing?Math.min(.5,this.latency/2000):0))};}
  async prepared(generation){
    for(let attempt=0;attempt<4;attempt++){
      const player=this.player(),prepared=this.media?await this.media.prepare(player):{...player,localAssetId:null};
      if(generation!==this.generation)return null;const latest=this.player();
      if(player.trackId===latest.trackId&&player.private===latest.private)return {...prepared,position:latest.position,playing:latest.playing};
    }
    return null;
  }
  host(){
    if(this.hostRoom)return Promise.resolve(this.hostRoom);if(this.hosting)return this.hosting;
    if(!this.team.active)return Promise.reject(new Error('Melde dich zuerst mit Discord beim Team an.'));
    const task=(async()=>{this.player();const leaving=this.leave(),generation=this.generation;await leaving;if(generation!==this.generation)return null;
      let player;try{player=await this.prepared(generation);}catch(error){if(generation!==this.generation)return null;throw error;}if(!player)return null;
      const start=Date.now(),room=await this.team.api('/api/listen','POST',player);
      if(generation!==this.generation){await this.team.api('/api/listen/'+room.id,'DELETE').catch(()=>{});return null;}
      this.latency=Date.now()-start;this.hostRoom=room;await this.media?.commit(player.localAssetId);if(generation!==this.generation)return null;
      this.timer=setInterval(()=>this.updateHost().catch(this.onError),5000);this.timer.unref?.();this.onChange();if(this.player().trackId!==player.trackId)this.updateHost().catch(this.onError);return room;
    })();
    this.hosting=task;task.finally(()=>{if(this.hosting===task)this.hosting=null;}).catch(()=>{});return task;
  }
  async updateHost(){
    if(!this.hostRoom)return;const generation=this.generation;
    this.chain=this.chain.catch(()=>{}).then(async()=>{if(!this.hostRoom||generation!==this.generation)return;const id=this.hostRoom.id,player=await this.prepared(generation);if(!player||!this.hostRoom||generation!==this.generation)return;const start=Date.now();await this.team.api('/api/listen/'+id,'PATCH',player);if(generation!==this.generation)return;await this.media?.commit(player.localAssetId);const elapsed=Date.now()-start;if(elapsed<4000)this.latency=this.latency*.7+elapsed*.3;});return this.chain.catch(async error=>{if(error.status===410&&generation===this.generation)await this.leave();throw error;});
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
  async leave(){const room=this.hostRoom;this.generation++;clearInterval(this.timer);this.timer=null;this.hostRoom=null;this.followRoom=null;const cleanup=this.media?.clear();this.onChange();if(room)await this.team.api('/api/listen/'+room.id,'DELETE').catch(()=>{});await cleanup;}
  get url(){return this.hostRoom?.url||'';}
}
