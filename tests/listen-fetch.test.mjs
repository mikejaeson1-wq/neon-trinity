import test from 'node:test';
import assert from 'node:assert/strict';
import {ListeningAPI} from '../app/listen-access.mjs';
test('Mithören und Statusprüfung binden den Standard-Fetch an den Browser statt an den API-Client',async()=>{
 const previous=globalThis.fetch,calls=[];
 globalThis.fetch=function(url,options){if(this!==globalThis)throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");calls.push({url,options});return Promise.resolve(new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json'}}));};
 try{const api=new ListeningAPI({client:{auth:{getSession:async()=>({data:{session:{user:{id:'dex'},access_token:'test'}}})}}});await api.request('/listen','POST',{trackId:'song'});await api.request('/listen-preferences');assert.equal(calls.length,2);assert.equal(calls[0].options.headers.Authorization,'Bearer test');}
 finally{globalThis.fetch=previous;}
});
