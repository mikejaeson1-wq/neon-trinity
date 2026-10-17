import {CLOUD} from './cloud-config.mjs';
export class MobileLibrary{
  constructor(client){this.client=client;this.owner=null;this.generation=0;this.reset();}
  reset(){this.tracks=[];this.albums=[];this.playlists=[];this.assets=[];this.publicRows=[];this.signed=new Map();}
  setOwner(user){const id=user?.id||null;if(id===this.owner)return;this.owner=id;this.generation++;this.reset();}
  current(generation){if(generation!==this.generation)throw new Error('Das angemeldete Konto hat sich geändert.');}
  async load(){
    const generation=this.generation;
    if(!this.owner){const result=await this.client.from('nt_releases').select('id,data').order('updated_at',{ascending:false});this.current(generation);if(result.error)throw result.error;this.publicRows=result.data||[];this.albums=this.publicRows.map(r=>({...r.data.album,id:r.id}));this.tracks=[...new Map(this.publicRows.flatMap(r=>r.data.tracks||[]).map(t=>[t.id,t])).values()];this.assets=[...new Map(this.publicRows.flatMap(r=>r.data.assets||[]).map(a=>[a.id,a])).values()];return;}
    const [catalog,personal]=await Promise.all([this.client.from('nt_catalog').select('data').eq('id',1).single(),this.client.from('nt_private_playlists').select('id,data').eq('owner_id',this.owner).order('updated_at')]);this.current(generation);if(catalog.error)throw catalog.error;if(personal.error)throw personal.error;
    const data=catalog.data.data;this.tracks=data.tracks||[];this.albums=data.albums||[];this.assets=data.assets||[];this.playlists=[...(data.playlists||[]),...(personal.data||[]).map(r=>({...r.data,id:r.id,personal:true}))];
  }
  async publicAlbum(id){
    if(this.owner)return;const row=this.publicRows.find(r=>r.id===id);if(!row)throw new Error('Dieses Album wurde nicht veröffentlicht.');const generation=this.generation;
    const response=await fetch(CLOUD.url+'/functions/v1/neon-public/album/'+encodeURIComponent(id),{headers:{apikey:CLOUD.key},cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await response.json();this.current(generation);if(!response.ok)throw new Error(data.error||'Das Album ist gerade nicht erreichbar.');
    for(const asset of data.assets||[]){const url=data.urls?.[asset.path];if(url){try{const value=new URL(url);if(value.origin===CLOUD.url&&value.pathname.startsWith('/storage/v1/object/sign/'))this.signed.set(asset.id,{url:value.href,until:Date.now()+180000});}catch{}}}return data;
  }
  async media(id){
    const cached=this.signed.get(id);if(cached?.until>Date.now())return cached.url;const asset=this.assets.find(a=>a.id===id&&a.provider==='supabase');if(!asset)return '';const generation=this.generation;
    if(!this.owner){for(const row of this.publicRows)if(row.data?.tracks?.some(t=>t.blobId===id||t.coverBlobId===id)||row.data?.album?.coverBlobId===id){await this.publicAlbum(row.id);return this.signed.get(id)?.url||'';}return '';}
    const result=await this.client.storage.from(CLOUD.bucket).createSignedUrl(asset.path,3600);this.current(generation);if(result.error)throw result.error;const url=result.data.signedUrl;this.signed.set(id,{url,until:Date.now()+3300000});return url;
  }
}
