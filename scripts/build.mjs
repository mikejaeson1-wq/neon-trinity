import {mkdir,cp,rm,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import './prepare-source.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const downloads=path.join(root,'downloads');
await rm(path.join(root,'dist'),{recursive:true,force:true});
await mkdir(path.join(root,'dist'),{recursive:true});
await cp(path.join(root,'app'),path.join(root,'dist'),{recursive:true});
try{await stat(downloads);await cp(downloads,path.join(root,'dist/downloads'),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
console.log('Web-Studio bereit: dist/');
