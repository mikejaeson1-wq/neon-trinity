// The HTML element handles streams; decoded MP3s use the Web Audio clock.
export class StudioAudio extends EventTarget{
 constructor(element,{getGraph,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id)}={}){
  super();Object.assign(this,{element,getGraph,schedule,cancel});this.pcm=false;this._volume=Number.isFinite(element.volume)?element.volume:1;this._rate=1;this._position=0;this._paused=true;this.nodes=new Set();this.generation=0;this.next=null;this.timer=null;this.gainDb=0;
  for(const type of ['play','pause','ended','timeupdate','seeked','loadedmetadata','error','volumechange'])element.addEventListener(type,()=>{if(!this.pcm)this.dispatchEvent(new Event(type));});
 }
 get src(){return this.pcm?this._src:this.element.src;}set src(value){this.useElement(value);}
 get paused(){return this.pcm?this._paused:this.element.paused;}
 get duration(){return this.pcm?this.buffer?.duration||0:this.element.duration;}
 get currentTime(){return this.pcm?Math.max(0,Math.min(this.duration,this._position+(this._paused?0:(this.context.currentTime-this.anchor)*this._rate))):this.element.currentTime||0;}
 set currentTime(value){if(!this.pcm){this.element.currentTime=value;return;}const playing=!this._paused;this._position=Math.max(0,Math.min(this.duration,Number(value)||0));this.stopNodes();this._paused=!playing;if(playing)this.startNode();this.dispatchEvent(new Event('seeked'));}
 get volume(){return this.pcm?this._volume:this.element.volume;}set volume(value){this._volume=Math.max(0,Math.min(1,Number(value)||0));this.element.volume=this._volume;if(this.master)this.master.gain.setTargetAtTime?.(this._volume,this.context.currentTime,.015);this.dispatchEvent(new Event('volumechange'));}
 get playbackRate(){return this.pcm?this._rate:this.element.playbackRate;}set playbackRate(value){if(!this.pcm){this.element.playbackRate=value;return;}const at=this.currentTime,playing=!this._paused;this._rate=Math.max(.5,Math.min(2,Number(value)||1));this._position=at;this.stopNodes();this._paused=!playing;if(playing)this.startNode();}
 async loadDecoded(url,buffer,{gainDb=0}={}){
  this._paused=true;this.stopNodes();this.pcm=true;this.element.pause();const generation=this.generation,graph=await this.getGraph();if(generation!==this.generation)return false;if(!graph?.context)throw new Error('Web Audio ist nicht verfügbar.');this.context=graph.context;this.input=graph.preamp||graph.analyser;this.master=this.context.createGain();this.master.gain.value=this._volume;this.master.connect(this.input);this._src=url;this.buffer=buffer;this.gainDb=gainDb;this._position=0;this._rate=1;this._paused=true;this.dispatchEvent(new Event('loadedmetadata'));return true;
 }
 node(buffer,when,offset,gainDb){
  const node=this.context.createBufferSource(),gain=this.context.createGain();node.buffer=buffer;node.playbackRate.value=this._rate;gain.gain.value=10**(gainDb/20);node.connect(gain);gain.connect(this.master);const entry={node,gain,buffer,gainDb,when,offset};this.nodes.add(entry);node.onended=()=>{this.nodes.delete(entry);node.disconnect();gain.disconnect();if(this.active===entry&&!this.next&&!this._paused){this._position=this.duration;this._paused=true;this.clearTimer();this.dispatchEvent(new Event('ended'));}};node.start(when,offset);return entry;
 }
 startNode(){if(!this.master){this.master=this.context.createGain();this.master.gain.value=this._volume;this.master.connect(this.input);}this.anchor=this.context.currentTime;this.active=this.node(this.buffer,this.anchor,this._position,this.gainDb);this.ensureTimer();}
 play(){if(!this.pcm)return this.element.play();if(!this._paused)return Promise.resolve();if(this.playTask)return this.playTask;const generation=this.generation,task=(async()=>{await this.context.resume();if(generation!==this.generation||!this.pcm)return;if(this._position>=this.duration)this._position=0;this._paused=false;this.startNode();this.dispatchEvent(new Event('play'));})();this.playTask=task;task.finally(()=>{if(this.playTask===task)this.playTask=null;}).catch(()=>{});return task;}
 pause(){if(!this.pcm)return this.element.pause();if(this._paused){if(this.playTask)this.stopNodes();return;}this._position=this.currentTime;this._paused=true;this.stopNodes();this.dispatchEvent(new Event('pause'));}
 scheduleNext({id,url,buffer,gainDb=0},seconds=0){
  if(!this.pcm||this._paused||!this.active)return false;if(this.next?.id===id)return true;this.cancelNext();const fade=Math.max(0,Math.min(12,seconds,this.duration/2,buffer.duration/2,Math.max(0,(this.duration-this.currentTime)/this._rate-.01))),when=this.context.currentTime+Math.max(.01,(this.duration-this.currentTime)/this._rate-fade),entry=this.node(buffer,when,0,gainDb),level=10**(gainDb/20);
  if(fade){entry.gain.gain.setValueAtTime(0,when);entry.gain.gain.linearRampToValueAtTime(level,when+fade);this.active.gain.gain.setValueAtTime(10**(this.gainDb/20),when);this.active.gain.gain.linearRampToValueAtTime(0,when+fade);}
  this.next={id,url,buffer,gainDb,entry,when,fade};this.ensureTimer();return true;
 }
 cancelNext(){if(!this.next)return;try{this.next.entry.node.stop();}catch{}this.nodes.delete(this.next.entry);this.next=null;if(this.active){this.active.gain.gain.cancelScheduledValues(this.context.currentTime);this.active.gain.gain.setValueAtTime(10**(this.gainDb/20),this.context.currentTime);}}
 pump(){
  if(!this.pcm||this._paused)return;if(this.next&&this.context.currentTime>=this.next.when){const n=this.next;this.next=null;this.active=n.entry;this.buffer=n.buffer;this._src=n.url;this.gainDb=n.gainDb;this.anchor=n.when;this._position=0;const event=new Event('trackadvance');event.detail={id:n.id};this.dispatchEvent(event);this.dispatchEvent(new Event('loadedmetadata'));this.dispatchEvent(new Event('play'));}
  this.dispatchEvent(new Event('timeupdate'));
 }
 ensureTimer(){if(this.timer!=null)return;const run=()=>{this.timer=null;this.pump();if(this.pcm&&!this._paused)this.ensureTimer();};this.timer=this.schedule(run,60);this.timer?.unref?.();}
 clearTimer(){if(this.timer!=null)this.cancel(this.timer);this.timer=null;}
 stopNodes(){this.generation++;this.playTask=null;this.clearTimer();this.next=null;const nodes=[...this.nodes];this.nodes.clear();this.active=null;for(const e of nodes){try{e.node.onended=null;e.node.stop();e.node.disconnect();e.gain.disconnect();}catch{}}if(this.master){try{this.master.disconnect();}catch{}this.master=null;}}
 useElement(value){this._paused=true;this.stopNodes();this.pcm=false;this.buffer=null;this._src='';this.element.src=value;this.element.volume=this._volume;}
 removeAttribute(name){if(name==='src'){this._paused=true;this.stopNodes();this.pcm=false;this.buffer=null;}this.element.removeAttribute(name);}
 load(){this.element.load();}
}
