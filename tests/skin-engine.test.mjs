import test from 'node:test';
import assert from 'node:assert/strict';
import {skinInput,sceneInput,importDesign,pulseMascot} from '../app/skin-engine.mjs';
test('Eigene Skins und Szenen enthalten ausschließlich erlaubte Farben, Bilder und begrenzte Ebenen',()=>{
 const s=skinInput({name:'Mein Kopf',deck:'url(javascript:bad)',image:'data:image/svg+xml;base64,AAA',font:'url(bad)',radius:100});assert.equal(s.deck,'#252832');assert.equal(s.image,'');assert.equal(s.font,'mono');assert.equal(s.radius,32);
 const scene=sceneInput({layers:Array.from({length:20},()=>({mode:'script',opacity:10,scale:99}))});assert.equal(scene.layers.length,4);assert.equal(scene.layers[0].mode,'bars');assert.equal(scene.layers[0].opacity,1);assert.throws(()=>importDesign('{"format":"other","version":1}','neon-trinity-skin'),/kein passendes/);
});
test('Die Maskottchen reagieren auf Musikpegel und lassen sich abschalten',()=>{let pulse;const root={style:{setProperty:(_k,v)=>pulse=v}};pulseMascot(root,[100,100,100],{intensity:.5});assert.equal(Number(pulse),.5);pulseMascot(root,[100],{enabled:false});assert.equal(Number(pulse),0);});
