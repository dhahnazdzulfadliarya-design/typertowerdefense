import {HEARTS,clamp} from './config.js';
import {calculateDifficulty,WeightedNames} from './waves.js';
import {Archer} from './archer.js';
import {getArrowOrigin,interceptTime} from './aiming.js';
import {createLayout} from './responsive.js';
export {NameDeck} from './waves.js';
export const randomBetween=(a,b,rng=Math.random)=>a+(b-a)*rng();
export function correctPrefix(input,name){let i=0;while(i<input.length&&i<name.length&&input[i]===name[i])i++;return i;}
export function chooseTarget(enemies,letter){
  let best=null;
  for(const e of enemies)if(e.status==='alive'&&e.name.startsWith(letter.toUpperCase())&&(!best||e.remaining<best.remaining))best=e;
  return best;
}
class Pool{
  constructor(){this.free=[];}
  take(values){return Object.assign(this.free.pop()??{},values);}
  give(item){this.free.push(item);}
}
function compact(array,pool,isDead){let write=0;for(let i=0;i<array.length;i++){const item=array[i];if(isDead(item))pool.give(item);else array[write++]=item;}array.length=write;}
export class GameSession{
  constructor({rng=Math.random,onEvent=()=>{},layout=createLayout(1280,720)}={}){
    Object.assign(this,{rng,onEvent,layout,state:'Ready',hearts:HEARTS,wave:1,enemies:[],arrows:[],effects:[],input:'',targetId:null,spawned:0,resolved:0,kills:0,score:0,elapsed:0,correct:0,assessed:0,spawnTimer:.4,gap:0,id:0,damageFlash:0,lastPath:-1,result:null});
    this.config=calculateDifficulty(1);this.names=new WeightedNames(rng);this.archer=new Archer();
    this.enemyPool=new Pool();this.arrowPool=new Pool();this.effectPool=new Pool();
  }
  event(type,data={}){this.onEvent({type,...data});}
  get target(){return this.enemies.find(e=>e.id===this.targetId&&e.status==='alive')??null;}
  get prefix(){return this.target?correctPrefix(this.input,this.target.name):0;}
  get progress(){return this.target?this.prefix/this.target.name.length:0;}
  get wpm(){return this.elapsed>0?this.correct/5/(this.elapsed/60):0;}
  get accuracy(){return this.assessed?100*this.correct/this.assessed:null;}
  start(){if(this.state==='Ready'||this.state==='Paused')this.state='Playing';}
  pause(){if(this.state==='Playing'||this.state==='Ready')this.state='Paused';}
  clearInput(){this.input='';this.targetId=null;this.updateAim();this.event('input');}
  backspace(){if(this.state!=='Playing')return;this.input=this.input.slice(0,-1);if(!this.input)this.targetId=null;this.updateAim();this.event('input');}
  type(char){
    if(this.state!=='Playing'||this.gap>0||typeof char!=='string'||[...char].length!==1)return false;
    char=char.toUpperCase();if(char.length!==1)return false;
    this.assessed++;
    if(!this.input&&!this.target){this.targetId=chooseTarget(this.enemies,char)?.id??null;if(this.target)this.event('target');}
    const target=this.target,candidate=this.input+char,valid=!!target&&target.name.startsWith(candidate);
    if(valid){this.correct++;this.event('correct');}else this.event('wrong');
    if(this.input.length<32)this.input=candidate;
    this.updateAim();
    if(valid&&this.input===target.name){this.shoot(target);this.clearInput();}else this.event('input');
    return valid;
  }
  aimPoint(enemy){return {x:enemy.x,y:enemy.y-(enemy.kind===0?38:24)*this.layout.scale};}
  updateAim(){
    const target=this.target;let threat=null;
    if(!target)for(const e of this.enemies)if(e.status==='alive'&&(!threat||e.remaining<threat.remaining))threat=e;
    // Upper-body pivot, measured from the feet. The archer stays upright.
    const base={x:this.layout.archerBase.x,y:this.layout.archerBase.y-60*this.layout.archerScale};
    this.archer.aim(base,target?this.aimPoint(target):null,this.progress,threat?this.aimPoint(threat):null);
  }
  shoot(enemy){
    enemy.status='shot'; // Committed shot: untargetable, continues moving, cannot damage twice.
    this.archer.release();
    this.arrows.push(this.arrowPool.take({target:enemy.id,direction:this.archer.direction,delay:.035,launched:false,done:false,x:0,y:0,fromX:0,fromY:0,endX:0,endY:0,t:0,duration:0,angle:0}));
    this.event('shoot',{enemy});
  }
  setLayout(layout){
    const old=this.layout;this.layout=layout;
    for(const e of this.enemies)this.positionEnemy(e);
    for(const a of this.arrows){
      if(!a.launched)continue;
      a.x=a.x/old.width*layout.width;a.y=a.y/old.height*layout.height;
      const target=this.enemies.find(e=>e.id===a.target);
      if(target)this.planArrow(a,target,{x:a.x,y:a.y});else a.done=true;
    }
    for(const e of this.effects){e.x=e.x/old.width*layout.width;e.y=e.y/old.height*layout.height;}
    this.updateAim();
  }
  geometry(angle){
    const l=this.layout,dx=Math.cos(angle),dy=Math.sin(angle),pad=40*l.scale;
    const edges=[dx>0?(l.width-pad-l.cx)/dx:dx<0?(pad-l.cx)/dx:Infinity,dy>0?(l.bottom-l.cy)/dy:dy<0?(l.top-l.cy)/dy:Infinity];
    const radius=Math.max(1,Math.min(...edges));
    const endRadius=1/Math.sqrt((dx/(79*l.scale))**2+(dy/(32*l.scale))**2);
    return {sx:l.cx+dx*radius,sy:l.cy+dy*radius,ex:l.cx+dx*Math.min(endRadius,radius*.45),ey:l.cy+dy*Math.min(endRadius,radius*.45)};
  }
  positionEnemy(e){
    const points=this.geometry(e.angle);Object.assign(e,points);
    const p=clamp(1-e.remaining/e.travel,0,1);
    e.x=e.sx+(e.ex-e.sx)*p;e.y=e.sy+(e.ey-e.sy)*p;
    e.vx=e.remaining>0?(e.ex-e.sx)/e.travel:0;e.vy=e.remaining>0?(e.ey-e.sy)/e.travel:0;
  }
  spawn(){
    const active=this.enemies.filter(e=>e.status!=='dead');
    if(this.spawned>=this.config.enemyCount||active.length>=this.config.maxActive)return false;
    const used=new Set(active.map(e=>e.path));let choices=Array.from({length:16},(_,i)=>i).filter(i=>!used.has(i)&&i!==this.lastPath);
    if(!choices.length)return false;
    const path=choices[Math.floor(this.rng()*choices.length)],angle=path*Math.PI/8+randomBetween(-.035,.035,this.rng),points=this.geometry(angle);
    const distance=Math.hypot(points.sx-points.ex,points.sy-points.ey),longest=Math.hypot(this.layout.width/2,(this.layout.bottom-this.layout.top)/2);
    const ratio=clamp(distance/longest,0,1),travel=Math.max(4.3,this.config.travelTime*(.70+.35*ratio)*randomBetween(.94,1.06,this.rng));
    const name=this.names.next(this.wave,active.map(e=>e.name));if(!name)return false;
    const enemy=this.enemyPool.take({id:++this.id,name,kind:Math.floor(this.rng()*4),path,angle,travel,remaining:travel,status:'alive',phase:this.rng()*Math.PI*2,x:0,y:0,sx:0,sy:0,ex:0,ey:0,vx:0,vy:0});
    this.positionEnemy(enemy);this.enemies.push(enemy);this.lastPath=path;this.spawned++;this.event('spawn',{enemy});return true;
  }
  resolve(enemy,killed){
    if(enemy.status==='dead')return;
    enemy.status='dead';this.resolved++;
    if(killed){this.kills++;this.score+=enemy.name.length*10;this.effects.push(this.effectPool.take({x:enemy.x,y:enemy.y,kind:enemy.kind,life:.4,phase:enemy.phase}));this.event('impact');}
    else{this.hearts=Math.max(0,this.hearts-1);this.damageFlash=.4;this.event('damage');}
    if(enemy.id===this.targetId)this.clearInput();
  }
  planArrow(arrow,enemy,origin){
    const target=this.aimPoint(enemy),speed=Math.max(600,1800*this.layout.scale),velocity={x:enemy.vx,y:enemy.vy};
    let duration=interceptTime(origin,target,velocity,speed);
    if(duration>enemy.remaining){
      const stopped={x:enemy.ex,y:enemy.ey-(enemy.kind===0?38:24)*this.layout.scale};
      duration=Math.hypot(stopped.x-origin.x,stopped.y-origin.y)/speed;
      arrow.endX=stopped.x;arrow.endY=stopped.y;
    }else{arrow.endX=target.x+velocity.x*duration;arrow.endY=target.y+velocity.y*duration;}
    Object.assign(arrow,{fromX:origin.x,fromY:origin.y,x:origin.x,y:origin.y,duration:Math.max(.035,duration),t:0,launched:true,angle:Math.atan2(arrow.endY-origin.y,arrow.endX-origin.x)});
  }
  updateArrows(dt){
    for(const a of this.arrows){
      const enemy=this.enemies.find(e=>e.id===a.target&&e.status==='shot');
      if(!enemy){a.done=true;continue;}
      if(!a.launched){a.delay-=dt;if(a.delay>0)continue;this.planArrow(a,enemy,getArrowOrigin(this.layout.archerBase,a.direction,this.layout.archerScale));continue;}
      a.t+=dt;const p=clamp(a.t/a.duration,0,1);a.x=a.fromX+(a.endX-a.fromX)*p;a.y=a.fromY+(a.endY-a.fromY)*p;
      if(p===1){a.done=true;this.resolve(enemy,true);}
    }
    compact(this.arrows,this.arrowPool,a=>a.done);
  }
  startWave(){this.wave++;this.config=calculateDifficulty(this.wave);this.spawned=0;this.resolved=0;this.spawnTimer=.35;this.gap=0;this.event('wave');}
  tick(dt){
    if(this.state!=='Playing'||!Number.isFinite(dt)||dt<=0)return;
    // The app feeds <= 1/30s steps. Clamp external/debug calls too.
    dt=Math.min(dt,.1);this.elapsed+=dt;this.damageFlash=Math.max(0,this.damageFlash-dt);
    this.archer.tick(dt);
    for(const effect of this.effects)effect.life-=dt;
    compact(this.effects,this.effectPool,e=>e.life<=0);
    if(this.gap>0){this.gap=Math.max(0,this.gap-dt);if(!this.gap)this.startWave();return;}
    for(const e of this.enemies){
      if(e.status==='dead')continue;
      e.remaining=Math.max(0,e.remaining-dt);this.positionEnemy(e);
      if(e.remaining===0&&e.status==='alive')this.resolve(e,false);
      if(this.hearts===0){this.finish();return;}
    }
    this.updateArrows(dt);compact(this.enemies,this.enemyPool,e=>e.status==='dead');this.updateAim();
    if(this.spawned>=this.config.enemyCount&&!this.enemies.length){this.gap=this.config.breakTime;this.clearInput();this.event('waveClear');return;}
    this.spawnTimer-=dt;
    if(this.spawnTimer<=0&&this.spawn())this.spawnTimer=this.config.spawnDelay*randomBetween(.9,1.1,this.rng);
  }
  snapshot(){return {score:this.score,wave:this.wave,kills:this.kills,hearts:this.hearts,correct:this.correct,assessed:this.assessed,wpm:Math.round(this.wpm),accuracy:this.accuracy===null?null:Math.round(this.accuracy*10)/10,seconds:Math.floor(this.elapsed)};}
  finish(){if(this.result)return;this.state='GameOver';this.clearInput();this.result=this.snapshot();this.event('finish',{result:this.result});}
}
