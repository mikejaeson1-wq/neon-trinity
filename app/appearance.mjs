export const HOVER_EFFECTS={glow:'Neon-Leuchten',lift:'Schweben',outline:'Kontur',tilt:'Leicht kippen',none:'Ohne Effekt'};
export const VISUALIZER_THEMES={
  trinity:{name:'Trinity Pulse',color1:'#2eff80',color2:'#bd33ff',background:'#0c0913'},
  aurora:{name:'Aurora',color1:'#52f0b3',color2:'#69b5ff',background:'#061b20'},
  fire:{name:'Solar Flare',color1:'#ffbe50',color2:'#ff527b',background:'#201019'},
  ice:{name:'Glacier',color1:'#d5f5ff',color2:'#668aff',background:'#071426'},
  mono:{name:'Mono',color1:'#ffffff',color2:'#828c9c',background:'#111318'}
};
export const VISUALIZER_MODES={bars:'Spektrum',mirror:'Spiegel',orbit:'Orbit',wave:'Wellenform'};
const color=(value,fallback)=>/^#[a-f0-9]{6}$/i.test(value||'')?value:fallback;
const bounded=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
export function normalizeAppearance(input={}){
  const v=input?.visualizer||{},base=VISUALIZER_THEMES.trinity;
  return {hover:HOVER_EFFECTS[input?.hover]?input.hover:'glow',autoListen:input?.autoListen!==false,visualizer:{
    mode:VISUALIZER_MODES[v.mode]?v.mode:'bars',theme:VISUALIZER_THEMES[v.theme]||v.theme==='custom'?v.theme:'trinity',
    color1:color(v.color1,base.color1),color2:color(v.color2,base.color2),background:color(v.background,base.background),
    sensitivity:bounded(v.sensitivity,.5,3,1.25),glow:bounded(v.glow,0,30,14)
  }};
}
export function visualizerColors(settings){return settings.theme==='custom'?settings:VISUALIZER_THEMES[settings.theme]||VISUALIZER_THEMES.trinity;}
