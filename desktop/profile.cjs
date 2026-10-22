const fs=require('node:fs');
const path=require('node:path');
const STUDIO_NAME='Neon Trinity Studio';
// Must run before any helper resolves userData or Chromium creates a session.
// 1.0 used this directory. Never move, replace or delete a second profile here.
function configureStudioProfile(app){
 app.setName(STUDIO_NAME);
 const override=app.commandLine?.getSwitchValue?.('user-data-dir');
 const directory=override?path.resolve(override):path.join(app.getPath('appData'),STUDIO_NAME);
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 app.setPath('userData',directory);app.setPath('sessionData',directory);
 return directory;
}
module.exports={configureStudioProfile,STUDIO_NAME};
