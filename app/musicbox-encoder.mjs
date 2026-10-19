import {Mp3Encoder} from './vendor/mp3-encoder.mjs';
export const MAX_MUSICBOX_BYTES=48*1024*1024;
export function albumBitrate(seconds){const budget=Math.floor(MAX_MUSICBOX_BYTES*8/Math.max(1,seconds)/1000*.94);const value=[128,112,96,80,64,48,32].find(rate=>rate<=budget);if(!value)throw new Error('Dieses Album ist für eine einzelne Musikbox-MP3 zu lang. Bitte in kleinere Alben aufteilen.');return value;}
export class AlbumEncoder{
 constructor(bitrate){if(![128,112,96,80,64,48,32].includes(bitrate))throw new Error('Ungültige MP3-Qualität.');this.encoder=new Mp3Encoder(2,44100,bitrate);this.bytes=0;this.finished=false;}
 encode(left,right,start=0,end=left.length){if(this.finished)throw new Error('MP3 ist bereits abgeschlossen.');const output=[];for(let offset=start;offset<end;offset+=1152){const size=Math.min(1152,end-offset),l=new Int16Array(size),r=new Int16Array(size);for(let i=0;i<size;i++){const a=Math.max(-1,Math.min(1,left[offset+i]||0)),b=Math.max(-1,Math.min(1,(right||left)[offset+i]||0));l[i]=a<0?a*32768:a*32767;r[i]=b<0?b*32768:b*32767;}const bytes=this.encoder.encodeBuffer(l,r);if(bytes.length)output.push(this.copy(bytes));}return output;}
 copy(bytes){this.bytes+=bytes.length;if(this.bytes>MAX_MUSICBOX_BYTES)throw new Error('Die Album-MP3 überschreitet 48 MiB. Bitte das Album in kleinere Teile aufteilen.');return Uint8Array.from(bytes);}
 finish(){if(this.finished)throw new Error('MP3 ist bereits abgeschlossen.');this.finished=true;const bytes=this.encoder.flush();return bytes.length?[this.copy(bytes)]:[];}
}
