const database = new Promise((resolve, reject) => {
  const request = indexedDB.open('neon-trinity-studio', 1);
  request.onupgradeneeded = () => { request.result.createObjectStore('state'); request.result.createObjectStore('blobs'); };
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

const stagingDatabase=new Promise((resolve,reject)=>{const r=indexedDB.open('neon-trinity-restore-staging',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Die Wiederherstellung konnte nicht vorbereitet werden.'));});
async function staging(mode,callback){const db=await stagingDatabase;return new Promise((resolve,reject)=>{const tx=db.transaction('files',mode);let value;try{value=callback(tx.objectStore('files'));}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>resolve(typeof value==='function'?value():value);tx.onerror=()=>reject(tx.error||new Error('Wiederherstellung vorbereiten fehlgeschlagen.'));});}
export const clearRestoreStaging=()=>staging('readwrite',s=>s.clear());
export const stageRestoreBlob=(key,blob)=>staging('readwrite',s=>s.put(blob,key));
export async function commitStagedRestore(state){
 const files=await staging('readonly',s=>{const keys=s.getAllKeys(),blobs=s.getAll();return ()=>keys.result.map((key,i)=>({key,blob:blobs.result[i]}));});
 await transaction(['state','blobs'],'readwrite',tx=>{tx.objectStore('state').put(state,'main');const blobs=tx.objectStore('blobs');for(const file of files)blobs.put(file.blob,file.key);});
 await clearRestoreStaging();
}
