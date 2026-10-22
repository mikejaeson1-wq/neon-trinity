import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {verifyRelease} from './verify-release.mjs';
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
const repository='mikejaeson1-wq/neon-trinity',tag='v'+pkg.version;
if(process.env.GITHUB_REPOSITORY!==repository||!process.env.GITHUB_SHA||!process.env.GH_TOKEN)throw new Error('Veröffentlichen ist nur im vorgesehenen GitHub-Workflow erlaubt.');
await import('./prepare-tv-release.mjs');
const release=await verifyRelease('release',pkg.version);
const gh=(...args)=>execFileSync('gh',[...args,'--repo',repository],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
let existing;
try{existing=JSON.parse(gh('release','view',tag,'--json','isDraft'));}catch(error){if(!/release not found|Not Found|404/i.test(String(error.stderr)))throw error;}
if(existing&&!existing.isDraft){console.log('Diese Version ist bereits veröffentlicht. Es werden keine Dateien ersetzt.');process.exit(0);}
if(!existing)gh('release','create',tag,'--draft','--target',process.env.GITHUB_SHA,'--title','Neon Trinity Studio '+pkg.version,'--notes-file','docs/RELEASE-NOTES.md');
gh('release','upload',tag,...release.files.map(file=>'release/'+file),'release/Neon-Trinity-TV.apk','release/neon-tv.json','--clobber');
gh('release','edit',tag,'--draft=false','--latest');
console.log('Windows-Version '+pkg.version+' und Update-Kanal veröffentlicht.');
