import test from 'node:test';
import assert from 'node:assert/strict';
import {StudioAudio} from '../app/audio-deck.mjs';
import {analyseBuffer,normalizationGain} from '../app/audio-analysis.mjs';
class Element extends EventTarget{volume=.8;paused=true;currentTime=0;duration=10;src='';pause(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}removeAttribute(){}load(){}}
function graph(){const starts=[],param=()=>({value:1,events:[],setValueAtTime(v,t){this.events.push([v,t]);},linearRampToValueAtTime(v,t){this.events.push([v,t]);},cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}}),context={currentTime:0,resume:async()=>{},createGain:()=>({gain:param(),connect(){},disconnect(){}}),createBufferSource:()=>({playbackRate:{value:1},connect(){},disconnect(){},start(t,o){starts.push([t,o]);},stop(){}})};return {context,preamp:{},starts};}
test('Zwei MP3-Puffer werden ohne zusätzliche Lücke auf der Audiouhr geplant und korrekt übernommen',async()=>{
 const g=graph(),audio=new StudioAudio(new Element(),{getGraph:async()=>g,schedule:()=>0,cancel:()=>{}});let advanced;audio.addEventListener('trackadvance',e=>advanced=e.detail.id);await audio.loadDecoded('blob:one',{duration:3});await audio.play();audio.scheduleNext({id:'two',url:'blob:two',buffer:{duration:5}},0);assert.deepEqual(g.starts,[[0,0],[3,0]]);g.context.currentTime=3.25;audio.pump();assert.equal(advanced,'two');assert.equal(audio.src,'blob:two');assert.equal(audio.currentTime,.25);audio.pause();assert.equal(audio.paused,true);
});
test('Überblendungen planen gegenläufige Pegel und Pausieren entfernt auch den vorbereiteten Titel',async()=>{
 const g=graph(),audio=new StudioAudio(new Element(),{getGraph:async()=>g,schedule:()=>0,cancel:()=>{}});await audio.loadDecoded('blob:one',{duration:10});await audio.play();audio.scheduleNext({id:'two',url:'blob:two',buffer:{duration:10}},3);assert.equal(g.starts[1][0],7);assert.deepEqual(audio.next.entry.gain.gain.events,[[0,7],[1,10]]);assert.deepEqual(audio.active.gain.gain.events,[[1,7],[0,10]]);g.context.currentTime=2;audio.pause();assert.equal(audio.next,null);assert.equal(audio.nodes.size,0);assert.equal(audio.currentTime,2);
});
test('Lautstärkeanalyse erzeugt Wellenformdaten, gleicht Pegel an und verstärkt Stille nicht',()=>{
 const buffer=value=>({numberOfChannels:1,length:44100,sampleRate:44100,duration:1,getChannelData:()=>new Float32Array(44100).fill(value)});const quiet=analyseBuffer(buffer(.1)),loud=analyseBuffer(buffer(.5));assert.equal(quiet.wave.length,512);assert.ok(Math.abs(quiet.rmsDb+normalizationGain(quiet)+18)<.01);assert.ok(Math.abs(loud.rmsDb+normalizationGain(loud)+18)<.01);assert.equal(normalizationGain(analyseBuffer(buffer(0))),0);
});

test('Eine verspätete Freigabe des Audiokontexts startet nach Pause oder Quellenwechsel keinen alten Song',async()=>{
 const g=graph(),audio=new StudioAudio(new Element(),{getGraph:async()=>g,schedule:()=>0,cancel:()=>{}});await audio.loadDecoded('blob:private',{duration:10});let resume;g.context.resume=()=>new Promise(r=>resume=r);const playing=audio.play();audio.pause();resume();await playing;assert.equal(audio.paused,true);assert.equal(g.starts.length,0);
 const again=audio.play();audio.src='https://media.example/band';resume();await again;assert.equal(audio.src,'https://media.example/band');assert.equal(audio.pcm,false);assert.equal(g.starts.length,0);
});
