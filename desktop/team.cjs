const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const CLOUD_ORIGIN='https://xyhkpwhfgjamssojjzbu.supabase.co';
// Supabase 2.118 also stores one verifier per OAuth flow, with a random hex ID.
const AUTH_KEY=/^neon-trinity-supabase-auth(?:-user|-code-verifier|-flows-code-verifier|-flow-[a-f0-9]{32}-code-verifier)?$/;
class DesktopCloud{
 constructor({app,safeStorage,shell,port=48731}){Object.assign(this,{app,safeStorage,shell,port});this.config={values:{},discordClientId:''};this.server=null;this.pending=null;this.loginTimer=null;}
 get file(){return path.join(this.app.getPath('userData'),'supabase-session.enc');}
 secure(){return this.safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||this.safeStorage.getSelectedStorageBackend()!=='basic_text');}
 async load(){try{if(this.secure()){const data=JSON.parse(this.safeStorage.decryptString(await fs.readFile(this.file)));if(data&&typeof data.values==='object')this.config=data;}}catch{}}
 async save(){if(!this.secure())throw new Error('Der sichere Windows-Kennwortspeicher ist nicht verfügbar.');await fs.mkdir(this.app.getPath('userData'),{recursive:true});await fs.writeFile(this.file,this.safeStorage.encryptString(JSON.stringify(this.config)),{mode:0o600});}
 validateKey(key){if(typeof key!=='string'||!AUTH_KEY.test(key))throw new Error('Ungültiger Sitzungsschlüssel.');}
 getItem(key){this.validateKey(key);return this.config.values[key]||null;}
 async setItem(key,value){this.validateKey(key);if(typeof value!=='string'||value.length>100000)throw new Error('Ungültige Sitzungsdaten.');this.config.values[key]=value;await this.save();}
 async removeItem(key){this.validateKey(key);delete this.config.values[key];await this.save();}
 async cancelLogin(){clearTimeout(this.loginTimer);if(this.server){this.server.closeAllConnections();await new Promise(resolve=>this.server.close(()=>resolve()));}this.server=null;this.pending=null;}
 async startLogin(){
  await this.cancelLogin();const nonce=crypto.randomBytes(24).toString('hex');this.pending={status:'pending',nonce};
  this.server=http.createServer((req,res)=>{
   const u=new URL(req.url,'http://127.0.0.1:'+this.port);
   if(req.method!=='GET'||req.headers.host!=='127.0.0.1:'+this.port||u.pathname!=='/auth/callback'||u.searchParams.get('nt_state')!==this.pending?.nonce){res.writeHead(404);res.end('Not found');return;}
   const code=u.searchParams.get('code'),failure=u.searchParams.get('error_description');
   if(code&&code.length<4096)this.pending={status:'ready',code};else this.pending={status:'error',error:failure||'Discord hat keinen Anmeldecode zurückgegeben.'};
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer'});
   res.end('<!doctype html><html lang="de"><meta charset="utf-8"><title>Neon Trinity</title><body style="background:#100919;color:#2eff80;font:20px Segoe UI;padding:60px"><h1>Neon Trinity</h1><p>Du kannst zu Neon Trinity Studio zurückkehren.</p><p>Dieses Fenster darfst du schließen.</p></body></html>');
   clearTimeout(this.loginTimer);this.server?.close();this.server=null;
  });
  try{await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(this.port,'127.0.0.1',resolve);});}catch(error){this.server=null;this.pending=null;throw new Error(error.code==='EADDRINUSE'?'Das lokale Anmeldefenster ist bereits geöffnet. Schließe die zweite Studio-Instanz und versuche es erneut.':error.message);}
  this.loginTimer=setTimeout(()=>{this.server?.closeAllConnections();this.server?.close();this.server=null;this.pending={status:'error',error:'Die Discord-Anmeldung ist abgelaufen. Bitte erneut starten.'};},180000);this.loginTimer.unref?.();
  this.callback=`http://127.0.0.1:${this.port}/auth/callback?nt_state=${nonce}`;return this.callback;
 }
 async openLogin(input){const u=new URL(input);if(u.origin!==CLOUD_ORIGIN||u.pathname!=='/auth/v1/authorize'||u.searchParams.get('provider')!=='discord'||u.searchParams.get('redirect_to')!==this.callback||!u.searchParams.get('code_challenge'))throw new Error('Ungültige Discord-Anmeldeadresse.');await this.shell.openExternal(u.href);}
 pollLogin(){if(!this.pending)throw new Error('Bitte die Discord-Anmeldung neu starten.');if(this.pending.status==='error'){const error=this.pending.error;this.pending=null;throw new Error(error);}if(this.pending.status==='ready'){const result=this.pending;this.pending=null;return result;}return {status:'pending'};}
}
module.exports={DesktopCloud};
