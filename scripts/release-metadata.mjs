import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url),{authenticode}=require('../desktop/recovery.cjs'),pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')),name='Neon-Trinity-Studio-Setup.exe',file=path.resolve('release',name),bytes=await readFile(file),signature=await authenticode(file),binarySignature=await authenticode(path.resolve('release/win-unpacked/Neon Trinity Studio.exe'));
if(process.env.NEON_REQUIRE_SIGNATURE==='true'&&(!signature.signed||!binarySignature.signed||signature.subject!==binarySignature.subject))throw new Error('Die konfigurierte Herausgebersignatur wurde nicht für App und Installer bestätigt.');
const metadata={format:'neon-trinity-release',formatVersion:1,version:pkg.version,stateVersion:1,databaseVersion:1,ownerSettingsVersion:1,rollbackSafe:true,checks:['unit','windows-install','windows-data-preservation','windows-startup'],signed:signature.signed,publisher:signature.subject||'',installer:{name,size:bytes.length,sha512:createHash('sha512').update(bytes).digest('base64')},notes:await readFile(new URL('../docs/RELEASE-NOTES.md',import.meta.url),'utf8')};
await writeFile('release/neon-compat.json',JSON.stringify(metadata,null,2));console.log(JSON.stringify({version:pkg.version,signed:signature.signed,signatureStatus:signature.status,compatible:true}));
