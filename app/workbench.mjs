import {validId} from './shared.mjs';
import {ownerSettings} from './studio-state.mjs';
export const RELEASE_STATES={idea:'Idee',demo:'Demo',working:'In Arbeit',approved:'Freigegeben',released:'Veröffentlicht'};
export function workInput(input={}){
 const status=Object.hasOwn(RELEASE_STATES,input.status)?input.status:'idea',group=String(input.version_group||'');
 if(group&&!validId(group))throw new Error('Ungültige Versionsgruppe.');
 return {status,version_group:group,version_label:String(input.version_label||'').trim().slice(0,80),lyrics:String(input.lyrics||'').slice(0,120000),credits:String(input.credits||'').slice(0,4000),notes:String(input.notes||'').slice(0,4000)};
}
export function lyricCues(text){
 const cues=[];for(const line of String(text||'').split(/\r?\n/)){const body=line.replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g,'').trim();for(const match of line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)){const seconds=Number(match[1])*60+Number(match[2])+Number('0.'+(match[3]||'0'));if(Number(match[2])<60&&seconds<=86400&&body)cues.push({at:seconds,text:body.slice(0,500)});}}
 return cues.sort((a,b)=>a.at-b.at).slice(0,2000);
}
export function activeLyric(cues,position){let selected=-1;for(let i=0;i<cues.length&&cues[i].at<=position;i++)selected=i;return selected;}
const check=r=>{if(r.error)throw new Error(r.error.message||'Die Musikwerkstatt konnte nicht gespeichert werden.');return r.data;};
export class Workbench{
 constructor({client,getState,getOwner,onChange=()=>{}}){Object.assign(this,{client,getState,getOwner,onChange});this.rows=[];this.comments=[];this.generation=0;this.owner=null;this.loaded=false;this.busy=false;}
 setOwner(owner){const id=owner?.id||null;if(id===this.owner)return;this.owner=id;this.generation++;this.rows=[];this.comments=[];this.loaded=false;}
 local(track){return track?.visibility==='local';}
 verify(track){const owner=this.getOwner()?.id;if(!owner||this.local(track)&&track.ownerId!==owner)throw new Error('Dieser Song ist für dein Konto nicht verfügbar.');return owner;}
 value(kind,id,local=false){if(local)return workInput(ownerSettings(this.getState(),this.owner).work[id]);return this.rows.find(r=>r.record_kind===kind&&r.record_id===id)||workInput();}
 async load(){if(!this.owner)return;const gen=this.generation;const rows=check(await this.client.from('nt_workbench').select('*'));if(gen!==this.generation)return;this.rows=rows;this.loaded=true;this.onChange();}
 async save(kind,record,input){
  const owner=this.verify(record),gen=this.generation,value=workInput(input);
  if(this.local(record)){ownerSettings(this.getState(),owner).work[record.id]={...value,revision:crypto.randomUUID(),updated_at:new Date().toISOString(),comments:ownerSettings(this.getState(),owner).work[record.id]?.comments||[]};this.onChange();return;}
  if(!['track','album'].includes(kind)||!validId(record.id))throw new Error('Ungültiger Werkstatteintrag.');
  const existing=this.rows.find(r=>r.record_kind===kind&&r.record_id===record.id);
  const query=existing?this.client.from('nt_workbench').update(value).eq('record_kind',kind).eq('record_id',record.id).eq('revision',existing.revision):this.client.from('nt_workbench').insert({record_kind:kind,record_id:record.id,...value});
  const row=check(await query.select().maybeSingle());if(!row)throw new Error('Die Fassung wurde inzwischen geändert. Bitte die Musikwerkstatt neu laden.');if(gen!==this.generation||owner!==this.getOwner()?.id)return;
  this.rows=this.rows.filter(r=>r.record_kind!==kind||r.record_id!==record.id).concat(row);this.onChange();
 }
 async loadComments(track){
  const owner=this.verify(track),gen=this.generation;if(this.local(track)){this.comments=ownerSettings(this.getState(),owner).work[track.id]?.comments||[];return this.comments;}
  const rows=check(await this.client.from('nt_song_comments').select('*').eq('track_id',track.id).order('created_at'));if(gen!==this.generation)return [];this.comments=rows;return rows;
 }
 async comment(track,position,body){
  const owner=this.verify(track),gen=this.generation,text=String(body||'').trim();if(!text||text.length>2000||!Number.isFinite(position)||position<0||position>86400)throw new Error('Bitte einen Kommentar und eine gültige Zeitmarke eingeben.');
  if(this.local(track)){const work=ownerSettings(this.getState(),owner).work[track.id]??=workInput();work.comments??=[];work.comments.push({id:crypto.randomUUID(),track_id:track.id,author_id:owner,author_alias:this.getOwner().alias,position,body:text,resolved:false,created_at:new Date().toISOString()});}
  else check(await this.client.from('nt_song_comments').insert({track_id:track.id,position,body:text}));
  if(gen!==this.generation)return;await this.loadComments(track);this.onChange();
 }
 async resolve(track,id,resolved){
  const owner=this.verify(track),gen=this.generation;if(this.local(track)){const comment=(ownerSettings(this.getState(),owner).work[track.id]?.comments||[]).find(c=>c.id===id);if(!comment)throw new Error('Kommentar nicht mehr vorhanden.');comment.resolved=!!resolved;}
  else check(await this.client.from('nt_song_comments').update({resolved:!!resolved}).eq('id',id).eq('track_id',track.id));
  if(gen!==this.generation)return;await this.loadComments(track);this.onChange();
 }
 family(track,tracks){const local=this.local(track),work=this.value('track',track.id,local),group=work.version_group||track.id;return tracks.filter(t=>this.local(t)===local&&(!local||t.ownerId===this.owner)&&(t.id===group||(this.value('track',t.id,local).version_group||t.id)===group));}
}
