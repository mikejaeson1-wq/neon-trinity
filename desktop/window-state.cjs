const path=require('node:path');
const fs=require('node:fs/promises');
function visibleBounds(saved={},displays=[]){
 const fallback=displays[0]?.workArea||{x:0,y:0,width:1280,height:800};
 const valid=displays.map(d=>d.workArea).filter(Boolean);
 const area=valid.find(a=>Number.isFinite(saved.x)&&Number.isFinite(saved.y)&&saved.x>=a.x&&saved.x<a.x+a.width-80&&saved.y>=a.y&&saved.y<a.y+a.height-40)||fallback;
 const width=Math.min(area.width,Math.max(360,Math.round(Number(saved.width)||460))),height=Math.min(area.height,Math.max(180,Math.round(Number(saved.height)||560)));
 return {width,height,x:Math.max(area.x,Math.min(area.x+area.width-width,Number.isFinite(saved.x)?Math.round(saved.x):area.x+40)),y:Math.max(area.y,Math.min(area.y+area.height-height,Number.isFinite(saved.y)?Math.round(saved.y):area.y+40))};
}
class MiniWindowState{
 constructor(app){this.app=app;this.value={alwaysOnTop:true};this.chain=Promise.resolve();}
 get file(){return path.join(this.app.getPath('userData'),'mini-window.json');}
 async load(){try{const saved=JSON.parse(await fs.readFile(this.file,'utf8'));this.value={...saved,alwaysOnTop:saved.alwaysOnTop!==false};}catch{}return this.value;}
 save(bounds,alwaysOnTop){this.value={...bounds,alwaysOnTop:!!alwaysOnTop};const data=JSON.stringify(this.value);this.chain=this.chain.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(this.file),{recursive:true});await fs.writeFile(this.file+'.tmp',data);await fs.rename(this.file+'.tmp',this.file);});return this.chain;}
}
module.exports={visibleBounds,MiniWindowState};
