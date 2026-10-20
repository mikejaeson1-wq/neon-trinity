import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {inspectZIP,extractMP3,crc32} from '../app/zip-import.mjs';
function zip(name='song.mp3',content=Buffer.from('ID3 music'),method=8){
 const n=Buffer.from(name),packed=method?deflateRawSync(content):content,h=Buffer.alloc(30),c=Buffer.alloc(46),e=Buffer.alloc(22);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(method,8);h.writeUInt32LE(crc32(content),14);h.writeUInt32LE(packed.length,18);h.writeUInt32LE(content.length,22);h.writeUInt16LE(n.length,26);
 c.writeUInt32LE(0x02014b50);c.writeUInt16LE(method,10);c.writeUInt32LE(crc32(content),16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(content.length,24);c.writeUInt16LE(n.length,28);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(1,8);e.writeUInt16LE(1,10);e.writeUInt32LE(c.length+n.length,12);e.writeUInt32LE(h.length+n.length+packed.length,16);return Buffer.concat([h,n,packed,c,n,e]);
}
test('Suno-ZIPs werden ohne Dateisystemzugriff geprüft und MP3s mit CRC-Kontrolle entpackt',async()=>{for(const method of [0,8]){const z=await inspectZIP(new Blob([zip('My Song.mp3',Buffer.from('ID3 original'),method)]));assert.equal(z.entries.length,1);const f=await extractMP3(z,0,{inflateRaw:async b=>inflateRawSync(b)});assert.equal(f.name,'My Song.mp3');assert.equal(await f.text(),'ID3 original');}});
test('Pfadtraversierung, fehlende MP3s und veränderte Audiodaten werden zurückgewiesen',async()=>{await assert.rejects(inspectZIP(new Blob([zip('../bad.mp3')])),/unsicheren Pfad/);await assert.rejects(inspectZIP(new Blob([zip('not-a-song.txt')])),/keine MP3/);const data=zip('song.mp3',Buffer.from('ID3 music'),0);data[30+'song.mp3'.length]=0;const z=await inspectZIP(new Blob([data]));await assert.rejects(extractMP3(z,0),/Prüfsumme/);});
