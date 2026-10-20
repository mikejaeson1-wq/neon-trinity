// A live session stages one selected MP3, never a playlist, cover or catalog.
export class ListeningMedia {
 constructor({backend,getOwner,getTrack,getBlob}){Object.assign(this,{backend,getOwner,getTrack,getBlob});this.entries=new Map();this.generation=0;}
 owner(trackId){const owner=this.getOwner()?.id,track=this.getTrack(trackId);if(!owner||track?.ownerId!==owner||track.visibility!=='local')throw new Error('Dieser lokale Song gehört nicht zum angemeldeten Konto.');return {owner,track};}
 async prepare(player){
  if(!player.private)return {...player,localAssetId:null};
  const {owner,track}=this.owner(player.trackId),generation=this.generation,key=JSON.stringify([owner,track.id,track.blobId,track.title,track.artist,track.duration]);
  let entry=this.entries.get(key);
  if(!entry){
   const blob=await this.getBlob(track.blobId);if(generation!==this.generation||this.owner(track.id).owner!==owner)throw new Error('Die Hörsession oder das Konto wurde gewechselt.');
   if(!blob||blob.type!=='audio/mpeg'||!blob.size||blob.size>48*1024*1024)throw new Error('Die lokale MP3 fehlt oder ist größer als 48 MiB.');
   const reserved=await this.backend.publicRequest('/listen-media','POST',{trackId:track.id,title:track.title,artist:track.artist||'Unbekannt',duration:track.duration,byteSize:blob.size});
   try{
    if(generation!==this.generation||this.owner(track.id).owner!==owner)throw new Error('Die Hörsession oder das Konto wurde gewechselt.');
    const result=await this.backend.client.storage.from('nt-listen').upload(reserved.path,blob,{contentType:'audio/mpeg',upsert:false,cacheControl:'0'});
    if(result.error)throw new Error(result.error.message||'Die lokale MP3 konnte nicht für das Mithören bereitgestellt werden.');
    const current=this.owner(track.id);if(generation!==this.generation||current.owner!==owner||current.track.blobId!==track.blobId)throw new Error('Die Hörsession oder das Konto wurde gewechselt.');
    entry={id:reserved.id,key};this.entries.set(key,entry);
   }catch(error){await this.remove(reserved.id);throw error;}
  }
  return {...player,localAssetId:entry.id};
 }
 async remove(id){await this.backend.publicRequest('/listen-media/'+id,'DELETE').catch(()=>{});}
 async commit(id){const removed=[...this.entries.values()].filter(e=>e.id!==id);for(const entry of removed)this.entries.delete(entry.key);await Promise.all(removed.map(e=>this.remove(e.id)));}
 async clear(){this.generation++;await this.commit(null);}
}
