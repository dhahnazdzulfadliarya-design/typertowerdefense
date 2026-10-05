import {DIRECTION_ROWS,getAimDirection} from './aiming.js';
import {STAGES} from './config.js';
export function getDrawStage(progress){if(progress<=0)return 'ready';if(progress<=.25)return 'nock';if(progress<.65)return 'draw';return 'aim';}
// Six actual poses per direction. Release also provides the brief follow-through hold.
export const ARCHER_ANIMATIONS=Object.fromEntries(Object.entries(DIRECTION_ROWS).map(([d,row])=>[d,Object.fromEntries(STAGES.map((s,col)=>[s,row*6+col]))]));
export class Archer{
  constructor(){this.direction='right';this.shotDirection='right';this.progress=0;this.stage='ready';this.hasTarget=false;this.shotTime=Infinity;this.angle=0;}
  aim(base,target,progress=0,threat=null){
    this.progress=progress;this.hasTarget=!!target;const look=target??threat;
    if(look){this.angle=Math.atan2(look.y-base.y,look.x-base.x);this.direction=getAimDirection(base,look,this.direction);}
    this.updateStage();
  }
  release(direction=this.direction){this.shotDirection=direction;this.shotTime=0;this.stage='aim';}
  updateStage(){
    if(this.shotTime<.026)this.stage='aim';else if(this.shotTime<.16)this.stage='release';else if(this.shotTime<.25&&!this.hasTarget)this.stage='reset';else this.stage=this.hasTarget?getDrawStage(this.progress):'ready';
  }
  tick(dt){this.shotTime+=dt;this.updateStage();}
  get renderDirection(){return this.shotTime<.16?this.shotDirection:this.direction;}
  get frame(){return ARCHER_ANIMATIONS[this.renderDirection][this.stage];}
}
