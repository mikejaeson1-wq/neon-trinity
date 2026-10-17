import {normalizeAppearance,visualizerColors} from './appearance.mjs';
import {EQ_FREQUENCIES,normalizeEqualizer,applyEqualizer} from './player-settings.mjs';

// One source node for the lifetime of the player. The same audio still goes to
// the speakers; canvas frames are measured from its frequency/time-domain data.
export class AudioVisualizer{
  constructor(audio,{AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,requestFrame=globalThis.requestAnimationFrame?.bind(globalThis),cancelFrame=globalThis.cancelAnimationFrame?.bind(globalThis)}={}){
    Object.assign(this,{audio,AudioContextClass,requestFrame,cancelFrame});this.settings=normalizeAppearance().visualizer;this.canvas=null;this.frame=null;
  }
  attach(canvas,settings){this.detach();this.canvas=canvas;this.settings=normalizeAppearance({visualizer:settings}).visualizer;if(!canvas)return;this.ctx=canvas.getContext?.('2d');if(!this.ctx)return;this.draw();}
  configure(settings){this.settings=normalizeAppearance({visualizer:settings}).visualizer;}
  configureEqualizer(settings){this.equalizer=normalizeEqualizer(settings);if(this.filters)applyEqualizer(this,this.equalizer);}
  spectrum(){if(!this.analyser||this.audio.paused)return [];this.analyser.getByteFrequencyData(this.frequencies);return Array.from({length:24},(_,i)=>Math.round(this.frequencies[Math.floor(2+(i/24)**1.7*450)]/255*100));}
  async resume(){
    if(!this.AudioContextClass)return false;
    if(!this.context){this.context=new this.AudioContextClass();this.analyser=this.context.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=.78;this.source=this.context.createMediaElementSource(this.audio);this.source.connect(this.analyser);this.analyser.connect(this.context.destination);this.frequencies=new Uint8Array(this.analyser.frequencyBinCount);this.wave=new Uint8Array(this.analyser.fftSize);}
    if(this.context.createBiquadFilter&&!this.filters){
      this.source.disconnect();this.preamp=this.context.createGain();this.filters=EQ_FREQUENCIES.map(f=>{const node=this.context.createBiquadFilter();node.type='peaking';node.frequency.value=f;node.Q.value=1.4;return node;});
      this.panner=this.context.createStereoPanner?.();this.limiter=this.context.createDynamicsCompressor();this.limiter.threshold.value=-1;this.limiter.knee.value=0;this.limiter.ratio.value=20;this.limiter.attack.value=.003;this.limiter.release.value=.15;
      let previous=this.source;for(const node of [this.preamp,...this.filters,...(this.panner?[this.panner]:[]),this.limiter]){previous.connect(node);previous=node;}previous.connect(this.analyser);applyEqualizer(this,this.equalizer);
    }
    if(this.context.state==='suspended')await this.context.resume();return true;
  }
  detach(){if(this.frame!=null)this.cancelFrame?.(this.frame);this.frame=null;this.canvas=null;this.ctx=null;}
  draw(){
    const canvas=this.canvas,c=this.ctx;if(!canvas||!c)return;
    if(canvas.isConnected===false){this.detach();return;}
    const hidden=globalThis.document?.hidden;
    if(!hidden){
      const ratio=Math.min(globalThis.devicePixelRatio||1,2),w=Math.max(300,canvas.clientWidth||900),h=Math.max(180,canvas.clientHeight||390);
      if(canvas.width!==w*ratio||canvas.height!==h*ratio){canvas.width=w*ratio;canvas.height=h*ratio;}
      c.setTransform(ratio,0,0,ratio,0,0);const s=this.settings,p=visualizerColors(s);c.fillStyle=p.background;c.fillRect(0,0,w,h);
      const active=this.analyser&&!this.audio.paused;if(active){this.analyser.getByteFrequencyData(this.frequencies);this.analyser.getByteTimeDomainData(this.wave);}
      const gradient=c.createLinearGradient(0,h,w,0);gradient.addColorStop(0,p.color1);gradient.addColorStop(1,p.color2);c.fillStyle=gradient;c.strokeStyle=gradient;c.shadowColor=p.color1;c.shadowBlur=s.glow;c.lineWidth=2;
      const n=72,value=i=>active?Math.min(1,this.frequencies[Math.min(this.frequencies.length-1,Math.floor(2+(i/n)**1.8*500))]/255*s.sensitivity):0;
      if(s.mode==='wave'){
        c.beginPath();for(let i=0;i<=256;i++){const x=i/256*w,y=h/2+(active?(this.wave[i*7]-128)/128:0)*h*.37*s.sensitivity;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
      }else if(s.mode==='orbit'){
        const r=Math.min(w,h)*.22;for(let i=0;i<n;i++){const a=i/n*Math.PI*2,amp=value(i)*Math.min(w,h)*.22;c.beginPath();c.moveTo(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r);c.lineTo(w/2+Math.cos(a)*(r+amp+2),h/2+Math.sin(a)*(r+amp+2));c.stroke();}c.shadowBlur=0;c.font='600 11px Segoe UI';c.textAlign='center';c.fillStyle=p.color1;c.fillText('YOUR FREQUENCY',w/2,h/2+4);
      }else{
        const gap=3,bw=(w-40)/n;for(let i=0;i<n;i++){const amp=Math.max(2,value(i)*(s.mode==='mirror'?h*.42:h*.78)),x=20+i*bw;c.fillRect(x,s.mode==='mirror'?h/2-amp/2:h-24-amp,Math.max(1,bw-gap),amp);}
      }
      c.shadowBlur=0;
    }
    this.frame=this.requestFrame?.(()=>this.draw())??null;
  }
}
