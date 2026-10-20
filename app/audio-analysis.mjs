export function analyseBuffer(buffer,bins=512){
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),length=buffer.length,step=4,block=Math.max(step,Math.floor(buffer.sampleRate*.4)),powers=[],wave=new Float32Array(bins);let peak=0;
 for(let from=0;from<length;from+=block){let sum=0,n=0;for(const data of channels)for(let i=from;i<Math.min(length,from+block);i+=step){const x=data[i],a=Math.abs(x);sum+=x*x;n++;peak=Math.max(peak,a);const b=Math.min(bins-1,Math.floor(i/Math.max(1,length)*bins));wave[b]=Math.max(wave[b],a);}if(n&&sum/n>1e-6)powers.push(sum/n);}
 const initial=powers.length?powers.reduce((a,b)=>a+b,0)/powers.length:0,gated=powers.filter(p=>p>=initial*.1),power=gated.length?gated.reduce((a,b)=>a+b,0)/gated.length:0;
 return {duration:buffer.duration,rmsDb:power?10*Math.log10(power):-120,peakDb:peak?20*Math.log10(peak):-120,wave:Array.from(wave,v=>Math.round(v*1000)/1000)};
}
export function normalizationGain(analysis,target=-18){if(!analysis||analysis.rmsDb<=-90)return 0;return Math.max(-12,Math.min(12,Number(target)-analysis.rmsDb,2-analysis.peakDb));}
export class AudioAnalysis{
 constructor({getGraph,getBlob,getOwner}){Object.assign(this,{getGraph,getBlob,getOwner});this.owner=null;this.generation=0;this.cache=new Map();this.pending=new Map();}
 setOwner(id){if(this.owner===id)return;this.owner=id||null;this.generation++;this.cache.clear();this.pending.clear();}
 async get(track){
  const owner=this.owner,gen=this.generation;if(track.visibility==='local'&&track.ownerId!==owner)throw new Error('Dieser Song gehört zu einem anderen Konto.');const key=track.blobId;if(this.cache.has(key)){const entry=this.cache.get(key);this.cache.delete(key);this.cache.set(key,entry);return entry;}if(this.pending.has(key))return this.pending.get(key);
  const task=(async()=>{if(track.duration>900)throw new Error('Für MP3s über 15 Minuten wird die speicherschonende Standardwiedergabe verwendet.');const graph=await this.getGraph();if(!graph?.context?.decodeAudioData)throw new Error('Die Audioanalyse ist hier nicht verfügbar.');const blob=await this.getBlob(key);if(!blob)throw new Error('Die MP3 fehlt.');const bytes=await blob.arrayBuffer(),buffer=await graph.context.decodeAudioData(bytes);
   if(gen!==this.generation||owner!==(this.getOwner()?.id||null))throw new Error('Das Konto wurde gewechselt.');const analysis=analyseBuffer(buffer),entry={buffer,analysis};this.cache.set(key,entry);while(this.cache.size>2)this.cache.delete(this.cache.keys().next().value);return entry;})();
  this.pending.set(key,task);try{return await task;}finally{if(this.pending.get(key)===task)this.pending.delete(key);}
 }
}
