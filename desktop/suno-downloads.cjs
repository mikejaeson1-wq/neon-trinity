const fs=require('node:fs/promises');
const {constants}=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const MAX_MP3=48*1024*1024;
class SunoDownloads{
 constructor({app,dialog,isOwner,now=Date.now}){Object.assign(this,{app,dialog,isOwner,now});this.settings={};this.files=new Map();this.revisions=new Map();this.writes=Promise.resolve();}
 get configPath(){return path.join(this.app.getPath('userData'),'suno-download-folders.json');}
 guard(owner){if(!owner||!this.isOwner(owner))throw new Error('Bitte mit deinem Discord-Konto im Studio anmelden.');}
 async load(){try{const data=JSON.parse(await fs.readFile(this.configPath,'utf8'));if(data&&data.version===1&&data.owners&&typeof data.owners==='object')this.settings=data.owners;}catch{}}
 async save(){const body=JSON.stringify({version:1,owners:this.settings});this.writes=this.writes.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(this.configPath),{recursive:true});await fs.writeFile(this.configPath+'.tmp',body,{mode:0o600});await fs.rename(this.configPath+'.tmp',this.configPath);});await this.writes;}
 status(owner){this.guard(owner);const value=this.settings[owner]||{};return {folder:typeof value.folder==='string'?value.folder:'',auto:value.auto===true};}
 async choose(owner){this.guard(owner);const revision=(this.revisions.get(owner)||0)+1;this.revisions.set(owner,revision);const guard=()=>{this.guard(owner);if(this.revisions.get(owner)!==revision)throw new Error('Der Download-Ordner wurde inzwischen geändert.');};const result=await this.dialog.showOpenDialog({title:'Ordner für deine Suno-MP3-Downloads wählen',defaultPath:this.settings[owner]?.folder||this.app.getPath('downloads'),properties:['openDirectory','createDirectory']});guard();if(result.canceled||result.filePaths.length!==1)return this.status(owner);const folder=await fs.realpath(result.filePaths[0]);guard();if(!(await fs.stat(folder)).isDirectory())throw new Error('Bitte einen Download-Ordner auswählen.');guard();this.settings[owner]={folder,auto:false};this.files.delete(owner);await this.save();guard();return this.status(owner);}
 async configure(owner,auto){this.guard(owner);if(typeof auto!=='boolean'||!this.settings[owner]?.folder)throw new Error('Bitte zuerst den Suno-Download-Ordner wählen.');this.settings[owner].auto=auto;await this.save();this.guard(owner);return this.status(owner);}
 async forget(owner){this.guard(owner);this.revisions.set(owner,(this.revisions.get(owner)||0)+1);delete this.settings[owner];this.files.delete(owner);await this.save();this.guard(owner);return this.status(owner);}
 async scan(owner){
  const {folder}=this.status(owner);if(!folder)return {entries:[],truncated:false};const revision=this.revisions.get(owner),guard=()=>{this.guard(owner);if(this.settings[owner]?.folder!==folder||this.revisions.get(owner)!==revision)throw new Error('Der Download-Ordner wurde inzwischen geändert.');};
  let names;try{names=await fs.readdir(folder,{withFileTypes:true});}catch{throw new Error('Der gewählte Download-Ordner ist nicht erreichbar. Bitte erneut wählen.');}guard();
  const candidates=names.filter(f=>f.isFile()&&/\.mp3$/i.test(f.name)).sort((a,b)=>a.name.localeCompare(b.name));const entries=[],index=new Map();
  for(const entry of candidates.slice(0,500)){
   const file=path.join(folder,entry.name);let s;try{s=await fs.lstat(file);}catch{continue;}guard();
   if(!s.isFile()||s.isSymbolicLink()||s.size<3||s.size>MAX_MP3)continue;
   const id=createHash('sha256').update(folder+'\0'+entry.name+'\0'+s.size+'\0'+s.mtimeMs).digest('hex');
   index.set(id,{file,size:s.size,mtimeMs:s.mtimeMs,ino:s.ino,dev:s.dev,revision});entries.push({id,name:entry.name,size:s.size,lastModified:s.mtimeMs,ready:s.mtimeMs<=this.now()-2000});
  }
  guard();this.files.set(owner,index);return {entries,truncated:candidates.length>500};
 }
 async read(owner,id){
  this.guard(owner);const entry=typeof id==='string'&&this.files.get(owner)?.get(id);if(!entry)throw new Error('Bitte die Downloads erneut prüfen.');
  const guardFile=()=>{this.guard(owner);if(this.files.get(owner)?.get(id)!==entry||this.revisions.get(owner)!==entry.revision)throw new Error('Der Ordnerimport wurde geändert. Bitte die Downloads erneut prüfen.');};
  const before=await fs.lstat(entry.file);guardFile();
  if(!before.isFile()||before.isSymbolicLink()||before.size!==entry.size||before.mtimeMs!==entry.mtimeMs||before.mtimeMs>this.now()-2000)throw new Error('Der Download ist noch nicht fertig. Bitte kurz warten und erneut prüfen.');
  const handle=await fs.open(entry.file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
  try{
   const stat=await handle.stat();guardFile();if(!stat.isFile()||stat.size!==entry.size||stat.ino!==entry.ino||stat.dev!==entry.dev||stat.mtimeMs!==entry.mtimeMs)throw new Error('Die Download-Datei wurde geändert. Bitte erneut prüfen.');
   const bytes=Buffer.alloc(stat.size);let offset=0;
   while(offset<bytes.length){const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);guardFile();if(!bytesRead)throw new Error('Die MP3 ist noch nicht vollständig.');offset+=bytesRead;}
   const after=await handle.stat();guardFile();if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw new Error('Die MP3 wird noch geschrieben. Bitte erneut versuchen.');
   if(bytes.subarray(0,3).toString()!=='ID3'&&!(bytes[0]===255&&(bytes[1]&224)===224&&(bytes[1]&6)!==0))throw new Error('Die Datei enthält keine erkennbare MP3.');
   return {name:path.basename(entry.file),bytes:new Uint8Array(bytes),lastModified:stat.mtimeMs};
  }finally{await handle.close();}
 }
}
module.exports={SunoDownloads,MAX_MP3};
