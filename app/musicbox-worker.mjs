import {AlbumEncoder} from './musicbox-encoder.mjs';
let encoder;
self.onmessage=event=>{const {type,id,left,right,bitrate}=event.data;try{let chunks=[];if(type==='init')encoder=new AlbumEncoder(bitrate);else if(type==='track')chunks=encoder.encode(left,right);else if(type==='finish')chunks=encoder.finish();else throw new Error('Unbekannter Audiobefehl.');self.postMessage({id,chunks},chunks.map(c=>c.buffer));}catch(error){self.postMessage({id,error:error.message});}};
