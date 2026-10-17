import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import './write-guides.mjs';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];
async function add(name){const data=await readFile(path.join(root,name));files.push({path:name,content:data.toString('base64')});}
async function walk(name){for(const entry of await readdir(path.join(root,name),{withFileTypes:true})){const relative=`${name}/${entry.name}`;if(relative==='app/source-bundle.json'||entry.name.startsWith('.')||/\.local\./.test(entry.name)||entry.name.includes('credentials')||entry.name.endsWith('.enc'))continue;if(entry.isDirectory())await walk(relative);else if(entry.isFile())await add(relative);}}
for(const folder of ['app','desktop','scripts','tests','supabase','docs'])await walk(folder);
for(const name of ['package.json','.gitignore','README.md','Starten.cmd','Windows-App-bauen.cmd','Team-einrichten.cmd','Teamstart.cmd','SUPABASE-START.html','pnpm-workspace.yaml'])await add(name);
await add('.github/workflows/windows-release.yml');
for(const name of ['pnpm-lock.yaml','package-lock.json'])try{await add(name);}catch(error){if(error.code!=='ENOENT')throw error;}
await writeFile(path.join(root,'app/source-bundle.json'),JSON.stringify({generator:'neon-trinity-source',version:'0.5.0',files}));
console.log(`Quellcodepaket vorbereitet: ${files.length} Dateien`);
