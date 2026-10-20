const database = new Promise((resolve, reject) => {
  const request = indexedDB.open('neon-trinity-studio', 2);
  request.onupgradeneeded = () => { for(const name of ['state','blobs','restore-staging'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(new Error('Die lokale Mediathek konnte nicht geöffnet werden. Bitte Speicherzugriff erlauben.'));
});
async function transaction(stores, mode, fn) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode); let value;
    try { value = fn(tx); } catch(e) { tx.abort(); reject(e); return; }
    tx.oncomplete = () => resolve(typeof value === 'function' ? value() : value);
    tx.onerror = () => reject(tx.error || new Error('Speichern fehlgeschlagen. Ist genügend Speicher frei?'));
    tx.onabort = () => reject(tx.error || new Error('Speichern wurde abgebrochen.'));
  });
}
export const loadState = () => transaction(['state'], 'readonly', tx=> {const r=tx.objectStore('state').get('main');return ()=>r.result;});
export const saveState = state => transaction(['state'], 'readwrite', tx=>tx.objectStore('state').put(state,'main'));
export const getBlob = key => transaction(['blobs'],'readonly',tx=>{const r=tx.objectStore('blobs').get(key);return ()=>r.result;});
export const putBlob = (key,blob) => transaction(['blobs'],'readwrite',tx=>tx.objectStore('blobs').put(blob,key));
export const deleteBlob = key => transaction(['blobs'],'readwrite',tx=>tx.objectStore('blobs').delete(key));
export const allBlobs = () => transaction(['blobs'],'readonly',tx=>{const r=tx.objectStore('blobs').getAll(),k=tx.objectStore('blobs').getAllKeys();return ()=>k.result.map((key,i)=>({key,blob:r.result[i]}));});
export const replaceDatabase = (state,blobs) => transaction(['state','blobs'],'readwrite',tx=>{tx.objectStore('state').put(state,'main');const b=tx.objectStore('blobs');b.clear();for(const item of blobs)b.put(item.blob,item.key);});

export const clearRestoreStaging=()=>transaction(['restore-staging'],'readwrite',tx=>tx.objectStore('restore-staging').clear());
export const stageRestoreBlob=(key,blob)=>transaction(['restore-staging'],'readwrite',tx=>tx.objectStore('restore-staging').put(blob,key));
export const commitStagedRestore=state=>transaction(['state','blobs','restore-staging'],'readwrite',tx=>{
 const staging=tx.objectStore('restore-staging'),target=tx.objectStore('blobs');const cursor=staging.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){target.put(c.value,c.key);c.continue();}else staging.clear();};tx.objectStore('state').put(state,'main');
});
