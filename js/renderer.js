import {ASSETS,DEBUG_ARCHER,MONSTER_WIDTHS,MONSTER_LABEL_HEIGHTS,clamp} from './config.js';
import {getArrowOrigin} from './aiming.js';
let pending=null;
export function loadAssets(onProgress=()=>{}){
  if(pending)return pending.then(assets=>{onProgress(100);return assets;});
  pending=(async()=>{
    const entries=Object.entries(ASSETS),assets={};let done=0;
    await Promise.all(entries.map(([key,url])=>new Promise((resolve,reject)=>{
      const image=new Image();const timer=setTimeout(()=>reject(Error('Loading took too long. Check your connection and try again.')),25000);
      image.onload=async()=>{clearTimeout(timer);try{await image.decode();}catch{}assets[key]=image;onProgress(Math.round(++done/(entries.length+1)*100));resolve();};
      image.onerror=()=>{clearTimeout(timer);reject(Error('The artwork could not load. Please try again.'));};image.src=url;
    })));
    const response=await fetch('assets/archer-8dir.json');if(!response.ok)throw Error('Archer frame map could not load.');
    assets.atlas=await response.json();onProgress(100);return assets;
  })().catch(error=>{pending=null;throw error;});
  return pending;
}
function bounds(image,sx,sy,sw,sh){
  const canvas=document.createElement('canvas');canvas.width=sw;canvas.height=sh;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh);
  const data=ctx.getImageData(0,0,sw,sh).data;let left=sw,top=sh,right=0,bottom=0;
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(data[(y*sw+x)*4+3]>35){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return {sx:sx+left,sy:sy+top,sw:Math.max(1,right-left+1),sh:Math.max(1,bottom-top+1)};
}
function sheet(image,cols,rows){
  return Array.from({length:cols*rows},(_,i)=>{
    const col=i%cols,row=Math.floor(i/cols),x=Math.round(col*image.width/cols),y=Math.round(row*image.height/rows);
    return bounds(image,x,y,Math.round((col+1)*image.width/cols)-x,Math.round((row+1)*image.height/rows)-y);
  });
}
export class Renderer{
  constructor(canvas,labelRoot){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.labelRoot=labelRoot;
    this.labels=new Map();this.labelPool=[];this.assets=null;this.clock=0;this.dpr=1;
    this.background=document.createElement('canvas');this.backgroundKey='';this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  setAssets(images){
    this.assets=images;this.boxes={tower:bounds(images.tower,0,0,images.tower.width,images.tower.height),monsters:sheet(images.monsters,4,4)};
    this.backgroundKey='';
  }
  resize(layout){
    this.layout=layout;this.dpr=Math.min(window.devicePixelRatio||1,layout.small?1.5:2);
    this.canvas.width=Math.round(layout.width*this.dpr);this.canvas.height=Math.round(layout.height*this.dpr);this.backgroundKey='';
  }
  reset(){this.clock=0;for(const node of this.labels.values()){node.hidden=true;this.labelPool.push(node);}this.labels.clear();}
  cacheBackground(){
    const l=this.layout,key=`${l.width},${l.height}`;if(this.backgroundKey===key)return;
    this.background.width=Math.round(l.width);this.background.height=Math.round(l.height);const c=this.background.getContext('2d'),image=this.assets.forest;
    const scale=Math.max(l.width/image.width,l.height/image.height),w=image.width*scale,h=image.height*scale;
    c.drawImage(image,(l.width-w)/2,(l.height-h)/2,w,h);
    const gradient=c.createRadialGradient(l.cx,l.cy,60,l.cx,l.cy,Math.max(l.width,l.height)*.72);gradient.addColorStop(0,'#ffffff00');gradient.addColorStop(1,'#163b2033');c.fillStyle=gradient;c.fillRect(0,0,l.width,l.height);
    this.backgroundKey=key;
  }
  sprite(image,b,x,foot,width,flip=false,alpha=1){
    const c=this.ctx,h=width*b.sh/b.sw;c.save();c.globalAlpha=alpha;c.translate(x,foot);if(flip)c.scale(-1,1);c.drawImage(image,b.sx,b.sy,b.sw,b.sh,-width/2,-h,width,h);c.restore();
  }
  draw(session,dt=0){
    if(!this.assets||!this.layout)return;
    this.clock+=dt;this.cacheBackground();const c=this.ctx,l=this.layout;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.drawImage(this.background,0,0,l.width,l.height);
    c.save();if(session.damageFlash&&!this.reduced)c.translate(Math.sin(this.clock*83)*session.damageFlash*6,Math.cos(this.clock*67)*session.damageFlash*3);
    for(const e of session.enemies)if(e.status!=='dead'&&e.y<l.cy-12*l.scale)this.monster(e,session);
    this.sprite(this.assets.tower,this.boxes.tower,l.cx,l.towerFoot,l.towerWidth);
    if(session.damageFlash){c.fillStyle=`rgba(255,245,196,${session.damageFlash*.45})`;c.beginPath();c.ellipse(l.cx,l.towerFoot-100*l.scale,62*l.scale,110*l.scale,0,0,Math.PI*2);c.fill();}
    this.drawArcher(session.archer);
    for(const e of session.enemies)if(e.status!=='dead'&&e.y>=l.cy-12*l.scale)this.monster(e,session);
    for(const a of session.arrows)if(a.launched)this.arrow(a);
    for(const effect of session.effects)this.effect(effect);
    c.restore();
    if(!this.reduced){c.fillStyle='#fff2b3';c.globalAlpha=.35;const count=l.small?4:10;for(let i=0;i<count;i++){c.beginPath();c.arc((i*179+this.clock*7)%l.width,l.height*(.25+(Math.sin(this.clock*.3+i)*.5+.5)*.66),1,0,Math.PI*2);c.fill();}c.globalAlpha=1;}
    this.drawLabels(session);
    if(DEBUG_ARCHER)this.debug(session);
  }
  drawArcher(archer){
    const l=this.layout,key=`${archer.renderDirection}-${archer.stage}`,frame=this.assets.atlas.frames[key],s=l.archerScale;
    if(!frame)return;
    this.ctx.drawImage(this.assets.archer,frame.x,frame.y,frame.w,frame.h,l.archerBase.x-frame.anchorX*s,l.archerBase.y-frame.anchorY*s,frame.w*s,frame.h*s);
  }
  monster(e,session){
    const c=this.ctx,l=this.layout,s=l.scale,phase=this.clock*(e.kind===0?11:8)+e.phase,frame=Math.floor(phase)%4,b=this.boxes.monsters[e.kind*4+frame];
    const size=MONSTER_WIDTHS[e.kind]*s,bob=this.reduced?0:(e.kind===0?Math.sin(phase)*4:e.kind===3?-Math.abs(Math.sin(phase*.5))*7:Math.sin(phase*2)) *s;
    c.fillStyle='#17302245';c.beginPath();c.ellipse(e.x,e.y+2*s,size*.32,5*s,0,0,Math.PI*2);c.fill();
    if(session.targetId===e.id){c.strokeStyle='#ffe48a';c.lineWidth=Math.max(1.5,2*s);c.beginPath();c.ellipse(e.x,e.y+3*s,size*.48,10*s,0,0,Math.PI*2);c.stroke();}
    this.sprite(this.assets.monsters,b,e.x,e.y+(e.kind===0?-17*s:0)+bob,size,e.x>l.cx,e.status==='shot'?.9:1);
  }
  arrow(a){
    const c=this.ctx,s=Math.max(.55,this.layout.scale);c.save();c.translate(a.x,a.y);c.rotate(a.angle);
    c.strokeStyle='#684322';c.lineWidth=2*s;c.beginPath();c.moveTo(-24*s,0);c.lineTo(4*s,0);c.stroke();
    c.strokeStyle='#fff1b1';c.lineWidth=s;c.beginPath();c.moveTo(-23*s,-s);c.lineTo(4*s,-s);c.stroke();
    c.fillStyle='#dce5ec';c.beginPath();c.moveTo(10*s,0);c.lineTo(2*s,-3*s);c.lineTo(2*s,3*s);c.fill();
    c.strokeStyle='#eff5f7';c.lineWidth=2*s;c.beginPath();c.moveTo(-18*s,0);c.lineTo(-24*s,-4*s);c.moveTo(-18*s,0);c.lineTo(-24*s,4*s);c.stroke();c.restore();
  }
  effect(e){
    const c=this.ctx,s=this.layout.scale,p=1-e.life/.4,count=this.layout.small?5:9;c.save();
    for(let i=0;i<count;i++){const a=i*Math.PI*2/count+e.phase,d=p*43*s;c.fillStyle=e.kind===3?'#b6f66d':'#ffe4a0';c.globalAlpha=1-p;c.beginPath();c.arc(e.x+Math.cos(a)*d,e.y-20*s+Math.sin(a)*d,(3*(1-p)+1)*s,0,Math.PI*2);c.fill();}c.restore();
  }
  label(){
    let node=this.labelPool.pop();
    if(!node){node=document.createElement('div');node.className='enemy-label';node.innerHTML='<span class="typed"></span><span class="remaining"></span>';this.labelRoot.append(node);}
    node.hidden=false;return node;
  }
  drawLabels(session){
    const l=this.layout,live=session.enemies.filter(e=>e.status==='alive'),ids=new Set(live.map(e=>e.id));
    for(const [id,node] of this.labels)if(!ids.has(id)){node.hidden=true;this.labelPool.push(node);this.labels.delete(id);}
    const placed=[];
    for(const e of live.sort((a,b)=>a.remaining-b.remaining)){
      let node=this.labels.get(e.id);if(!node){node=this.label();node.dataset.name='';this.labels.set(e.id,node);}
      const active=e.id===session.targetId,prefix=active?session.prefix:0,key=`${e.name}:${prefix}`;
      if(node.dataset.name!==key){node.children[0].textContent=e.name.slice(0,prefix);node.children[1].textContent=e.name.slice(prefix);node.dataset.name=key;node._width=0;}
      node.className=`enemy-label${active?' active':''}${e.remaining<3?' urgent':''}`;
      const w=node._width||(node._width=node.offsetWidth),h=node.offsetHeight||24;
      const minimum=l.top-18,maximum=Math.max(minimum,l.bottom-h+10);
      let x=clamp(e.x-w/2,5,l.width-w-5),y=clamp(e.y-MONSTER_LABEL_HEIGHTS[e.kind]*l.scale-h,minimum,maximum),baseY=y;
      for(let attempt=0;attempt<9;attempt++){
        if(!placed.some(r=>x<r.x+r.w+4&&x+w+4>r.x&&y<r.y+r.h+3&&y+h+3>r.y))break;
        y=clamp(baseY+(attempt%2?-1:1)*Math.ceil((attempt+1)/2)*(h+4),minimum,maximum);
        if(attempt>5)x=clamp(x+(attempt%2?-1:1)*w*.55,5,l.width-w-5);
      }
      node.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;placed.push({x,y,w,h});
    }
  }
  debug(session){
    const c=this.ctx,l=this.layout,a=session.archer,o=getArrowOrigin(l.archerBase,a.renderDirection,l.archerScale),t=session.target;
    c.fillStyle='#ffffffec';c.fillRect(8,75,280,100);c.fillStyle='#142538';c.font='14px monospace';
    [a.renderDirection+' / '+a.stage,`angle ${(a.angle*180/Math.PI).toFixed(1)}°`,t?`${t.name} (${t.x.toFixed(0)}, ${t.y.toFixed(0)})`:'No target',`bow (${o.x.toFixed(0)}, ${o.y.toFixed(0)})`].forEach((text,i)=>c.fillText(text,16,96+i*20));
    c.strokeStyle='#ff235a';c.beginPath();c.arc(o.x,o.y,4,0,Math.PI*2);if(t){c.moveTo(o.x,o.y);c.lineTo(t.x,t.y);}c.stroke();
  }
}
