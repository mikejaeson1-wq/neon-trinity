export const PLAYER_SKINS={classic:'Classic Graphite',trinity:'Trinity Neon',silver:'Silver Hi-Fi',amber:'Amber Terminal',ice:'Glacier Blue',cyberware:'Cyberware Head',capybara:'Capybara FM',wolf:'Glacier Wolf',raven:'Black Raven',cassette:'Cassette Bot',jellyfish:'Cosmic Jellyfish'};
export const PLAYER_LAYOUTS={classic:'Classic Rack',modern:'Cover Player',compact:'Kompakt'};
export const EQ_FREQUENCIES=[31,62,125,250,500,1000,2000,4000,8000,16000];
export const EQ_PRESETS={flat:{name:'Neutral',gains:[0,0,0,0,0,0,0,0,0,0]},rock:{name:'Rock',gains:[4,3,1,-1,-2,0,2,3,4,3]},bass:{name:'Bass',gains:[6,5,4,2,0,0,-1,-1,0,0]},vocal:{name:'Stimmen',gains:[-3,-2,-1,0,2,4,4,2,0,-1]},electronic:{name:'Electronic',gains:[5,4,1,0,-2,1,0,2,4,5]},night:{name:'Nacht',gains:[-4,-3,-2,0,2,2,1,0,-2,-3]}};
const bound=(v,min,max,def=0)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):def;
export function normalizePlayer(p={}){return {skin:Object.hasOwn(PLAYER_SKINS,p?.skin)?p.skin:'classic',layout:Object.hasOwn(PLAYER_LAYOUTS,p?.layout)?p.layout:'classic',equalizerOpen:p?.equalizerOpen===true,playlistOpen:p?.playlistOpen===true};}
export function normalizeEqualizer(e={}){return {enabled:e?.enabled===true,preset:EQ_PRESETS[e?.preset]||e?.preset==='custom'?e.preset:'flat',gains:EQ_FREQUENCIES.map((_,i)=>bound(e?.gains?.[i],-12,12)),preamp:bound(e?.preamp,-12,0),balance:bound(e?.balance,-1,1)};}
export function applyEqualizer(graph,settings){
  const e=normalizeEqualizer(settings),now=graph.context.currentTime||0;
  const set=(param,value)=>{if(param.setTargetAtTime)param.setTargetAtTime(value,now,.02);else param.value=value;};
  graph.filters.forEach((filter,i)=>set(filter.gain,e.enabled?e.gains[i]:0));
  // Automatic headroom plus a final limiter keep positive EQ boosts controlled.
  const headroom=e.enabled?Math.max(0,...e.gains):0;
  set(graph.preamp.gain,10**((e.enabled?e.preamp-headroom:0)/20));
  if(graph.panner)set(graph.panner.pan,e.enabled?e.balance:0);
  return e;
}
