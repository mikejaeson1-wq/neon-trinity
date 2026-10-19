import {albumBitrate,AlbumEncoder} from './musicbox-encoder.mjs';
const aborted=()=>new DOMException('Vorgang abgebrochen.','AbortError');
function check(signal){if(signal?.aborted)throw aborted();}
function localEncoder(bitrate,signal){const encoder=new AlbumEncoder(bitrate);return {async track(left,right){const chunks=[];for(let offset=0;offset<left.length;offset+=1152*100){check(signal);chunks.push(...encoder.encode(left,right,offset,Math.min(left.length,offset+1152*100)));await new Promise(resolve=>setTimeout(resolve,0));}return chunks;},async finish(){check(signal);return encoder.finish();},close(){}};}
async function workerEncoder(bitrate,signal){
 const worker=new Worker(new URL('./musicbox-worker.mjs',import.meta.url),{type:'module'});let sequence=0;const waiting=new Map();
 function rejectAll(error){for(const job of waiting.values()){clearTimeout(job.timer);job.reject(error);}waiting.clear();}
 const abort=()=>{rejectAll(aborted());worker.terminate();};signal?.addEventListener('abort',abort,{once:true});
 worker.onmessage=event=>{const job=waiting.get(event.data.id);if(!job)return;waiting.delete(event.data.id);clearTimeout(job.timer);event.data.error?job.reject(new Error(event.data.error)):job.resolve(event.data.chunks||[]);};
 worker.onerror=event=>{event.preventDefault?.();rejectAll(new Error('Der Audio-Prozess konnte nicht gestartet werden.'));};
 const call=(type,extra={},transfer=[])=>{check(signal);return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{waiting.delete(id);reject(new Error('Der Audio-Prozess antwortet nicht.'));},type==='init'?15000:180000);waiting.set(id,{resolve,reject,timer});try{worker.postMessage({type,id,...extra},transfer);}catch(e){clearTimeout(timer);waiting.delete(id);reject(e);}});};
 const close=()=>{signal?.removeEventListener('abort',abort);rejectAll(aborted());worker.terminate();};
 try{await call('init',{bitrate});}catch(e){close();throw e;}
 return {track:(left,right)=>call('track',{left,right},right===left?[left.buffer]:[left.buffer,right.buffer]),finish:()=>call('finish'),close};
}
export async function buildAlbumMP3({tracks,getBlob,signal,onProgress=()=>{},decode}={}){
 if(!tracks?.length||tracks.length>500)throw new Error('Bitte ein Album mit 1 bis 500 Band-Songs wählen.');check(signal);
 const bitrate=albumBitrate(tracks.reduce((sum,t)=>sum+Math.max(0,Number(t.duration)||0),0));let encoder;
 try{if(typeof Worker==='function')encoder=await workerEncoder(bitrate,signal);}catch(e){check(signal);}
 if(!encoder)encoder=localEncoder(bitrate,signal);
 const parts=[];
 try{for(let index=0;index<tracks.length;index++){
   check(signal);const track=tracks[index];onProgress({value:index/tracks.length,text:`Album-MP3 · ${index+1}/${tracks.length}: ${track.title}`});const blob=await getBlob(track.blobId);check(signal);if(!blob)throw new Error('Eine Audiodatei fehlt: '+track.title);
   const context=decode?null:new OfflineAudioContext(2,1,44100);const buffer=await (decode?decode(await blob.arrayBuffer()):context.decodeAudioData(await blob.arrayBuffer()));check(signal);
   if(buffer.sampleRate!==44100)throw new Error('Die Audiodatei konnte nicht in 44,1 kHz umgewandelt werden.');
   const left=buffer.getChannelData(0).slice(),right=buffer.numberOfChannels>1?buffer.getChannelData(1).slice():left;
   parts.push(...await encoder.track(left,right));check(signal);
 }parts.push(...await encoder.finish());const blob=new Blob(parts,{type:'audio/mpeg'});if(!blob.size)throw new Error('Die Album-MP3 konnte nicht erstellt werden.');onProgress({value:1,text:'Album-MP3 fertig. Wird bereitgestellt …'});return blob;
 }finally{encoder.close();}
}
