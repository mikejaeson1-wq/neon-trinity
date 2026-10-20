import test from 'node:test';
import assert from 'node:assert/strict';
import {remoteInput,MobileRemote} from '../app/remote-control.mjs';
test('Die Fernbedienung akzeptiert ausschließlich begrenzte Playerbefehle und entfernt fremde Parameter',()=>{
 assert.deepEqual(remoteInput('volume',{value:.5,script:'bad'}),{command:'volume',payload:{value:.5}});assert.throws(()=>remoteInput('shell',{value:'rm'}),/Unzulässiger/);for(const v of [-1,2,NaN])assert.throws(()=>remoteInput('seek',{value:v}),/Playerwert/);assert.throws(()=>remoteInput('queue-play',{id:'../bad'}),/Song/);assert.throws(()=>remoteInput('queue-move',{from:1,to:1.5}),/Reihenfolge/);
});
test('Ein nicht geladenes oder fremdes Gerät kann keine Fernbefehle erhalten',async()=>{
 let writes=0;const r=new MobileRemote({getOwner:()=>({id:'dex'}),client:{from(){writes++;throw new Error('Unexpected write');}}});await assert.rejects(r.send('nix-device','toggle'),/eigenes Studio/);assert.equal(writes,0);
});
