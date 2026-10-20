import {validateRecord} from './shared.mjs';
export async function copyLocalToBand({state,owner,trackId,getOwner,getBlob,putBlob,deleteBlob,newId=()=>crypto.randomUUID()}){
 const guard=()=>{if(!owner||getOwner()?.id!==owner)throw new Error('Das Discord-Konto wurde gewechselt.');};guard();
 const source=state.localTracks.find(t=>t.id===trackId&&t.ownerId===owner);if(!source)throw new Error('Dieser private Song gehört nicht zu deinem Konto.');
 const old=source.digest&&state.tracks.find(t=>t.digest===source.digest);if(old)return {track:old,existing:true};
 const original=structuredClone(source),created=[];
 try{const blob=await getBlob(original.blobId);guard();if(!blob?.size)throw new Error('Die private MP3 fehlt auf diesem Gerät.');const blobId=newId();await putBlob(blobId,blob);created.push(blobId);guard();
  let coverBlobId;if(original.coverBlobId){const cover=await getBlob(original.coverBlobId);guard();if(cover){coverBlobId=newId();await putBlob(coverBlobId,cover);created.push(coverBlobId);guard();}}
  const duplicate=original.digest&&state.tracks.find(t=>t.digest===original.digest);if(duplicate){for(const key of created)await deleteBlob(key);return {track:duplicate,existing:true};}
  const track=validateRecord('tracks',{...original,id:newId(),blobId,coverBlobId,ownerId:undefined,visibility:undefined,artist:original.artist==='Unbekannter Interpret'?'Neon Trinity':original.artist,voices:original.voices==='Privat · lokal'?'Dex · Nix · Jax':original.voices,addedAt:new Date().toISOString()});
  guard();if(!state.localTracks.some(t=>t.id===trackId&&t.ownerId===owner))throw new Error('Der private Song ist nicht mehr vorhanden.');state.tracks.push(track);return {track,existing:false};
 }catch(e){for(const key of created)await deleteBlob(key);throw e;}
}
