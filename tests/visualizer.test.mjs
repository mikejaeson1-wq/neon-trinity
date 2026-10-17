import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioVisualizer} from '../app/visualizer.mjs';
import {normalizeAppearance} from '../app/appearance.mjs';
test('Visualizer nutzt genau einen Audiopfad und zeichnet echte Frequenz- und Wellenformdaten',async()=>{
 let sources=0,frequencyReads=0,waveReads=0,bars=[],lines=[];const node={connect:()=>{}},analyser={...node,frequencyBinCount:1024,getByteFrequencyData:out=>{frequencyReads++;out.fill(150);},getByteTimeDomainData:out=>{waveReads++;out.fill(180);}};
 class Context{state='suspended';destination={};createAnalyser(){return analyser;}createMediaElementSource(){sources++;return node;}async resume(){this.state='running';}}
 const ctx={setTransform(){},fillRect:(...args)=>bars.push(args),createLinearGradient:()=>({addColorStop(){}}),beginPath(){},moveTo(){},lineTo:(...args)=>lines.push(args),stroke(){},fillText(){}};
 const canvas={isConnected:true,clientWidth:700,clientHeight:300,getContext:()=>ctx},audio={paused:false};const v=new AudioVisualizer(audio,{AudioContextClass:Context});await v.resume();await v.resume();assert.equal(sources,1);v.attach(canvas,normalizeAppearance().visualizer);assert.equal(frequencyReads,1);assert.ok(bars.some(([,y,,height])=>height>20&&y<250));
 v.configure({...normalizeAppearance().visualizer,mode:'wave',theme:'custom',color1:'#112233',color2:'#445566',background:'#000000'});v.draw();assert.equal(waveReads,2);assert.ok(lines.some(([,y])=>y!==150));audio.paused=true;v.draw();assert.equal(waveReads,2);v.detach();assert.equal(v.canvas,null);
});
test('Beschädigte Design-Einstellungen werden auf gültige Werte begrenzt',()=>{
 const a=normalizeAppearance({hover:'invalid',visualizer:{mode:'script',theme:'random',color1:'url(https://x)',sensitivity:800,glow:-100}});assert.equal(a.hover,'glow');assert.equal(a.visualizer.mode,'bars');assert.equal(a.visualizer.theme,'trinity');assert.equal(a.visualizer.color1,'#2eff80');assert.equal(a.visualizer.sensitivity,3);assert.equal(a.visualizer.glow,0);
});
