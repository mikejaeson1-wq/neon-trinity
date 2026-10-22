const path=require('node:path');
const fs=require('node:fs/promises');
function snapBounds(bounds,area,threshold=18){const b={...bounds};for(const [key,span]of [['x','width'],['y','height']]){const near=area[key],far=area[key]+area[span]-b[span];if(Math.abs(b[key]-near)<=threshold)b[key]=near;else if(Math.abs(b[key]-far)<=threshold)b[key]=far;}return b;}
class DesktopQoL{
 constructor({app,shortcuts,authenticate,send,getPlayer}){Object.assign(this,{app,shortcuts,authenticate,send,getPlayer});this.enabled=false;this.snap=false;this.registered=[];}
 configure(input,owner){this.unregister();if(owner)this.authenticate(owner);if(input.globalShortcuts&&!owner)throw new Error('Bitte zuerst mit Discord anmelden.');this.snap=input.snap===true;
  if(input.globalShortcuts){const keys=[['Control+Alt+Space','toggle'],['Control+Alt+Right','next'],['Control+Alt+Left','previous'],['Control+Alt+Up','volumeUp'],['Control+Alt+Down','volumeDown']];try{for(const [key,command]of keys){if(!this.shortcuts.register(key,()=>{try{this.authenticate(owner);let message={command};if(command.startsWith('volume'))message={command:'volume',value:Math.max(0,Math.min(1,(this.getPlayer().volume??.8)+(command==='volumeUp'?.02:-.02)))};this.send(message);}catch{this.unregister();}}))throw new Error('Das globale Kürzel '+key+' ist bereits belegt.');this.registered.push(key);}}catch(e){this.unregister();throw e;}}
  return {globalShortcuts:!!this.registered.length,snap:this.snap};
 }
 unregister(){for(const key of this.registered)this.shortcuts.unregister(key);this.registered=[];}
}
module.exports={DesktopQoL,snapBounds};
