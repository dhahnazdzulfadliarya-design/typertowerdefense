export class Soundscape{
  constructor(muted=true){this.muted=muted;this.ctx=null;this.master=null;this.musicTimer=null;this.note=0;this.active=false;this.noiseBuffers=new Map();}
  unlock(){try{if(!this.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=this.muted?0:.28;this.master.connect(this.ctx.destination);}if(this.ctx.state==='suspended')void this.ctx.resume().catch(()=>{});}catch{}}
  setMuted(muted){this.muted=muted;this.unlock();if(this.master)this.master.gain.setTargetAtTime(muted?0:.28,this.ctx.currentTime,.04);}
  tone(freq,duration=.15,type='sine',volume=.2,delay=0,end=null){
    if(!this.ctx||this.muted)return;
    const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(volume,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.onended=()=>{o.disconnect();g.disconnect();};o.start(t);o.stop(t+duration+.02);
  }
  noise(duration=.12,volume=.12){
    if(!this.ctx||this.muted)return;
    let buffer=this.noiseBuffers.get(duration);
    if(!buffer){const n=Math.ceil(this.ctx.sampleRate*duration);buffer=this.ctx.createBuffer(1,n,this.ctx.sampleRate);const d=buffer.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);this.noiseBuffers.set(duration,buffer);}
    const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(this.master);source.onended=()=>{source.disconnect();gain.disconnect();};source.start();
  }
  play(name){
    if(name==='target')this.tone(620,.07,'triangle',.10);
    if(name==='correct')this.tone(180,.06,'triangle',.035,0,270);
    if(name==='wrong')this.tone(110,.09,'triangle',.13);
    if(name==='shoot'){this.noise(.16,.18);this.tone(580,.16,'triangle',.10,0,130);}
    if(name==='impact'){this.noise(.09,.18);this.tone(150,.12,'sine',.2);this.tone(680,.18,'sine',.07,.06,350);}
    if(name==='damage'){this.noise(.28,.25);this.tone(100,.35,'sawtooth',.1,0,44);}
    if(name==='waveClear')[392,494,587].forEach((f,i)=>this.tone(f,.3,'triangle',.12,i*.12));
    if(name==='defeat')[294,262,220,147].forEach((f,i)=>this.tone(f,.6,'triangle',.16,i*.22));
  }
  music(active){
    if(active===this.active)return;this.active=active;
    if(this.musicTimer){clearInterval(this.musicTimer);this.musicTimer=null;}
    if(active){const phrase=[294,370,440,587,494,440,370,330,262,330,392,523,440,392,330,262];this.musicTimer=setInterval(()=>{if(!this.muted&&this.ctx){const f=phrase[this.note++%phrase.length];this.tone(f,1.1,'sine',.07);if(this.note%4===0)this.tone(f/2,2,'triangle',.045);}},520);}
  }
  dispose(){this.music(false);void this.ctx?.close();}
}
