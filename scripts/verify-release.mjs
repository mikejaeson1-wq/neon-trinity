import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const yaml=createRequire(require.resolve('electron-updater'))('js-yaml');
export async function verifyRelease(directory,expectedVersion){
  const manifest=yaml.load(await readFile(path.join(directory,'latest.yml'),'utf8'));
  if(manifest.version!==expectedVersion)throw new Error('Update-Version und App-Version stimmen nicht überein.');
  const file=manifest.files?.find(x=>x.url==='Neon-Trinity-Studio-Setup.exe');
  if(!file||!file.sha512)throw new Error('Der Windows-Installer fehlt im Update-Kanal.');
  const installer=await readFile(path.join(directory,file.url));
  if(installer[0]!==0x4d||installer[1]!==0x5a)throw new Error('Der Installer ist keine Windows-EXE.');
  if(installer.length!==file.size||createHash('sha512').update(installer).digest('base64')!==file.sha512)throw new Error('Die Prüfsumme des Installers ist ungültig.');
  if((await stat(path.join(directory,file.url+'.blockmap'))).size===0)throw new Error('Die Update-Blockmap fehlt.');
  const files=[file.url,file.url+'.blockmap','latest.yml'];try{const m=JSON.parse(await readFile(path.join(directory,'neon-compat.json'),'utf8'));if(m.version!==manifest.version||m.installer.sha512!==file.sha512||m.installer.size!==file.size)throw new Error('Kompatibilitätsdatei und Installer stimmen nicht überein.');files.push('neon-compat.json');}catch(e){if(e.code!=='ENOENT')throw e;}return {version:manifest.version,bytes:installer.length,files};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  console.log(JSON.stringify(await verifyRelease(path.resolve(process.argv[2]||'release'),pkg.version)));
}
