const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
const u16=(v,p)=>v.getUint16(p,true),u32=(v,p)=>v.getUint32(p,true);
function safeName(name){return name&&name.length<=512&&!name.includes('\0')&&!/^[\\/]|^[a-z]:/i.test(name)&&!name.replaceAll('\\','/').split('/').some(p=>p==='..');}
export async function inspectZIP(blob){
 if(!blob||blob.size<22||blob.size>1024*1024*1024)throw new Error('Bitte eine ZIP-Datei bis 1 GiB auswählen.');const offset=Math.max(0,blob.size-65557),end=new Uint8Array(await blob.slice(offset).arrayBuffer()),view=new DataView(end.buffer);let at=-1;
 for(let p=end.length-22;p>=0;p--)if(u32(view,p)===0x06054b50&&p+22+u16(view,p+20)===end.length){at=p;break;}
 if(at<0||u16(view,at+4)||u16(view,at+6)||u16(view,at+8)!==u16(view,at+10))throw new Error('Diese ZIP-Datei ist beschädigt oder mehrteilig.');
 const count=u16(view,at+10),size=u32(view,at+12),start=u32(view,at+16);if(count===65535||count>2000||size>4*1024*1024||start+size>offset+at)throw new Error('Diese ZIP ist zu groß oder verwendet ZIP64. Bitte extern entpacken.');
 const directory=new Uint8Array(await blob.slice(start,start+size).arrayBuffer()),d=new DataView(directory.buffer),entries=[];let p=0,total=0;
 for(let i=0;i<count;i++){if(p+46>d.byteLength||u32(d,p)!==0x02014b50)throw new Error('Ungültiges ZIP-Dateiverzeichnis.');
  const flags=u16(d,p+8),method=u16(d,p+10),crc=u32(d,p+16),compressed=u32(d,p+20),size=u32(d,p+24),nl=u16(d,p+28),el=u16(d,p+30),cl=u16(d,p+32),disk=u16(d,p+34),attributes=u32(d,p+38),local=u32(d,p+42);
  if(p+46+nl+el+cl>d.byteLength)throw new Error('Ungültiger ZIP-Dateiname.');const name=new TextDecoder(flags&2048?'utf-8':'windows-1252').decode(directory.subarray(p+46,p+46+nl));p+=46+nl+el+cl;
  if(!safeName(name)||disk||((attributes>>>16)&0xf000)===0xa000)throw new Error('Die ZIP enthält einen unsicheren Pfad oder eine Verknüpfung.');
  if(!/\.mp3$/i.test(name))continue;if(flags&1||![0,8].includes(method))throw new Error('Verschlüsselte oder ungewöhnlich komprimierte MP3s bitte extern entpacken.');
  if(size<1||size>50331648||compressed>50331648||local+30+compressed>start)throw new Error('Eine MP3 in der ZIP ist leer, zu groß oder beschädigt.');total+=size;if(total>512*1024*1024)throw new Error('Bitte die ZIP in kleinere Importe bis 512 MiB aufteilen.');
  entries.push({name:name.replaceAll('\\','/').split('/').at(-1),path:name,method,flags,crc,size,compressed,offset:local});
 }
 if(!entries.length)throw new Error('Die ZIP enthält keine MP3-Dateien.');return {blob,entries,total};
}
async function inflate(bytes,expected){
 if(!globalThis.DecompressionStream)throw new Error('Dieser Browser kann ZIP-Dateien nicht entpacken. Bitte die ZIP im Dateimanager entpacken.');
 let stream;try{stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{throw new Error('Bitte einen aktuellen Browser verwenden oder die ZIP extern entpacken.');}
 const reader=stream.getReader(),parts=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>expected||size>50331648)throw new Error('Die entpackte MP3 überschreitet die angekündigte Dateigröße.');parts.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 const output=new Uint8Array(size);let at=0;for(const part of parts){output.set(part,at);at+=part.byteLength;}return output;
}
export async function extractMP3(zip,index,{inflateRaw=inflate}={}){
 const e=zip.entries[index];if(!e)throw new Error('Ungültige ZIP-Auswahl.');const header=new Uint8Array(await zip.blob.slice(e.offset,e.offset+30).arrayBuffer()),v=new DataView(header.buffer);
 if(v.byteLength!==30||u32(v,0)!==0x04034b50||u16(v,8)!==e.method||u16(v,6)&1)throw new Error('Die MP3-Kopfdaten in der ZIP stimmen nicht.');
 const nameLength=u16(v,26),extraLength=u16(v,28),begin=e.offset+30+nameLength+extraLength;if(begin+e.compressed>zip.blob.size)throw new Error('Die ZIP ist unvollständig.');
 const name=new TextDecoder(e.flags&2048?'utf-8':'windows-1252').decode(await zip.blob.slice(e.offset+30,e.offset+30+nameLength).arrayBuffer());if(name!==e.path)throw new Error('Die ZIP enthält widersprüchliche Dateinamen.');
 const packed=new Uint8Array(await zip.blob.slice(begin,begin+e.compressed).arrayBuffer()),bytes=e.method===0?packed:await inflateRaw(packed,e.size);
 if(bytes.length!==e.size||crc32(bytes)!==e.crc)throw new Error('Eine MP3 in der ZIP hat eine ungültige Prüfsumme.');return new File([bytes],e.name,{type:'audio/mpeg'});
}
