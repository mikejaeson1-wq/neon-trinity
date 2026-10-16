import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const guide=fileURLToPath(new URL('../SUPABASE-START.html',import.meta.url));
console.log('Neon Trinity ist bereits mit dem eigenen Supabase-Projekt verbunden.');
console.log('Einmalig Discord aktivieren und drei Konten freischalten. Anleitung: '+guide);
if(process.platform==='win32')spawn('cmd',['/c','start','',guide],{stdio:'ignore',detached:true}).unref();
