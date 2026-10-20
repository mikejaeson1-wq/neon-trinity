import {validateState} from './core.mjs';
import {backupBlobIds} from './local-library.mjs';
import {clearRestoreStaging,stageRestoreBlob,commitStagedRestore} from './db.mjs';
export async function restoreFolderBackup({manifest,read,getState,setState,getOwner,owner,shared=false,beforeRestore=async()=>{},afterRestore=async()=>{}}){
 if(getOwner()?.id!==owner||manifest.ownerId!==owner)throw new Error('Diese Sicherung gehört zu einem anderen Konto.');const restored=validateState(manifest.state),current=getState(),otherTracks=(current.localTracks||[]).filter(t=>t.ownerId!==owner),otherLists=(current.localPlaylists||[]).filter(p=>p.ownerId!==owner),otherKeys=new Set(otherTracks.flatMap(t=>[t.blobId,t.coverBlobId]).filter(Boolean));
 if([...(restored.localTracks||[]),...(restored.localPlaylists||[]),...(restored.privatePlaylists||[])].some(r=>r.ownerId!==owner)||Object.keys(restored.studioOwners||{}).some(id=>id!==owner))throw new Error('Die Sicherung enthält fremde lokale Daten.');
 if(manifest.blobs.some(b=>otherKeys.has(b.key))||[...restored.tracks,...restored.localTracks].some(t=>otherTracks.some(o=>o.id===t.id)))throw new Error('Die Sicherung kollidiert mit geschützten Daten eines anderen Kontos.');
 const supplied=new Set(manifest.blobs.map(b=>b.key));for(const t of restored.localTracks)for(const key of [t.blobId,t.coverBlobId].filter(Boolean))if(!supplied.has(key))throw new Error('Eine private Datei fehlt in der Sicherung.');
 if(!shared)for(const key of ['tracks','albums','playlists','events','teamAssets','published','_sharedBaseline'])restored[key]=structuredClone(current[key]);
 restored.localTracks.push(...otherTracks);restored.localPlaylists.push(...otherLists);restored.privatePlaylists.push(...(current.privatePlaylists||[]).filter(p=>p.ownerId!==owner));restored.studioOwners={...(current.studioOwners||{}),...(restored.studioOwners||{})};validateState(restored);const wanted=backupBlobIds(restored);
 await beforeRestore();await clearRestoreStaging();try{for(const file of manifest.blobs){if(getOwner()?.id!==owner)throw new Error('Das Konto wurde gewechselt.');if(!wanted.has(file.key))continue;const bytes=await read(file.key);if(bytes.byteLength!==file.size)throw new Error('Eine Sicherungsdatei ist unvollständig.');await stageRestoreBlob(file.key,new Blob([bytes],{type:file.type}));}
  if(getOwner()?.id!==owner)throw new Error('Das Konto wurde gewechselt.');await commitStagedRestore(restored);setState(restored);await afterRestore({shared});return restored;
 }catch(e){await clearRestoreStaging().catch(()=>{});throw e;}
}
