import test from 'node:test';
import assert from 'node:assert/strict';
import {lyricCues,activeLyric,workInput,Workbench} from '../app/workbench.mjs';
import {newState} from '../app/core.mjs';
test('LRC-Zeitmarken werden sortiert, Mehrfachmarken erkannt und ungültige Sekunden verworfen',()=>{
 const cues=lyricCues('[00:12.30]Refrain\n[00:01.0][00:03.500]Verse\n[00:88]Bad');assert.deepEqual(cues.map(c=>c.at),[1,3.5,12.3]);assert.equal(activeLyric(cues,.5),-1);assert.equal(cues[activeLyric(cues,13)].text,'Refrain');assert.throws(()=>workInput({version_group:'../bad'}),/Versionsgruppe/);
});
test('Private Fassungen, Texte und Kommentare bleiben lokal und kontogebunden',async()=>{
 const state=newState();let owner={id:'dex',alias:'Dex'};const w=new Workbench({client:{from(){throw new Error('Private Daten dürfen nicht hochgeladen werden');}},getState:()=>state,getOwner:()=>owner});w.setOwner(owner);const song={id:'song',visibility:'local',ownerId:'dex'};await w.save('track',song,{status:'demo',version_label:'Suno v2',lyrics:'[00:01]Privat'});await w.comment(song,12,'Übergang verbessern');assert.equal((await w.loadComments(song)).length,1);await w.resolve(song,w.comments[0].id,true);assert.equal(w.comments[0].resolved,true);
 owner={id:'nix',alias:'Nix'};w.setOwner(owner);assert.equal(w.value('track','song',true).lyrics,'');await assert.rejects(w.comment(song,0,'Foreign'),/nicht verfügbar/);
});
